#!/usr/bin/env node
/**
 * Re-analyses journal entries that were scored by the built-in rules (or the mock adapter) with the
 * real model service, so older entries get fine-grained emotions, core scores, intent and, where the
 * user has not answered it yet, an LLM-written CBT prompt.
 *
 * What it never changes:
 *   - safety_flags (re-scoring must not raise or silence alerts after the fact)
 *   - voice entries (the audio is not stored, so they cannot be re-analysed)
 *   - the user's own emotion correction (corrected_emotion, correction_reason, ...)
 *   - a reflection prompt the user already answered
 *   - entry text, visibility, dates; memories are not re-extracted (would create duplicates)
 *
 * DRY RUN by default: prints how many entries would change (counts only, never journal text).
 * --apply additionally requires --backup <file> made by backup-firestore.js. Every write is guarded
 * by the document's update time, so an entry edited while the script runs is skipped.
 * An entry is only written when the model service really answered (no fallback results).
 *
 *   node scripts/reanalyze-entries.js                       # dry run
 *   node scripts/reanalyze-entries.js --apply --backup <file> [--limit 50]
 */
const fs = require('fs');
const { parseArgs, loadFirebase, banner } = require('./lib/common');

const realResult = (r) => r && r.provenance && r.provenance.is_mock !== true && r.provenance.adapter !== 'fallback';

function needsReanalysis(e) {
  if (e.input_source === 'audio') return false;
  if (!e.masked_content || !String(e.masked_content).trim()) return false;
  const p = e.detected_emotions?.provenance;
  return !p || p.is_mock === true || p.adapter === 'fallback' || p.adapter === 'mock';
}

(async () => {
  const args = parseArgs();
  const apply = Boolean(args.apply);
  banner('Re-analyse journal entries with the model service', apply);
  if (apply && (!args.backup || !fs.existsSync(args.backup))) {
    console.error('--apply requires --backup <file> from `npm run db:backup` (file must exist).');
    process.exit(2);
  }
  const limit = args.limit ? parseInt(args.limit, 10) : Infinity;

  const { db } = loadFirebase();
  const modelService = require('../src/services/modelService');
  if (modelService.usingFallbackOnly) {
    console.error('The backend is configured with built-in rules only (USE_MOCK_MODELS / MODEL_API_BASE_URL). Nothing to do.');
    process.exit(2);
  }
  const health = await modelService.healthCheck();
  if (health.status !== 'healthy') {
    console.error('Model service is not reachable. Start it first (model_service, port 8000).');
    process.exit(2);
  }

  const snap = await db.collection('journal_entries').get();
  const candidates = snap.docs.filter((d) => needsReanalysis(d.data())).slice(0, limit);
  console.log(`${snap.size} journal entries, ${candidates.length} analysed by built-in rules and eligible.`);
  if (!apply) {
    console.log('Dry run: nothing written. Re-run with --apply --backup <file> to update them.');
    process.exit(0);
  }

  let updated = 0;
  let skipped = 0;
  for (const doc of candidates) {
    const e = doc.data();
    const content = e.masked_content;
    try {
      const emotions = await modelService.analyzeEmotions(content, 'text', null);
      if (!realResult(emotions)) {
        skipped += 1;
        continue;
      }
      const intent = await modelService.analyzeIntent(content);
      const de = e.detected_emotions || {};
      const payload = {
        detected_emotions: {
          ...de,
          primary_state: emotions.primary_state,
          confidence: emotions.confidence,
          sentiment_score: emotions.sentiment_score,
          all_28_states: emotions.all_28_states || {},
          fine_grained_emotions: (emotions.fine_grained_emotions || []).slice(0, 10),
          ekman_scores: emotions.ekman_scores || null,
          provenance: { ...emotions.provenance, reanalysed_at: new Date().toISOString() }
        }
      };
      if (realResult(intent)) {
        payload.intent_object = {
          intent: intent.intent,
          clarified_to: intent.clarified_to || '',
          triggers: intent.triggers || [],
          coping_attempts: intent.coping_attempts || []
        };
      }
      if (!e.reflection_prompt?.user_response) {
        const r = await modelService.generateReflection(content, emotions.primary_state, emotions.sentiment_score, intent.intent, e.extracted_themes || []);
        if (realResult(r)) {
          payload.reflection_prompt = { ...(e.reflection_prompt || {}), prompt_text: r.prompt_text, prompt_type: r.prompt_type || 'cbt_clarification' };
        }
      }
      await doc.ref.update(payload, { lastUpdateTime: doc.updateTime });
      updated += 1;
      process.stdout.write('.');
    } catch (err) {
      skipped += 1;
      console.warn(`\n  skipped ${doc.id}: ${err.code === 9 || /precondition/i.test(err.message) ? 'changed during run' : err.message.split('\n')[0]}`);
    }
  }
  console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
  process.exit(0);
})();

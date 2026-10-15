#!/usr/bin/env node
/**
 * Repairs malformed fields in existing documents (docs/data-reconciliation-plan.md, step R3).
 *
 * Detects, by rule (not by hard-coded IDs), so it is safe to re-run:
 *   - keys with leading/trailing whitespace whose trimmed key is absent   (A5–A8)
 *   - journal_entries: safety flags stored in a map named `sync_timestamp` (A9)
 *   - journal_entries: detected_emotions.detected_emotions instead of all_28_states (A10)
 *   - users: preferences.structured_memory instead of top-level structured_memory (A4)
 *
 * DRY RUN by default: prints each planned field move (paths only, never values).
 * --apply additionally requires --backup <file> made by backup-firestore.js; every write is
 * guarded by the document's updateTime recorded in that backup, so a document that changed
 * after the backup is skipped instead of overwritten. No document is ever deleted.
 *
 *   node scripts/reconcile-data.js                         # dry run
 *   node scripts/reconcile-data.js --apply --backup <file> [--include-audit-logs]
 *
 * consent_audit_logs are skipped unless --include-audit-logs is given (audit records are
 * meant to be immutable; see plan item A7).
 */
const fs = require('fs');
const { parseArgs, loadFirebase, banner } = require('./lib/common');

const SAFETY_KEYS = ['severity_flag', 'red_zone_triggered', 'crisis_language_detected'];
const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.toDate !== 'function';

/** Returns a list of { from: [path...], to: [path...], reason } moves for one document. */
function planMoves(collection, data) {
  const moves = [];
  const conflicts = [];

  const walk = (obj, prefix, depth) => {
    for (const [key, value] of Object.entries(obj)) {
      const trimmed = key.trim();
      if (trimmed !== key) {
        if (trimmed in obj) conflicts.push({ path: [...prefix, key], reason: `both "${key}" and "${trimmed}" exist` });
        else moves.push({ from: [...prefix, key], to: [...prefix, trimmed], reason: 'whitespace in key' });
      }
      if (isMap(value) && depth < 3) walk(value, [...prefix, key], depth + 1);
    }
  };
  walk(data, [], 0);

  if (collection === 'journal_entries') {
    if (!data.safety_flags && isMap(data.sync_timestamp) && SAFETY_KEYS.some((k) => k in data.sync_timestamp)) {
      moves.push({ from: ['sync_timestamp'], to: ['safety_flags'], reason: 'safety flags stored under sync_timestamp' });
    }
    const emotions = data.detected_emotions;
    if (isMap(emotions) && isMap(emotions.detected_emotions) && !emotions.all_28_states) {
      moves.push({
        from: ['detected_emotions', 'detected_emotions'],
        to: ['detected_emotions', 'all_28_states'],
        reason: 'emotion scores nested under detected_emotions.detected_emotions'
      });
    }
  }

  if (collection === 'users' && !data.structured_memory && isMap(data.preferences) && isMap(data.preferences.structured_memory)) {
    moves.push({ from: ['preferences', 'structured_memory'], to: ['structured_memory'], reason: 'structured_memory nested in preferences' });
  }

  return { moves, conflicts };
}

const getPath = (obj, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), obj);
const show = (p) => p.map((k) => (k.trim() === k ? k : JSON.stringify(k))).join('.');

async function main() {
  const args = parseArgs();
  const apply = Boolean(args.apply);
  banner('Data reconciliation (field repairs)', apply);
  const { db, firestore } = loadFirebase();
  const { FieldPath, FieldValue, Timestamp } = firestore;

  let backupTimes = null;
  if (apply) {
    if (!args.backup) throw new Error('--apply requires --backup <file> created by scripts/backup-firestore.js');
    const backup = JSON.parse(fs.readFileSync(args.backup, 'utf8'));
    backupTimes = new Map(backup.documents.map((d) => [d.path, d.updateTime]));
    console.log(`Backup: ${args.backup} (${backup.count} documents, exported ${backup.exported_at})\n`);
  }

  const summary = { documentsScanned: 0, documentsToFix: 0, moves: 0, conflicts: 0, applied: 0, skipped: 0 };
  for (const collRef of await db.listCollections()) {
    const isAudit = collRef.id === 'consent_audit_logs';
    const snap = await collRef.get();
    for (const doc of snap.docs) {
      summary.documentsScanned++;
      const { moves, conflicts } = planMoves(collRef.id, doc.data());
      conflicts.forEach((c) => {
        summary.conflicts++;
        console.log(`CONFLICT ${doc.ref.path}: ${show(c.path)} — ${c.reason} (left untouched)`);
      });
      if (!moves.length) continue;

      summary.documentsToFix++;
      summary.moves += moves.length;
      const skipAudit = isAudit && !args['include-audit-logs'];
      console.log(`${doc.ref.path}${skipAudit ? '  [SKIPPED: audit log; pass --include-audit-logs]' : ''}`);
      moves.forEach((m) => console.log(`    move ${show(m.from)}  ->  ${show(m.to)}   (${m.reason})`));
      if (!apply || skipAudit) continue;

      const backedUp = backupTimes.get(doc.ref.path);
      if (!backedUp) {
        summary.skipped++;
        console.log('    SKIPPED: document not present in backup');
        continue;
      }
      if (doc.updateTime.seconds !== backedUp.seconds || doc.updateTime.nanoseconds !== backedUp.nanoseconds) {
        summary.skipped++;
        console.log('    SKIPPED: document changed since the backup was taken');
        continue;
      }

      // field/value pairs, then the precondition; paths are FieldPath objects so keys with spaces work
      const updateArgs = [];
      for (const m of moves) {
        updateArgs.push(new FieldPath(...m.to), getPath(doc.data(), m.from));
        updateArgs.push(new FieldPath(...m.from), FieldValue.delete());
      }
      try {
        await doc.ref.update(...updateArgs, { lastUpdateTime: new Timestamp(backedUp.seconds, backedUp.nanoseconds) });
        summary.applied++;
        console.log('    APPLIED');
      } catch (err) {
        summary.skipped++;
        console.log(`    FAILED: ${err.message.split('\n')[0]}`);
      }
    }
  }

  console.log('\nSummary:', summary);
  if (!apply && summary.moves) console.log('Dry run only. Re-run with --apply --backup <file> after approval.');
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('ERROR:', err.message);
      process.exit(1);
    });
}

module.exports = { planMoves };

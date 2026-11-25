const journalRepository = require('../repositories/journalRepository');
const reflectionRepository = require('../repositories/reflectionRepository');
const memoryRepository = require('../repositories/memoryRepository');
const safetyService = require('./safetyService');
const modelService = require('./modelService');
const accessPolicy = require('./accessPolicy');
const fitnessRepository = require('../repositories/fitnessRepository');
const { Timestamp } = require('../config/firebase/firestore');
const logger = require('../utils/logger');

const { httpError } = accessPolicy;

// Regex-based PII scrubber (simulating Presidio anonymizer)
function scrubPII(text) {
  if (!text) return '';
  return text
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '<EMAIL>')
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '<PHONE_NUMBER>')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '<US_SSN>')
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, '<AADHAAR_NUM>');
}

/** Today's (else yesterday's) synced fitness day as journal biometrics, or null. Never throws. */
async function latestFitnessBiometrics(userId) {
  try {
    const day = (ms) => new Date(ms).toISOString().slice(0, 10);
    const rows = await fitnessRepository.listDays(userId, day(Date.now() - 86400000), day(Date.now()));
    const latest = [...rows].reverse().find((d) => d.sleep_minutes || d.steps);
    if (!latest) return null;
    const bio = {};
    if (latest.sleep_minutes) bio.sleep_hours = Math.round((latest.sleep_minutes / 60) * 10) / 10;
    if (latest.steps) bio.steps = latest.steps;
    return bio;
  } catch (err) {
    logger.warn('Could not attach fitness data to journal entry', { error: err.message });
    return null;
  }
}

const notFound = () => httpError(404, 'NOT_FOUND', 'Journal entry not found');
const notOwner = () => httpError(403, 'FORBIDDEN', 'Access denied. You do not own this journal entry.');

class JournalService {
  /**
   * Creates an entry from user-authored input only. Masking, emotion/intent/safety analysis
   * and the CBT prompt are always computed here; the request schema rejects client-supplied values.
   */
  async createEntry(userId, data, { precomputedEmotions = null } = {}) {
    const maskedContent = scrubPII(data.content);
    const now = Timestamp.now();

    // precomputedEmotions comes only from server-side voice analysis (createVoiceEntry), never from a request body
    const detectedEmotions = precomputedEmotions
      ? { ...precomputedEmotions }
      : await modelService.analyzeEmotions(maskedContent, data.input_source || 'text', data.vocal_prosody || null);
    if (data.self_reported_emotion) {
      detectedEmotions.corrected_emotion = data.self_reported_emotion;
      detectedEmotions.correction_reason = 'self_reported_at_entry';
      detectedEmotions.user_correction_timestamp = now;
    }

    // Wearable context for the safety check: what the client sent, else the latest synced Google Fit day
    const biometrics = data.biometrics || (await latestFitnessBiometrics(userId));

    const intentObject = await modelService.analyzeIntent(maskedContent);
    const safetyFlags = await modelService.analyzeSafety(maskedContent, detectedEmotions, biometrics);
    const reflectionPrompt = await modelService.generateReflection(
      maskedContent,
      detectedEmotions.primary_state,
      detectedEmotions.sentiment_score,
      intentObject.intent,
      data.extracted_themes || []
    );
    if (data.reflection_response) {
      reflectionPrompt.user_response = scrubPII(data.reflection_response);
      reflectionPrompt.user_response_timestamp = now;
    }

    const savedEntry = await journalRepository.create(userId, {
      masked_content: maskedContent,
      entry_type: data.entry_type,
      input_source: data.input_source,
      audio_transcript_confidence: data.audio_transcript_confidence,
      extracted_themes: data.extracted_themes,
      entry_date: data.entry_date,
      biometrics,
      visibility: data.visibility,
      detected_emotions: detectedEmotions,
      intent_object: intentObject,
      safety_flags: safetyFlags,
      reflection_prompt: reflectionPrompt
    });

    // Dual-write to reflection_prompts_and_responses for standalone CBT tracking
    if (reflectionPrompt && reflectionPrompt.prompt_text) {
      try {
        await reflectionRepository.create(userId, {
          entry_id: savedEntry.id,
          prompt_text: reflectionPrompt.prompt_text,
          prompt_type: reflectionPrompt.prompt_type || 'cbt_clarification',
          cbt_technique_used: reflectionPrompt.cbt_technique_used || 'cognitive_exploration'
        });
      } catch (err) {
        logger.warn('Failed to mirror prompt to reflection collection', { error: err.message });
      }
    }

    // Auto-extract memories if applicable
    try {
      const extractedMemories = await modelService.extractMemories(maskedContent, detectedEmotions.primary_state);
      for (const mem of extractedMemories) {
        await memoryRepository.create(userId, {
          memory_text: mem.text,
          memory_type: mem.type,
          importance_score: mem.score,
          metadata: { associated_entry_id: savedEntry.id, extraction_confidence: mem.score }
        });
      }
    } catch (memErr) {
      logger.warn('Failed to extract memories', { error: memErr.message });
    }

    if (safetyFlags.severity_flag === 'high') {
      await this.dispatchHighSeverityAlerts(userId, savedEntry.id);
    }

    return { ...savedEntry, access: 'owner' };
  }

  /**
   * Voice journal: the model service transcribes the recording and scores voice + text emotion.
   * The transcript becomes the entry text (PII-scrubbed like typed text); the audio itself is
   * never stored.
   */
  async createVoiceEntry(userId, audio, meta = {}) {
    const result = await modelService.analyzeAudio(audio.buffer, audio.mimeType, audio.filename);
    const transcript = (result.transcript || '').trim();
    if (!/[A-Za-z]/.test(transcript)) {
      throw httpError(422, 'NO_SPEECH_DETECTED', 'No speech was detected in the recording. Please try again closer to the microphone.');
    }

    const de = result.detected_emotions;
    const precomputedEmotions = {
      primary_state: de.primary_state,
      confidence: de.confidence,
      sentiment_score: de.sentiment_score,
      all_28_states: de.all_28_states || {},
      fine_grained_emotions: result.fine_grained_emotions || [],
      vocal_prosody: null,
      voice_analysis: {
        decision: result.decision ?? de.fusion?.decision ?? null,
        text_says: result.text_says ?? null,
        voice_says: result.voice_says ?? null,
        voice_raw: result.voice_raw ?? null,
        voice_scores: result.voice_scores || null,
        fused_scores: result.fused_scores || null,
        seconds_analysed: typeof result.voice_seconds_analysed === 'number' ? result.voice_seconds_analysed : null
      },
      provenance: de.provenance || null
    };

    const entry = await this.createEntry(
      userId,
      {
        content: transcript.slice(0, 10000),
        entry_type: 'voice_journal',
        input_source: 'audio',
        audio_transcript_confidence: null,
        visibility: meta.visibility,
        extracted_themes: meta.extracted_themes,
        self_reported_emotion: meta.self_reported_emotion,
        reflection_response: meta.reflection_response
      },
      { precomputedEmotions }
    );
    return entry;
  }

  async dispatchHighSeverityAlerts(userId, entryId) {
    try {
      await safetyService.raiseAlert(userId, {
        severity: 'high',
        alertType: 'sustained_emotional_decline',
        reason: `High emotional distress flag detected on journal entry (${entryId}).`
      });
    } catch (alertErr) {
      logger.error('Failed to dispatch red flag alerts', { error: alertErr.message });
    }
  }

  async getEntry(id, user) {
    const entry = await journalRepository.getById(id);
    if (!entry) throw notFound();
    return accessPolicy.viewEntryFor(user, entry);
  }

  async listEntries(userId, query) {
    const result = await journalRepository.listByUser(userId, query);
    result.entries = result.entries.map((e) => ({
      ...e,
      visibility: accessPolicy.entryVisibility(e),
      access: 'owner'
    }));
    return result;
  }

  /**
   * A doctor's view of a patient's SHARED entries, projected according to the consent access level.
   */
  async listSharedEntriesForDoctor(user, patientId, query) {
    const { access } = await accessPolicy.resolveDoctorJournalAccess(user, patientId);
    const result = await journalRepository.listSharedByUser(patientId, query);
    result.entries = result.entries.map((e) => accessPolicy.toDoctorView(e, access));
    return { ...result, access };
  }

  async updateEntry(id, userId, updates) {
    const payload = {};
    const now = Timestamp.now();
    let becameHighSeverity = false;

    if (updates.content !== undefined) {
      const existing = await journalRepository.getById(id);
      if (!existing) throw notFound();
      if (existing.user_id !== userId) throw notOwner();

      payload.masked_content = scrubPII(updates.content);
      payload.edited_at = now;
      const emotions = await modelService.analyzeEmotions(payload.masked_content, existing.input_source || 'text', null);
      payload.detected_emotions = emotions; // merged in the repository, so a self-reported emotion is kept
      payload.intent_object = await modelService.analyzeIntent(payload.masked_content);
      payload.safety_flags = await modelService.analyzeSafety(payload.masked_content, emotions, existing.biometrics || null);
      becameHighSeverity = payload.safety_flags.severity_flag === 'high' && existing.safety_flags?.severity_flag !== 'high';
    }

    if (updates.extracted_themes !== undefined) payload.extracted_themes = updates.extracted_themes;
    if (updates.visibility !== undefined) payload.visibility = updates.visibility;
    if (updates.reflection_prompt) {
      payload.reflection_prompt = {};
      if (updates.reflection_prompt.user_response !== undefined) {
        payload.reflection_prompt.user_response = scrubPII(updates.reflection_prompt.user_response);
        payload.reflection_prompt.user_response_timestamp = now;
      }
      if (updates.reflection_prompt.was_helpful !== undefined) {
        payload.reflection_prompt.was_helpful = updates.reflection_prompt.was_helpful;
      }
    }
    if (updates.detected_emotions) {
      payload.detected_emotions = {
        ...(payload.detected_emotions || {}),
        corrected_emotion: updates.detected_emotions.corrected_emotion,
        correction_reason: updates.detected_emotions.correction_reason || null,
        user_correction_timestamp: now
      };
    }

    const res = await journalRepository.update(id, userId, payload);
    if (res.notFound) throw notFound();
    if (res.forbidden) throw notOwner();
    if (becameHighSeverity) await this.dispatchHighSeverityAlerts(userId, id);
    return { ...res.data, visibility: accessPolicy.entryVisibility(res.data), access: 'owner' };
  }

  async deleteEntry(id, userId) {
    const res = await journalRepository.delete(id, userId);
    if (res.notFound) throw notFound();
    if (res.forbidden) throw notOwner();
    return res;
  }
}

module.exports = new JournalService();
module.exports.scrubPII = scrubPII;

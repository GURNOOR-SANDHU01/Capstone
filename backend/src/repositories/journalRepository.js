const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

class JournalRepository {
  constructor() {
    this.collection = db.collection(COLLECTIONS.JOURNAL_ENTRIES);
  }

  async create(userId, data) {
    const now = Timestamp.now();
    const entryDate = data.entry_date || new Date().toISOString().split('T')[0];

    const entry = {
      user_id: userId,
      masked_content: data.masked_content || '',
      entry_type: data.entry_type || 'daily_journal',
      input_source: data.input_source || 'text',
      audio_transcript_confidence: data.audio_transcript_confidence !== undefined ? data.audio_transcript_confidence : null,
      extracted_themes: data.extracted_themes || [],
      entry_date: entryDate,
      created_at: now,
      visibility: data.visibility === 'shared' ? 'shared' : 'private',
      detected_emotions: {
        primary_state: data.detected_emotions?.primary_state || 'neutral',
        confidence: data.detected_emotions?.confidence ?? 0.5,
        sentiment_score: data.detected_emotions?.sentiment_score ?? 0.0,
        all_28_states: data.detected_emotions?.all_28_states || {},
        vocal_prosody: data.detected_emotions?.vocal_prosody || null,
        corrected_emotion: data.detected_emotions?.corrected_emotion || null,
        correction_reason: data.detected_emotions?.correction_reason || null,
        user_correction_timestamp: data.detected_emotions?.user_correction_timestamp || null
      },
      intent_object: {
        intent: data.intent_object?.intent || 'general_reflection',
        clarified_to: data.intent_object?.clarified_to || '',
        triggers: data.intent_object?.triggers || [],
        coping_attempts: data.intent_object?.coping_attempts || []
      },
      reflection_prompt: {
        prompt_text: data.reflection_prompt?.prompt_text || '',
        prompt_type: data.reflection_prompt?.prompt_type || 'cbt_clarification',
        generated_at: data.reflection_prompt?.generated_at || now,
        user_response: data.reflection_prompt?.user_response || null,
        user_response_timestamp: data.reflection_prompt?.user_response_timestamp || null,
        was_helpful: data.reflection_prompt?.was_helpful ?? null
      },
      biometrics: data.biometrics
        ? {
            resting_hr: data.biometrics.resting_hr ?? null,
            hr_variability: data.biometrics.hr_variability ?? null,
            sleep_hours: data.biometrics.sleep_hours ?? null,
            sleep_quality_score: data.biometrics.sleep_quality_score ?? null,
            steps: data.biometrics.steps ?? null,
            stress_level: data.biometrics.stress_level ?? null,
            sync_timestamp: data.biometrics.sync_timestamp || now
          }
        : null,
      safety_flags: {
        severity_flag: data.safety_flags?.severity_flag || 'normal',
        red_zone_triggered: data.safety_flags?.red_zone_triggered || false,
        crisis_language_detected: data.safety_flags?.crisis_language_detected || false
      }
    };

    const docRef = await this.collection.add(entry);
    return { id: docRef.id, ...entry };
  }

  async getById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return fromDoc(doc);
  }

  async listByUser(userId, filters) {
    return this._list(this.collection.where('user_id', '==', userId), filters);
  }

  /**
   * Entries a patient explicitly shared. Entries without `visibility` are private and never match.
   */
  async listSharedByUser(userId, filters) {
    const base = this.collection.where('user_id', '==', userId).where('visibility', '==', 'shared');
    return this._list(base, filters);
  }

  async _list(baseQuery, { page = 1, limit = 20, startDate, endDate, severity } = {}) {
    let query = baseQuery;

    if (startDate) {
      query = query.where('entry_date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('entry_date', '<=', endDate);
    }
    if (severity) {
      query = query.where('safety_flags.severity_flag', '==', severity);
    }

    // Sort descending by created_at
    query = query.orderBy('created_at', 'desc');

    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit + 1).offset(offset).get();

    const entries = [];
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    docs.forEach((doc) => {
      entries.push(fromDoc(doc));
    });

    return {
      entries,
      pagination: {
        page,
        limit,
        hasMore,
        count: entries.length
      }
    };
  }

  async update(id, userId, updates) {
    const docRef = this.collection.doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { notFound: true };
    }
    if (existing.data().user_id !== userId) {
      return { forbidden: true };
    }

    const payload = {};
    if (updates.extracted_themes !== undefined) payload.extracted_themes = updates.extracted_themes;
    if (updates.visibility !== undefined) payload.visibility = updates.visibility;
    // Text edits: only the service sets these, after server-side masking and re-analysis
    if (updates.masked_content !== undefined) payload.masked_content = updates.masked_content;
    if (updates.edited_at !== undefined) payload.edited_at = updates.edited_at;

    if (updates.detected_emotions) {
      const current = existing.data().detected_emotions || {};
      payload.detected_emotions = { ...current, ...updates.detected_emotions };
    }
    if (updates.intent_object) {
      const current = existing.data().intent_object || {};
      payload.intent_object = { ...current, ...updates.intent_object };
    }
    if (updates.reflection_prompt) {
      const current = existing.data().reflection_prompt || {};
      payload.reflection_prompt = { ...current, ...updates.reflection_prompt };
    }
    if (updates.biometrics) {
      const current = existing.data().biometrics || {};
      payload.biometrics = { ...current, ...updates.biometrics };
    }
    if (updates.safety_flags) {
      const current = existing.data().safety_flags || {};
      payload.safety_flags = { ...current, ...updates.safety_flags };
    }

    await docRef.update(payload);
    const updated = await docRef.get();
    return { data: fromDoc(updated) };
  }

  async delete(id, userId) {
    const docRef = this.collection.doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { notFound: true };
    }
    if (existing.data().user_id !== userId) {
      return { forbidden: true };
    }

    await docRef.delete();
    return { success: true };
  }
}

module.exports = new JournalRepository();

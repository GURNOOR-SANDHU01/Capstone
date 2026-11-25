const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

function voiceUnavailable(message) {
  const err = new Error(message);
  err.status = 503;
  err.code = 'VOICE_ANALYSIS_UNAVAILABLE';
  err.expose = true;
  return err;
}

// 28 GoEmotions states according to Sentience architecture
const GO_EMOTIONS_28 = [
  'admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring', 'confusion',
  'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment',
  'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness',
  'optimism', 'pride', 'realization', 'relief', 'remorse', 'sadness', 'surprise', 'neutral'
];

/**
 * Mock Model Adapter used for local development and test environments
 * when no upstream model inference microservice is configured.
 */
class MockModelAdapter {
  constructor() {
    this.name = 'MockModelAdapter';
    logger.info('Initialized MockModelAdapter for AI model inference (clearly marked as mock)');
  }

  async healthCheck() {
    return {
      status: 'healthy',
      adapter: 'mock',
      models: {
        emotions: 'GoEmotions-28-Mock',
        intent: 'DeBERTa-Intent-Mock',
        safety: 'Presidio-Safety-Mock',
        reflection: 'CBT-Prompt-Generator-Mock'
      }
    };
  }

  async analyzeEmotions(content, inputSource = 'text', vocalProsody = null) {
    const lower = content.toLowerCase();
    let primaryState = 'neutral';
    let sentimentScore = 0.0;
    let confidence = 0.75;

    if (lower.includes('anxious') || lower.includes('exam') || lower.includes('panic') || lower.includes('worry')) {
      primaryState = 'nervousness';
      sentimentScore = -0.7;
      confidence = 0.91;
    } else if (lower.includes('stress') || lower.includes('deadline') || lower.includes('overwhelm') || lower.includes('tough')) {
      primaryState = 'annoyance';
      sentimentScore = -0.6;
      confidence = 0.88;
    } else if (lower.includes('sad') || lower.includes('depress') || lower.includes('lonely') || lower.includes('cry')) {
      primaryState = 'sadness';
      sentimentScore = -0.75;
      confidence = 0.89;
    } else if (lower.includes('happy') || lower.includes('great') || lower.includes('good') || lower.includes('walk') || lower.includes('relief')) {
      primaryState = 'relief';
      sentimentScore = 0.65;
      confidence = 0.84;
    }

    const all28 = {};
    for (const em of GO_EMOTIONS_28) {
      if (em === primaryState) {
        all28[em] = confidence;
      } else {
        all28[em] = parseFloat((Math.random() * 0.15).toFixed(2));
      }
    }

    return {
      primary_state: primaryState,
      confidence,
      sentiment_score: sentimentScore,
      all_28_states: all28,
      vocal_prosody: inputSource === 'audio' && vocalProsody ? vocalProsody : null,
      provenance: { adapter: 'mock', model: 'goemotions-28-v1', is_mock: true }
    };
  }

  async analyzeIntent(content) {
    const lower = content.toLowerCase();
    let intent = 'general_reflection';
    let clarifiedTo = 'daily_reflection';
    const triggers = [];
    const copingAttempts = [];

    if (lower.includes('deadline') || lower.includes('work') || lower.includes('job') || lower.includes('project')) {
      intent = 'work_stress';
      clarifiedTo = 'work_overload_stress';
      triggers.push('deadline_pressure', 'work_demands');
    }
    if (lower.includes('exam') || lower.includes('study') || lower.includes('test')) {
      intent = 'academic_anxiety';
      clarifiedTo = 'exam_anxiety_pressure';
      triggers.push('upcoming_evaluations');
    }
    if (lower.includes('conflict') || lower.includes('fight') || lower.includes('roommate') || lower.includes('friend')) {
      intent = 'interpersonal_conflict';
      clarifiedTo = 'relationship_friction';
      triggers.push('interpersonal_disagreement');
    }

    if (lower.includes('walk') || lower.includes('exercise')) copingAttempts.push('walking');
    if (lower.includes('breath')) copingAttempts.push('deep_breathing');
    if (lower.includes('music')) copingAttempts.push('music');
    if (lower.includes('journal')) copingAttempts.push('journaling');
    if (lower.includes('meditat')) copingAttempts.push('meditation');

    return {
      intent,
      clarified_to: clarifiedTo,
      triggers,
      coping_attempts: copingAttempts,
      provenance: { adapter: 'mock', model: 'deberta-intent-v2', is_mock: true }
    };
  }

  async analyzeSafety(content, detectedEmotions = null, biometrics = null) {
    const lower = content.toLowerCase();
    let severityFlag = 'normal';
    let redZoneTriggered = false;
    let crisisLanguageDetected = false;
    let reason = 'Normal emotional expression detected.';

    const crisisKeywords = ['suicide', 'kill myself', 'end my life', 'want to die', 'better off dead', 'no reason to live'];
    for (const kw of crisisKeywords) {
      if (lower.includes(kw)) {
        crisisLanguageDetected = true;
        severityFlag = 'high';
        redZoneTriggered = true;
        reason = 'High-priority distress language detected. Supportive resources indicated.';
        break;
      }
    }

    if (!crisisLanguageDetected) {
      const isSevereEmotion = detectedEmotions && detectedEmotions.sentiment_score < -0.8 && detectedEmotions.confidence > 0.85;
      const isPoorSleep = biometrics && biometrics.sleep_hours !== null && biometrics.sleep_hours < 4.5;

      if (isSevereEmotion && isPoorSleep) {
        severityFlag = 'high';
        reason = 'Significant negative sentiment coupled with severe sleep disruption.';
      } else if (isSevereEmotion || isPoorSleep || (detectedEmotions && detectedEmotions.sentiment_score < -0.6)) {
        severityFlag = 'moderate';
        reason = 'Elevated emotional strain noted for longitudinal monitoring.';
      }
    }

    return {
      severity_flag: severityFlag,
      red_zone_triggered: redZoneTriggered,
      crisis_language_detected: crisisLanguageDetected,
      evaluation_notes: reason,
      provenance: {
        adapter: 'mock',
        is_mock: true,
        disclaimer: 'Automated signal for well-being support, not a clinical diagnosis.'
      }
    };
  }

  async generateReflection(content, primaryEmotion = 'neutral', sentimentScore = 0.0, intent = '', extractedThemes = []) {
    let promptText = 'What thoughts feel most present for you as you reflect on your day?';
    let promptType = 'cbt_clarification';
    let cbtTechnique = 'cognitive_exploration';

    if (sentimentScore < -0.4) {
      promptText = 'What specifically felt most challenging about this situation, and what helped you get through it?';
      promptType = 'cbt_clarification';
      cbtTechnique = 'cognitive_reappraisal';
    } else if (sentimentScore > 0.3) {
      promptText = 'What contributed to this positive moment, and how can you integrate more of it into your week?';
      promptType = 'cbt_positive_reinforcement';
      cbtTechnique = 'strength_amplification';
    }

    return {
      prompt_text: promptText,
      prompt_type: promptType,
      cbt_technique_used: cbtTechnique,
      provenance: { adapter: 'mock', is_mock: true }
    };
  }

  async analyzeAudio() {
    // Speech-to-text and voice emotion need the real model service; there is no rule-based stand-in
    throw voiceUnavailable('No model service is configured (set MODEL_API_BASE_URL and USE_MOCK_MODELS=false).');
  }

  async extractMemories(content, primaryEmotion = 'neutral') {
    const themes = [];
    const lower = content.toLowerCase();

    if (lower.includes('work') || lower.includes('deadline')) themes.push({ text: 'User experiences work and deadline related stress.', type: 'work_stress', score: 0.85 });
    if (lower.includes('walk') || lower.includes('music') || lower.includes('breath')) themes.push({ text: 'Active coping (walking, music, breathing) aids user emotional recovery.', type: 'coping_pattern', score: 0.8 });
    if (lower.includes('exam') || lower.includes('study')) themes.push({ text: 'Academic deadlines and exams are a consistent anxiety trigger.', type: 'exam_anxiety', score: 0.9 });

    return themes;
  }
}

/**
 * Production HTTP Model Adapter
 * Communicates with external microservice via REST API.
 */
class HttpModelAdapter {
  constructor(baseUrl, apiKey, timeoutMs) {
    this.name = 'HttpModelAdapter';
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
      }
    });
    logger.info(`Initialized HttpModelAdapter connecting to ${this.baseUrl}`);
  }

  async healthCheck() {
    try {
      const res = await this.client.get('/health');
      return { status: 'healthy', upstream: res.data };
    } catch (err) {
      logger.error('Upstream model health check failed', { error: err.message });
      return { status: 'unhealthy', error: err.message };
    }
  }

  async analyzeEmotions(content, inputSource, vocalProsody) {
    const res = await this.client.post('/api/analysis/emotions', {
      content,
      input_source: inputSource,
      vocal_prosody: vocalProsody
    });
    return res.data;
  }

  async analyzeIntent(content) {
    const res = await this.client.post('/api/analysis/intent', { content });
    return res.data;
  }

  async analyzeSafety(content, detectedEmotions, biometrics) {
    const res = await this.client.post('/api/analysis/safety', {
      content,
      detected_emotions: detectedEmotions,
      biometrics
    });
    return res.data;
  }

  async generateReflection(content, primaryEmotion, sentimentScore, intent, extractedThemes) {
    const res = await this.client.post('/api/analysis/reflection', {
      content,
      primary_emotion: primaryEmotion,
      sentiment_score: sentimentScore,
      intent,
      extracted_themes: extractedThemes
    });
    return res.data;
  }

  async extractMemories(content, primaryEmotion) {
    const res = await this.client.post('/api/analysis/memories', {
      content,
      primary_emotion: primaryEmotion
    });
    return res.data;
  }

  /** Sends a recording as multipart/form-data; returns { transcript, detected_emotions, ... }. */
  async analyzeAudio(buffer, mimeType = 'application/octet-stream', filename = 'recording.webm') {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: mimeType }), filename);
    const res = await this.client.post('/api/analysis/audio', form, {
      timeout: config.modelApi.audioTimeoutMs,
      headers: { 'Content-Type': undefined } // let axios set the multipart boundary
    });
    return res.data;
  }
}

/* ------------------------------------------------------------------ */
/* Contract validation for external model services                     */
/* ------------------------------------------------------------------ */
const { z } = require('zod');

const unitScore = z.number().min(0).max(1);
const RESULT_SCHEMAS = {
  analyzeEmotions: z
    .object({
      primary_state: z.string().min(1),
      confidence: unitScore,
      sentiment_score: z.number().min(-1).max(1),
      all_28_states: z.record(z.string(), z.number()).optional()
    })
    .passthrough(),
  analyzeIntent: z
    .object({
      intent: z.string().min(1),
      clarified_to: z.string().optional(),
      triggers: z.array(z.string()).optional(),
      coping_attempts: z.array(z.string()).optional()
    })
    .passthrough(),
  analyzeSafety: z
    .object({
      severity_flag: z.enum(['normal', 'moderate', 'high']),
      red_zone_triggered: z.boolean(),
      crisis_language_detected: z.boolean()
    })
    .passthrough(),
  generateReflection: z.object({ prompt_text: z.string().min(1), prompt_type: z.string().optional() }).passthrough(),
  extractMemories: z.array(z.object({ text: z.string().min(1), type: z.string().min(1), score: unitScore }).passthrough()),
  analyzeAudio: z
    .object({
      transcript: z.string(),
      detected_emotions: z
        .object({
          primary_state: z.string().min(1),
          confidence: unitScore,
          sentiment_score: z.number().min(-1).max(1),
          all_28_states: z.record(z.string(), z.number()).optional()
        })
        .passthrough()
    })
    .passthrough()
};

const SEVERITY_RANK = { normal: 0, moderate: 1, high: 2 };

/** Accepts either a bare result or this API's own envelope ({ success, data }). */
const unwrap = (body) => (body && typeof body === 'object' && 'success' in body && 'data' in body ? body.data : body);

/**
 * Wraps the configured adapter:
 *  - external results are unwrapped and validated against the contract above
 *  - on timeout, HTTP error or an invalid result, the built-in rule-based adapter is used instead
 *    (logged and marked in provenance), so journaling and crisis detection never silently stop
 *  - safety results are never less severe than the built-in crisis-language check
 */
class ModelService {
  constructor(adapter) {
    this.fallback = new MockModelAdapter();
    if (adapter) this.adapter = adapter;
    else if (config.modelApi.useMock || !config.modelApi.baseUrl) this.adapter = this.fallback;
    else this.adapter = new HttpModelAdapter(config.modelApi.baseUrl, config.modelApi.apiKey, config.modelApi.timeoutMs);
  }

  get usingFallbackOnly() {
    return this.adapter === this.fallback;
  }

  async healthCheck() {
    return this.adapter.healthCheck();
  }

  async _call(method, args) {
    if (this.usingFallbackOnly) return this.fallback[method](...args);
    try {
      const result = unwrap(await this.adapter[method](...args));
      const parsed = RESULT_SCHEMAS[method].safeParse(result);
      if (!parsed.success) {
        logger.error('Model service returned an invalid result; using built-in analysis', {
          method,
          issue: parsed.error.errors[0]?.message
        });
        return this._fallback(method, args, 'invalid_response');
      }
      return parsed.data;
    } catch (err) {
      logger.error('Model service unavailable; using built-in analysis', { method, error: err.message });
      return this._fallback(method, args, 'upstream_error');
    }
  }

  async _fallback(method, args, reason) {
    const result = await this.fallback[method](...args);
    if (result && !Array.isArray(result) && typeof result === 'object') {
      result.provenance = { ...(result.provenance || {}), adapter: 'fallback', fallback_reason: reason };
    }
    return result;
  }

  async analyzeEmotions(content, inputSource, vocalProsody) {
    return this._call('analyzeEmotions', [content, inputSource, vocalProsody]);
  }

  async analyzeIntent(content) {
    return this._call('analyzeIntent', [content]);
  }

  async analyzeSafety(content, detectedEmotions, biometrics) {
    const result = await this._call('analyzeSafety', [content, detectedEmotions, biometrics]);
    if (this.usingFallbackOnly) return result;
    const baseline = await this.fallback.analyzeSafety(content, detectedEmotions, biometrics);
    if (baseline.crisis_language_detected && SEVERITY_RANK[result.severity_flag] < SEVERITY_RANK.high) {
      logger.warn('Crisis language detected by the built-in check; escalating model safety result');
      return { ...result, severity_flag: 'high', red_zone_triggered: true, crisis_language_detected: true };
    }
    return result;
  }

  async generateReflection(content, primaryEmotion, sentimentScore, intent, extractedThemes) {
    return this._call('generateReflection', [content, primaryEmotion, sentimentScore, intent, extractedThemes]);
  }

  async extractMemories(content, primaryEmotion) {
    return this._call('extractMemories', [content, primaryEmotion]);
  }

  /**
   * Voice journal analysis (Whisper transcript + WavLM voice emotion, fused with the text model
   * when the service has it). Unlike the text calls there is no fallback: without the model
   * service a recording cannot be transcribed, so this throws a 503 VOICE_ANALYSIS_UNAVAILABLE.
   */
  async analyzeAudio(buffer, mimeType, filename) {
    if (this.usingFallbackOnly) return this.fallback.analyzeAudio();
    let result;
    try {
      result = unwrap(await this.adapter.analyzeAudio(buffer, mimeType, filename));
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      logger.error('Voice analysis failed', { status, error: err.message });
      if (status === 400 || status === 413 || status === 422) {
        const clientErr = new Error(typeof detail === 'string' ? detail : 'The recording could not be analysed.');
        clientErr.status = 422;
        clientErr.code = 'AUDIO_NOT_ANALYSABLE';
        clientErr.expose = true;
        throw clientErr;
      }
      throw voiceUnavailable('The voice analysis service is unavailable. Please try again or type your entry.');
    }
    const parsed = RESULT_SCHEMAS.analyzeAudio.safeParse(result);
    if (!parsed.success) {
      logger.error('Model service returned an invalid audio result', { issue: parsed.error.errors[0]?.message });
      throw voiceUnavailable('The voice analysis service returned an unexpected result.');
    }
    return parsed.data;
  }
}

module.exports = new ModelService();
module.exports.ModelService = ModelService;
module.exports.RESULT_SCHEMAS = RESULT_SCHEMAS;

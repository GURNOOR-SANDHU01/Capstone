const modelService = require('../services/modelService');
const { success } = require('../utils/apiResponse');
const { scrubPII } = require('../services/journalService');

// Text is PII-scrubbed before it reaches any model adapter (mock or external HTTP service)

async function analyzeEmotions(req, res, next) {
  try {
    const { content, input_source, vocal_prosody } = req.body;
    const result = await modelService.analyzeEmotions(scrubPII(content), input_source, vocal_prosody);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function analyzeIntent(req, res, next) {
  try {
    const { content } = req.body;
    const result = await modelService.analyzeIntent(scrubPII(content));
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function analyzeSafety(req, res, next) {
  try {
    const { content, detected_emotions, biometrics } = req.body;
    const result = await modelService.analyzeSafety(scrubPII(content), detected_emotions, biometrics);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function analyzeReflection(req, res, next) {
  try {
    const { content, primary_emotion, sentiment_score, intent, extracted_themes } = req.body;
    const result = await modelService.generateReflection(
      scrubPII(content),
      primary_emotion,
      sentiment_score,
      intent,
      extracted_themes
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

// Voice preview: transcribe + score a recording without storing anything (audio is discarded)
async function analyzeAudio(req, res, next) {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      const err = new Error('Send the recording as the request body with an audio/* Content-Type.');
      err.status = 400;
      err.code = 'AUDIO_REQUIRED';
      throw err;
    }
    const mimeType = (req.get('content-type') || 'application/octet-stream').split(';')[0];
    const result = await modelService.analyzeAudio(req.body, mimeType, 'recording');
    return success(res, {
      transcript: scrubPII(result.transcript || ''),
      emotion: result.emotion ?? result.detected_emotions.primary_state,
      decision: result.decision ?? null,
      text_says: result.text_says ?? null,
      voice_says: result.voice_says ?? null,
      voice_raw: result.voice_raw ?? null,
      voice_scores: result.voice_scores || null,
      fused_scores: result.fused_scores || null,
      fine_grained_emotions: result.fine_grained_emotions || [],
      detected_emotions: result.detected_emotions
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  analyzeAudio,
  analyzeEmotions,
  analyzeIntent,
  analyzeSafety,
  analyzeReflection
};

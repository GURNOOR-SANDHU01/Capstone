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

module.exports = {
  analyzeEmotions,
  analyzeIntent,
  analyzeSafety,
  analyzeReflection
};

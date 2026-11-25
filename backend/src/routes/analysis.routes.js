const express = require('express');
const analysisController = require('../controllers/analysisController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { analysisLimiter } = require('../middleware/rateLimiter');
const {
  analyzeEmotionsSchema,
  analyzeIntentSchema,
  analyzeSafetySchema,
  analyzeReflectionSchema
} = require('../schemas/analysis.schema');

const router = express.Router();

router.use(authenticate);
router.use(analysisLimiter);

router.post('/emotions', validate(analyzeEmotionsSchema, 'body'), analysisController.analyzeEmotions);
router.post('/intent', validate(analyzeIntentSchema, 'body'), analysisController.analyzeIntent);
router.post('/safety', validate(analyzeSafetySchema, 'body'), analysisController.analyzeSafety);
router.post('/reflection', validate(analyzeReflectionSchema, 'body'), analysisController.analyzeReflection);
router.post(
  '/audio',
  express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '15mb' }),
  analysisController.analyzeAudio
);

module.exports = router;

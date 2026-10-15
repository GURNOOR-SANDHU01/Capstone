const { z } = require('zod');

const analyzeEmotionsSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  input_source: z.enum(['text', 'audio']).default('text'),
  vocal_prosody: z
    .object({
      pitch_std: z.number().optional(),
      energy_level: z.number().optional()
    })
    .nullable()
    .optional()
});

const analyzeIntentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000)
});

const analyzeSafetySchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  detected_emotions: z
    .object({
      primary_state: z.string().optional(),
      confidence: z.number().optional(),
      sentiment_score: z.number().optional()
    })
    .optional(),
  biometrics: z
    .object({
      sleep_hours: z.number().optional(),
      stress_level: z.number().optional()
    })
    .optional()
});

const analyzeReflectionSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
  primary_emotion: z.string().optional(),
  sentiment_score: z.number().optional(),
  intent: z.string().optional(),
  extracted_themes: z.array(z.string()).optional()
});

module.exports = {
  analyzeEmotionsSchema,
  analyzeIntentSchema,
  analyzeSafetySchema,
  analyzeReflectionSchema
};

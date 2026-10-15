const { z } = require('zod');

const detectedEmotionsSchema = z.object({
  primary_state: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sentiment_score: z.number().min(-1).max(1),
  all_28_states: z.record(z.string(), z.number()).default({}),
  vocal_prosody: z
    .object({
      pitch_std: z.number().optional(),
      energy_level: z.number().optional()
    })
    .nullable()
    .optional(),
  corrected_emotion: z.string().nullable().optional(),
  correction_reason: z.string().nullable().optional(),
  user_correction_timestamp: z.any().nullable().optional()
});

const intentObjectSchema = z.object({
  intent: z.string().min(1),
  clarified_to: z.string().optional().default(''),
  triggers: z.array(z.string()).default([]),
  coping_attempts: z.array(z.string()).default([])
});

const reflectionPromptSchema = z.object({
  prompt_text: z.string().min(1),
  prompt_type: z.string().default('cbt_clarification'),
  generated_at: z.any().optional(),
  user_response: z.string().nullable().optional(),
  user_response_timestamp: z.any().nullable().optional(),
  was_helpful: z.boolean().nullable().optional()
});

const biometricsSchema = z.object({
  resting_hr: z.number().nonnegative().optional(),
  hr_variability: z.number().nonnegative().optional(),
  sleep_hours: z.number().min(0).max(24).optional(),
  sleep_quality_score: z.number().min(0).max(1).optional(),
  steps: z.number().int().nonnegative().optional(),
  stress_level: z.number().min(1).max(10).optional(),
  sync_timestamp: z.any().optional()
});

const safetyFlagsSchema = z.object({
  severity_flag: z.enum(['normal', 'moderate', 'high']).default('normal'),
  red_zone_triggered: z.boolean().default(false),
  crisis_language_detected: z.boolean().default(false)
});

const visibilitySchema = z.enum(['private', 'shared']);
const themesSchema = z.array(z.string().trim().min(1).max(50)).max(20);

/**
 * Journal creation accepts only user-authored input. Everything derived from it
 * (masked_content, detected_emotions, intent_object, safety_flags, reflection_prompt)
 * is computed server-side; sending those fields is rejected (.strict()).
 */
const createJournalEntrySchema = z.object({
  content: z.string().trim().min(1, 'Journal content is required').max(10000),
  entry_type: z.string().max(50).default('daily_journal'),
  input_source: z.enum(['text', 'audio']).default('text'),
  audio_transcript_confidence: z.number().min(0).max(1).nullable().optional(),
  vocal_prosody: z
    .object({
      pitch_std: z.number().optional(),
      energy_level: z.number().optional()
    })
    .strict()
    .nullable()
    .optional(),
  extracted_themes: themesSchema.optional(),
  entry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  biometrics: biometricsSchema.omit({ sync_timestamp: true }).strict().nullable().optional(),
  visibility: visibilitySchema.default('private'),
  // The emotion the user picked themselves; stored as detected_emotions.corrected_emotion
  self_reported_emotion: z.string().trim().min(1).max(50).optional(),
  // The user's own reflection text; PII-scrubbed and stored as reflection_prompt.user_response
  reflection_response: z.string().trim().min(1).max(2000).optional()
}).strict();

/**
 * Owners may update only user-controlled fields. AI/safety outputs are immutable from the client.
 */
const updateJournalEntrySchema = z.object({
  // New text is masked and re-analysed server-side, exactly like a new entry
  content: z.string().trim().min(1).max(10000).optional(),
  extracted_themes: themesSchema.optional(),
  visibility: visibilitySchema.optional(),
  reflection_prompt: z
    .object({
      user_response: z.string().trim().min(1).max(2000).optional(),
      was_helpful: z.boolean().optional()
    })
    .strict()
    .optional(),
  detected_emotions: z
    .object({
      corrected_emotion: z.string().trim().min(1).max(50),
      correction_reason: z.string().max(500).optional()
    })
    .strict()
    .optional()
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: 'At least one updatable field must be provided'
});

const correctEmotionSchema = z.object({
  corrected_emotion: z.string().min(1, 'Corrected emotion name is required'),
  correction_reason: z.string().max(500).optional()
});

const queryJournalEntriesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  severity: z.enum(['normal', 'moderate', 'high']).optional()
});

module.exports = {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  correctEmotionSchema,
  queryJournalEntriesSchema,
  detectedEmotionsSchema,
  intentObjectSchema,
  reflectionPromptSchema,
  biometricsSchema,
  safetyFlagsSchema
};

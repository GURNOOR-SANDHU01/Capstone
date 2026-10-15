const { z } = require('zod');

const syncBiometricsSchema = z.object({
  provider: z.enum(['google_fit', 'apple_health'], {
    errorMap: () => ({ message: "Provider must be 'google_fit' or 'apple_health'" })
  }),
  metrics: z.object({
    resting_hr: z.number().nonnegative().optional(),
    hr_variability: z.number().nonnegative().optional(),
    sleep_hours: z.number().min(0).max(24).optional(),
    sleep_quality_score: z.number().min(0).max(1).optional(),
    steps: z.number().int().nonnegative().optional(),
    stress_level: z.number().min(1).max(10).optional()
  }).optional(),
  date_range: z.string().default('last 24 hours')
});

const queryBiometricsSchema = z.object({
  provider: z.enum(['google_fit', 'apple_health']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

module.exports = {
  syncBiometricsSchema,
  queryBiometricsSchema
};

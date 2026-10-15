const { z } = require('zod');

const createMemorySchema = z.object({
  memory_text: z.string().min(1, 'Memory text is required').max(1000),
  memory_type: z.string().min(1, 'Memory type is required'),
  importance_score: z.number().min(0).max(1).default(0.5),
  metadata: z
    .object({
      associated_entry_id: z.string().optional().default(''),
      extraction_confidence: z.number().min(0).max(1).default(0.5)
    })
    .default({})
});

const memoryFeedbackSchema = z.object({
  user_feedback: z.enum(['agree', 'disagree', 'partially'], {
    errorMap: () => ({ message: "user_feedback must be 'agree', 'disagree', or 'partially'" })
  }),
  user_notes: z.string().max(500).optional(),
  is_accurate: z.boolean().optional()
});

const queryMemoriesSchema = z.object({
  memory_type: z.string().optional(),
  min_importance: z.coerce.number().min(0).max(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

module.exports = {
  createMemorySchema,
  memoryFeedbackSchema,
  queryMemoriesSchema
};

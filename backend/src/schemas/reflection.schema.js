const { z } = require('zod');

const createReflectionPromptSchema = z.object({
  entry_id: z.string().optional().default(''),
  prompt_text: z.string().min(1, 'Prompt text is required'),
  prompt_type: z.string().default('cbt_clarification'),
  cbt_technique_used: z.string().default('cognitive_exploration')
});

const updateReflectionResponseSchema = z.object({
  user_response: z.string().min(1, 'Response text cannot be empty').max(2000).optional(),
  was_helpful: z.boolean().optional(),
  helpful_rating: z.number().int().min(1).max(5).optional()
}).refine((data) => data.user_response !== undefined || data.was_helpful !== undefined || data.helpful_rating !== undefined, {
  message: 'At least one field (user_response, was_helpful, or helpful_rating) must be provided'
});

const queryReflectionPromptsSchema = z.object({
  entry_id: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

module.exports = {
  createReflectionPromptSchema,
  updateReflectionResponseSchema,
  queryReflectionPromptsSchema
};

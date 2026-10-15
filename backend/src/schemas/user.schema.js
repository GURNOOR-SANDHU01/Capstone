const { z } = require('zod');

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  cbt_alignment: z.boolean().optional(),
  daily_reminder_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')
    .optional(),
  emergency_contacts: z.array(z.string().min(5)).optional()
});

const structuredMemorySchema = z.object({
  sleep_goal: z.string().optional(),
  preferred_coping_strategies: z.array(z.string()).optional()
});

const resilienceStreaksSchema = z.object({
  current_streak: z.number().int().nonnegative().optional(),
  longest_streak: z.number().int().nonnegative().optional(),
  last_check_in: z.any().optional()
});

const createUserProfileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100),
  email: z.string().email('Invalid email address'),
  preferences: preferencesSchema.optional(),
  structured_memory: structuredMemorySchema.optional(),
  resilience_streaks: resilienceStreaksSchema.optional()
});

const phoneSchema = z.string().trim().min(5).max(30).regex(/^[0-9+()\-.\s]+$/, 'Invalid phone number');

const updateUserProfileSchema = z.object({
  full_name: z.string().trim().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  language: z.string().trim().min(2).max(30).optional(),
  preferences: preferencesSchema.partial().optional(),
  structured_memory: structuredMemorySchema.partial().optional(),
  resilience_streaks: resilienceStreaksSchema.partial().optional()
}).strict('Protected fields like role, email, and uid cannot be modified directly');

/**
 * Patient onboarding / intake. Risk is evaluated server-side from the answers;
 * the client never supplies a risk category or completion state.
 */
const onboardingSchema = z.object({
  basic_info: z.object({
    full_name: z.string().trim().min(1).max(100),
    phone: phoneSchema,
    language: z.string().trim().min(2).max(30).default('English')
  }).strict(),
  emergency_contact: z.object({
    name: z.string().trim().min(1).max(100),
    relation: z.string().trim().min(1).max(50),
    phone: phoneSchema
  }).strict(),
  wellness_answers: z.object({
    mood: z.string().max(30).optional(),
    anxiety: z.enum(['low', 'mild', 'severe']).optional(),
    sleep: z.enum(['normal', 'moderate', 'severe']).optional(),
    energy: z.string().max(30).optional()
  }).strict(),
  safety_answers: z.object({
    crisis_thoughts: z.enum(['none', 'occasional', 'frequent']),
    immediate_risk: z.enum(['yes', 'no']).default('no')
  }).strict(),
  privacy_consent: z.literal(true, {
    errorMap: () => ({ message: 'Privacy consent is required to complete onboarding' })
  })
}).strict();

const deleteUserSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Explicit confirmation { confirm: true } is required for account deletion' })
  }),
  reason: z.string().max(500).optional()
});

module.exports = {
  createUserProfileSchema,
  updateUserProfileSchema,
  deleteUserSchema,
  onboardingSchema,
  preferencesSchema,
  structuredMemorySchema,
  resilienceStreaksSchema
};

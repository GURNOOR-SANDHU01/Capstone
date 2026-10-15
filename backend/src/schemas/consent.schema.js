const { z } = require('zod');

const grantConsentSchema = z.object({
  therapist_id: z.string().min(1, 'Therapist UID is required'),
  access_level: z.enum([
    'longitudinal_summary_only',
    'full_reflection_access',
    'emergency_only'
  ]).default('longitudinal_summary_only'),
  red_flag_alerts_enabled: z.boolean().default(true),
  feature_affected: z.string().default('therapist_longitudinal_view')
});

const revokeConsentSchema = z.object({
  therapist_id: z.string().min(1, 'Therapist UID is required'),
  feature_affected: z.string().default('therapist_longitudinal_view')
});

module.exports = {
  grantConsentSchema,
  revokeConsentSchema
};

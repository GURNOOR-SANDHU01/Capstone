const { z } = require('zod');

const updateSafetyAlertSchema = z.object({
  alert_status: z.enum(['viewed', 'resolved'], {
    errorMap: () => ({ message: "Status must be 'viewed' or 'resolved'" })
  }),
  therapist_action_taken: z.string().max(1000).optional()
});

const querySafetyAlertsSchema = z.object({
  status: z.enum(['pending', 'viewed', 'resolved']).optional(),
  severity: z.enum(['moderate', 'high', 'critical']).optional(),
  patient_id: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

module.exports = {
  updateSafetyAlertSchema,
  querySafetyAlertsSchema
};

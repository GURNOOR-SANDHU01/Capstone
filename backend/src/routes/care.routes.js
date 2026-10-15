/**
 * Appointments, care instructions, secure messaging and clinics.
 * Mounted at /api by app.js.
 */
const express = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const appointmentService = require('../services/appointmentService');
const careService = require('../services/careService');
const { success } = require('../utils/apiResponse');

const router = express.Router();

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return success(res, await fn(req), status);
  } catch (err) {
    next(err);
  }
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeSlot = z.string().trim().min(3).max(20);
const shortText = (max) => z.string().trim().min(1).max(max);

const createAppointmentSchema = z
  .object({
    doctor_id: shortText(128).optional(),
    patient_id: shortText(128).optional(),
    date: isoDate,
    time: timeSlot,
    type: z.enum(['Video Consultation', 'In-person Consultation', 'Follow-up', 'Initial Evaluation']).default('Video Consultation'),
    reason: shortText(500),
    notes: z.string().trim().max(1000).optional(),
    clinic_name: z.string().trim().max(100).optional()
  })
  .strict();

const appointmentActionSchema = z
  .object({
    action: z.enum(['confirm', 'reject', 'reschedule', 'accept_reschedule', 'cancel', 'complete']),
    reason: z.string().trim().max(500).optional(),
    date: isoDate.optional(),
    time: timeSlot.optional(),
    note: z.string().trim().max(500).optional()
  })
  .strict();

const createInstructionSchema = z
  .object({
    patient_id: shortText(128),
    type: z.enum(['Medication Reminder', 'Wellness Check-in', 'Exercise Plan', 'Sleep Hygiene', 'Other']),
    medication_name: z.string().trim().max(200).optional(),
    schedule: shortText(200),
    start_date: isoDate,
    end_date: isoDate.optional(),
    notes: z.string().trim().max(1000).optional()
  })
  .strict();

const instructionStatusSchema = z.object({ status: z.enum(['Active', 'Paused', 'Completed']) }).strict();
const messageQuerySchema = z.object({ with: shortText(128) });
const sendMessageSchema = z.object({ to: shortText(128), text: shortText(2000) }).strict();
const createClinicSchema = z
  .object({
    name: shortText(100),
    location: shortText(150),
    contact: shortText(50),
    status: z.enum(['Active', 'Inactive']).optional()
  })
  .strict();

router.use(authenticate);

// Appointments
// Appointment details (incl. the reason for the visit) are visible to the two participants only;
// admins see aggregate counts via /api/admin/stats.
router.get('/appointments', requireRole(ROLES.PATIENT, ROLES.DOCTOR), handle((req) => appointmentService.list(req.user)));
router.post(
  '/appointments',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate(createAppointmentSchema),
  handle((req) => appointmentService.create(req.user, req.body), 201)
);
router.post(
  '/appointments/:id/actions',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate(appointmentActionSchema),
  handle((req) => appointmentService.act(req.user, req.params.id, req.body))
);

// Care instructions / reminders
router.get('/care-instructions', requireRole(ROLES.PATIENT, ROLES.DOCTOR), handle((req) => careService.listInstructions(req.user)));
router.post(
  '/care-instructions',
  requireRole(ROLES.DOCTOR),
  validate(createInstructionSchema),
  handle((req) => careService.createInstruction(req.user, req.body), 201)
);
router.patch(
  '/care-instructions/:id',
  requireRole(ROLES.DOCTOR),
  validate(instructionStatusSchema),
  handle((req) => careService.updateInstructionStatus(req.user, req.params.id, req.body.status))
);

// Secure messaging (patient <-> doctor with active consent)
router.get(
  '/messages',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate(messageQuerySchema, 'query'),
  handle((req) => careService.listMessages(req.user, req.query.with))
);
router.post(
  '/messages',
  requireRole(ROLES.PATIENT, ROLES.DOCTOR),
  validate(sendMessageSchema),
  handle((req) => careService.sendMessage(req.user, req.body.to, req.body.text), 201)
);

// Clinics
router.get('/clinics', handle(() => careService.listClinics()));
router.post('/clinics', requireRole(ROLES.ADMIN), validate(createClinicSchema), handle((req) => careService.createClinic(req.user, req.body), 201));

module.exports = router;

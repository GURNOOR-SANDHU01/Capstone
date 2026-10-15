const express = require('express');
const { z } = require('zod');
const adminController = require('../controllers/adminController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/authorize');
const { ROLES, ALL_ROLES } = require('../config/roles');

const router = express.Router();

router.use(authenticate);
router.use(requireRole(ROLES.ADMIN));

const listUsersQuery = z.object({ role: z.enum(ALL_ROLES).optional() });
const setRoleBody = z.object({ role: z.enum(ALL_ROLES) }).strict();
const doctorProfileBody = z
  .object({
    specialization: z.string().trim().min(1).max(100).optional(),
    clinic_id: z.string().trim().min(1).max(100).optional(),
    clinic_name: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['Active', 'On Leave', 'Inactive']).optional()
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' });
const auditQuery = z.object({ limit: z.coerce.number().int().positive().max(500).default(100) });

router.get('/users', validate(listUsersQuery, 'query'), adminController.listUsers);
router.post('/users/:uid/role', validate(setRoleBody), adminController.setRole);
router.patch('/doctors/:uid', validate(doctorProfileBody), adminController.updateDoctorProfile);
const addDoctorBody = z
  .object({
    email: z.string().trim().email(),
    specialization: z.string().trim().min(1).max(100).optional(),
    clinic_name: z.string().trim().min(1).max(100).optional()
  })
  .strict();

router.post('/doctors', validate(addDoctorBody), adminController.addDoctor);
router.get('/stats', adminController.stats);
router.get('/audit-logs', validate(auditQuery, 'query'), adminController.listAuditLogs);

module.exports = router;

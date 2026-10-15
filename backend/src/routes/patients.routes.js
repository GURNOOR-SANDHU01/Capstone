const express = require('express');
const { z } = require('zod');
const patientController = require('../controllers/patientController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');

const router = express.Router();

const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

router.use(authenticate);
router.use(requireRole(ROLES.DOCTOR));

router.get('/', patientController.listMyPatients);
router.get('/:patientId/journal-entries', validate(pageQuerySchema, 'query'), patientController.listSharedJournal);

module.exports = router;

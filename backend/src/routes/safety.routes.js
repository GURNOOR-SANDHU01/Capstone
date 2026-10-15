const express = require('express');
const safetyController = require('../controllers/safetyController');
const authenticate = require('../middleware/authenticate');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const validate = require('../middleware/validate');
const {
  updateSafetyAlertSchema,
  querySafetyAlertsSchema
} = require('../schemas/safety.schema');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(querySafetyAlertsSchema, 'query'), safetyController.listAlerts);
router.patch(
  '/:alertId',
  requireRole(ROLES.DOCTOR, ROLES.ADMIN),
  validate(updateSafetyAlertSchema, 'body'),
  safetyController.updateAlert
);

module.exports = router;

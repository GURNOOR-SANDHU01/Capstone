const express = require('express');
const consentController = require('../controllers/consentController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const {
  grantConsentSchema,
  revokeConsentSchema
} = require('../schemas/consent.schema');

const router = express.Router();

router.use(authenticate);
// Consent is granted by a patient over their own data
router.use(requireRole(ROLES.PATIENT));

router.get('/', consentController.getStatus);
router.post('/therapist', validate(grantConsentSchema, 'body'), consentController.grantTherapist);
router.delete('/therapist', validate(revokeConsentSchema, 'body'), consentController.revokeTherapist);

module.exports = router;

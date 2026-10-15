const express = require('express');
const biometricController = require('../controllers/biometricController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const {
  syncBiometricsSchema,
  queryBiometricsSchema
} = require('../schemas/biometric.schema');

const router = express.Router();

router.use(authenticate);

router.post('/sync', validate(syncBiometricsSchema, 'body'), biometricController.sync);
router.get('/', validate(queryBiometricsSchema, 'query'), biometricController.list);

module.exports = router;

const express = require('express');
const healthController = require('../controllers/healthController');

const router = express.Router();

router.get('/', healthController.getHealth);
router.get('/firebase', healthController.getFirebaseHealth);
router.get('/model', healthController.getModelHealth);

module.exports = router;

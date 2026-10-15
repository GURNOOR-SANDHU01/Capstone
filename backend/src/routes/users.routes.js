const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { updateUserProfileSchema, deleteUserSchema, onboardingSchema } = require('../schemas/user.schema');

const router = express.Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.patch('/me', validate(updateUserProfileSchema), userController.updateMe);
router.put('/me/onboarding', validate(onboardingSchema), userController.completeOnboarding);
router.delete('/me', validate(deleteUserSchema), userController.deleteMe);

module.exports = router;

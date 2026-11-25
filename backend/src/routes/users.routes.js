const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { auth } = require('../config/firebase/admin');
const { updateUserProfileSchema, deleteUserSchema, onboardingSchema } = require('../schemas/user.schema');

const router = express.Router();

router.use(authenticate);

router.get('/me', userController.getMe);
// Server-side session invalidation: revokes the user's refresh tokens, so existing ID tokens
// are rejected by authenticate() (checkRevoked) and no new ones can be minted.
router.post('/me/logout', async (req, res, next) => {
  try {
    await auth.revokeRefreshTokens(req.user.uid);
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});
router.patch('/me', validate(updateUserProfileSchema), userController.updateMe);
router.put('/me/onboarding', validate(onboardingSchema), userController.completeOnboarding);
router.delete('/me', validate(deleteUserSchema), userController.deleteMe);

module.exports = router;

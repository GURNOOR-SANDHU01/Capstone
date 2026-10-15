const userService = require('../services/userService');
const { success } = require('../utils/apiResponse');

async function getMe(req, res, next) {
  try {
    const profile = await userService.getProfile(req.user);
    return success(res, profile);
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const updated = await userService.updateProfile(req.user, req.body);
    return success(res, updated);
  } catch (err) {
    next(err);
  }
}

async function completeOnboarding(req, res, next) {
  try {
    const result = await userService.completeOnboarding(req.user, req.body);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

async function deleteMe(req, res, next) {
  try {
    const result = await userService.deleteAccount(req.user.uid, req.body);
    return success(res, {
      message: 'Account and associated records successfully purged.',
      ...result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  updateMe,
  completeOnboarding,
  deleteMe
};

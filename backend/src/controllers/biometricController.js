const biometricService = require('../services/biometricService');
const { success } = require('../utils/apiResponse');

async function sync(req, res, next) {
  try {
    const result = await biometricService.syncBiometrics(req.user.uid, req.body);
    return success(res, result, 201);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await biometricService.listLogs(req.user.uid, req.query);
    return success(res, result.logs, 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  sync,
  list
};

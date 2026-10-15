const safetyService = require('../services/safetyService');
const { success } = require('../utils/apiResponse');

async function listAlerts(req, res, next) {
  try {
    const result = await safetyService.listAlerts(req.user, req.query);
    return success(res, result.alerts, 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function updateAlert(req, res, next) {
  try {
    const updated = await safetyService.updateAlert(req.params.alertId, req.user, req.body);
    return success(res, updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAlerts,
  updateAlert
};

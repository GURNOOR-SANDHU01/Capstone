const consentService = require('../services/consentService');
const { success } = require('../utils/apiResponse');

async function getStatus(req, res, next) {
  try {
    const status = await consentService.getConsentStatus(req.user.uid);
    return success(res, status);
  } catch (err) {
    next(err);
  }
}

async function grantTherapist(req, res, next) {
  try {
    const meta = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown'
    };
    const result = await consentService.grantTherapistConsent(req.user.uid, req.body, meta);
    return success(res, result, 201);
  } catch (err) {
    next(err);
  }
}

async function revokeTherapist(req, res, next) {
  try {
    const meta = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'unknown'
    };
    const result = await consentService.revokeTherapistConsent(req.user.uid, req.body, meta);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  grantTherapist,
  revokeTherapist
};

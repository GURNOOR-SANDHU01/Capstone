const consentService = require('../services/consentService');
const journalService = require('../services/journalService');
const { success } = require('../utils/apiResponse');

/** Doctor: patients who currently consent to share with the caller. */
async function listMyPatients(req, res, next) {
  try {
    const patients = await consentService.listPatientsForDoctor(req.user.uid);
    return success(res, patients);
  } catch (err) {
    next(err);
  }
}

/** Doctor: a consenting patient's shared entries, projected by access level. */
async function listSharedJournal(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await journalService.listSharedEntriesForDoctor(req.user, req.params.patientId, { page, limit });
    return success(res, result.entries, 200, { ...result.pagination, access: result.access });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMyPatients,
  listSharedJournal
};

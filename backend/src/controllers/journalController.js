const journalService = require('../services/journalService');
const { success } = require('../utils/apiResponse');

async function create(req, res, next) {
  try {
    const entry = await journalService.createEntry(req.user.uid, req.body);
    return success(res, entry, 201);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await journalService.listEntries(req.user.uid, req.query);
    return success(res, result.entries, 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const entry = await journalService.getEntry(req.params.entryId, req.user);
    return success(res, entry);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const updated = await journalService.updateEntry(
      req.params.entryId,
      req.user.uid,
      req.body
    );
    return success(res, updated);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await journalService.deleteEntry(req.params.entryId, req.user.uid);
    return success(res, { message: 'Journal entry successfully deleted' }, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  getById,
  update,
  remove
};

const journalService = require('../services/journalService');
const { success, error } = require('../utils/apiResponse');

async function create(req, res, next) {
  try {
    const entry = await journalService.createEntry(req.user.uid, req.body);
    return success(res, entry, 201);
  } catch (err) {
    next(err);
  }
}

async function createVoice(req, res, next) {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return error(res, 'AUDIO_REQUIRED', 'Send the recording as the request body with an audio/* Content-Type.', 400);
    }
    const mimeType = (req.get('content-type') || 'application/octet-stream').split(';')[0];
    const ext = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a' }[mimeType] || 'bin';
    const q = req.query;
    const entry = await journalService.createVoiceEntry(
      req.user.uid,
      { buffer: req.body, mimeType, filename: `recording.${ext}` },
      {
        visibility: q.visibility,
        self_reported_emotion: q.self_reported_emotion,
        reflection_response: q.reflection_response,
        extracted_themes: q.tags
      }
    );
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
  createVoice,
  list,
  getById,
  update,
  remove
};

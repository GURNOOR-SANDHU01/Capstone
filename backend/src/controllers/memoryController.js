const memoryService = require('../services/memoryService');
const { success } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const result = await memoryService.listMemories(req.user.uid, req.query);
    return success(res, result.memories, 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const memory = await memoryService.createMemory(req.user.uid, req.body);
    return success(res, memory, 201);
  } catch (err) {
    next(err);
  }
}

async function submitFeedback(req, res, next) {
  try {
    const result = await memoryService.submitFeedback(
      req.params.memoryId,
      req.user.uid,
      req.body
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  submitFeedback
};

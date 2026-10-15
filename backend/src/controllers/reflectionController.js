const reflectionService = require('../services/reflectionService');
const { success } = require('../utils/apiResponse');

async function list(req, res, next) {
  try {
    const result = await reflectionService.listPrompts(req.user.uid, req.query);
    return success(res, result.prompts, 200, result.pagination);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const prompt = await reflectionService.createPrompt(req.user.uid, req.body);
    return success(res, prompt, 201);
  } catch (err) {
    next(err);
  }
}

async function respond(req, res, next) {
  try {
    const updated = await reflectionService.respondToPrompt(
      req.params.promptId,
      req.user.uid,
      req.body
    );
    return success(res, updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  respond
};

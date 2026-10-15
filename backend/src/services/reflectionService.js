const reflectionRepository = require('../repositories/reflectionRepository');

class ReflectionService {
  async listPrompts(userId, query) {
    return reflectionRepository.listByUser(userId, query);
  }

  async createPrompt(userId, data) {
    return reflectionRepository.create(userId, data);
  }

  async respondToPrompt(promptId, userId, responseData) {
    const res = await reflectionRepository.updateResponse(promptId, userId, responseData);
    if (res.notFound) {
      const err = new Error('Reflection prompt not found');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (res.forbidden) {
      const err = new Error('Access denied. You do not own this reflection prompt.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    return res.data;
  }
}

module.exports = new ReflectionService();

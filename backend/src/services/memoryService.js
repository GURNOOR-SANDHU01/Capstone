const memoryRepository = require('../repositories/memoryRepository');

class MemoryService {
  async listMemories(userId, query) {
    return memoryRepository.listByUser(userId, query);
  }

  async createMemory(userId, data) {
    return memoryRepository.create(userId, data);
  }

  async submitFeedback(memoryId, userId, feedbackData) {
    const res = await memoryRepository.addFeedback(memoryId, userId, feedbackData);
    if (res.notFound) {
      const err = new Error('Memory not found');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (res.forbidden) {
      const err = new Error('Access denied. You do not own this memory.');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    return res;
  }
}

module.exports = new MemoryService();

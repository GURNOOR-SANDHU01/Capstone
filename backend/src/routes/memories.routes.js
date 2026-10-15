const express = require('express');
const memoryController = require('../controllers/memoryController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const {
  createMemorySchema,
  memoryFeedbackSchema,
  queryMemoriesSchema
} = require('../schemas/memory.schema');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(queryMemoriesSchema, 'query'), memoryController.list);
router.post('/', validate(createMemorySchema, 'body'), memoryController.create);
router.post('/:memoryId/feedback', validate(memoryFeedbackSchema, 'body'), memoryController.submitFeedback);

module.exports = router;

const express = require('express');
const reflectionController = require('../controllers/reflectionController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const {
  createReflectionPromptSchema,
  updateReflectionResponseSchema,
  queryReflectionPromptsSchema
} = require('../schemas/reflection.schema');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(queryReflectionPromptsSchema, 'query'), reflectionController.list);
router.post('/', validate(createReflectionPromptSchema, 'body'), reflectionController.create);
router.patch('/:promptId', validate(updateReflectionResponseSchema, 'body'), reflectionController.respond);

module.exports = router;

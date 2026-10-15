const express = require('express');
const journalController = require('../controllers/journalController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  queryJournalEntriesSchema
} = require('../schemas/journal.schema');

const router = express.Router();

router.use(authenticate);

router.post('/', validate(createJournalEntrySchema, 'body'), journalController.create);
router.get('/', validate(queryJournalEntriesSchema, 'query'), journalController.list);
router.get('/:entryId', journalController.getById);
router.patch('/:entryId', validate(updateJournalEntrySchema, 'body'), journalController.update);
router.delete('/:entryId', journalController.remove);

module.exports = router;

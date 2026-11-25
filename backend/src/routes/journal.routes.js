const express = require('express');
const journalController = require('../controllers/journalController');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { analysisLimiter } = require('../middleware/rateLimiter');
const {
  createJournalEntrySchema,
  createVoiceEntryQuerySchema,
  updateJournalEntrySchema,
  queryJournalEntriesSchema
} = require('../schemas/journal.schema');

const router = express.Router();

// Raw recording body (browser MediaRecorder sends audio/webm or audio/ogg), max ~2 min of speech
const rawAudio = express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '15mb' });

router.use(authenticate);

router.post('/', validate(createJournalEntrySchema, 'body'), journalController.create);
router.post(
  '/audio',
  analysisLimiter,
  rawAudio,
  validate(createVoiceEntryQuerySchema, 'query'),
  journalController.createVoice
);
router.get('/', validate(queryJournalEntriesSchema, 'query'), journalController.list);
router.get('/:entryId', journalController.getById);
router.patch('/:entryId', validate(updateJournalEntrySchema, 'body'), journalController.update);
router.delete('/:entryId', journalController.remove);

module.exports = router;

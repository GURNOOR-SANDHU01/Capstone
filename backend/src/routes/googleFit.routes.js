const express = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../config/roles');
const googleFitService = require('../services/fitness/googleFitService');
const { success } = require('../utils/apiResponse');

const router = express.Router();

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    return success(res, await fn(req), status);
  } catch (err) {
    next(err);
  }
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const syncSchema = z
  .object({
    days: z.number().int().min(1).max(90).default(30),
    tz_offset_minutes: z.number().int().min(-840).max(840).default(0)
  })
  .strict();
const metricsQuery = z
  .object({ from: isoDate, to: isoDate })
  .strict()
  .refine((q) => q.from <= q.to, { message: '`from` must not be after `to`' })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86400000 <= 366, { message: 'Range can be at most one year' });
const disconnectQuery = z.object({ purge: z.enum(['true', 'false']).optional() }).strict();
const callbackQuery = z
  .object({
    code: z.string().max(2048).optional(),
    state: z.string().max(2048).optional(),
    error: z.string().max(200).optional(),
    scope: z.string().max(2048).optional(),
    authuser: z.string().max(20).optional(),
    prompt: z.string().max(50).optional(),
    hd: z.string().max(255).optional()
  })
  .passthrough();

// Google redirects the browser here (no bearer token): trust comes from the signed, one-time `state`
router.get('/oauth/callback', validate(callbackQuery, 'query'), async (req, res) => {
  const target = await googleFitService.handleCallback(req.query);
  res.set('Cache-Control', 'no-store');
  return res.redirect(302, target);
});

router.use(authenticate);
router.use(requireRole(ROLES.PATIENT));

router.get('/status', handle((req) => googleFitService.getStatus(req.user)));
router.post('/connect', handle((req) => googleFitService.startConnect(req.user)));
router.post('/sync', validate(syncSchema), handle((req) => googleFitService.sync(req.user, req.body)));
router.get('/metrics', validate(metricsQuery, 'query'), handle((req) => googleFitService.getMetrics(req.user, req.query)));
router.get(
  '/insights',
  validate(z.object({ days: z.coerce.number().int().refine((d) => [7, 14, 30, 90].includes(d), 'days must be 7, 14, 30 or 90').default(14) }).strict(), 'query'),
  handle((req) => googleFitService.getInsights(req.user, { days: req.query.days }))
);
router.delete(
  '/connection',
  validate(disconnectQuery, 'query'),
  handle((req) => googleFitService.disconnect(req.user, { purge: req.query.purge === 'true' }))
);

module.exports = router;

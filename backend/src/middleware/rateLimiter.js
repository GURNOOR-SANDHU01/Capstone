const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { error } = require('../utils/apiResponse');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return error(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests from this IP address, please try again later.',
      429
    );
  }
});

const analysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 AI inferences per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return error(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Rate limit exceeded for AI model analysis. Please slow down.',
      429
    );
  }
});

module.exports = {
  apiLimiter,
  analysisLimiter
};

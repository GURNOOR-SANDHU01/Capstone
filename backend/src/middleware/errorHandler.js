const { error } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Global Express error handling middleware.
 */
function errorHandler(err, req, res, next) {
  logger.error('Unhandled Application Error', {
    message: err.message,
    name: err.name,
    code: err.code,
    path: req.originalUrl,
    method: req.method
  });

  // Body parser syntax error (invalid JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return error(res, 'MALFORMED_JSON', 'Malformed JSON in request body', 400);
  }

  // Payload too large
  if (err.type === 'entity.too.large' || err.status === 413) {
    return error(res, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds size limit', 413);
  }

  // Rate limit exceeded
  if (err.status === 429) {
    return error(res, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later.', 429);
  }

  // Firestore: query needs a composite index that is not deployed / still building
  if (err.code === 9 || err.code === 'FAILED_PRECONDITION') {
    return error(res, 'SERVICE_NOT_READY', 'This feature is temporarily unavailable. Please try again later.', 503);
  }

  // Firestore permission or not found errors
  if (err.code === 5 || err.code === 'NOT_FOUND') {
    return error(res, 'NOT_FOUND', 'Resource not found', 404);
  }
  if (err.code === 7 || err.code === 'PERMISSION_DENIED') {
    return error(res, 'FORBIDDEN', 'Permission denied', 403);
  }

  const statusCode = err.status || err.statusCode || 500;

  // Server errors never expose internal messages, codes or stack traces (details are logged above).
  // Client errors (4xx) are raised deliberately by the application and returned as-is.
  if (statusCode >= 500) {
    return error(res, 'INTERNAL_ERROR', 'An unexpected internal server error occurred.', statusCode);
  }
  return error(res, typeof err.code === 'string' ? err.code : 'REQUEST_ERROR', err.message || 'Request failed', statusCode);
}

module.exports = errorHandler;

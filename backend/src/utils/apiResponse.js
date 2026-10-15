/**
 * Standardized API Response formatter matching Sentience specifications.
 */

function success(res, data = {}, status = 200, pagination = null) {
  if (status === 204) {
    return res.status(204).send();
  }
  return res.status(status).json({
    success: true,
    data,
    pagination
  });
}

function error(res, code, message, status = 400, details = null) {
  const payload = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details && process.env.NODE_ENV !== 'production') {
    payload.error.details = details;
  }

  return res.status(status).json(payload);
}

module.exports = {
  success,
  error
};

const { error } = require('../utils/apiResponse');

/**
 * Validates request data using a Zod schema.
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} source - Target property on req
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const issues = result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message
      }));

      const firstMessage = issues[0]?.message || 'Validation failed';

      return error(
        res,
        'VALIDATION_ERROR',
        `The request is invalid: ${firstMessage}`,
        400,
        issues
      );
    }

    // Replace with parsed/sanitized value
    req[source] = result.data;
    next();
  };
}

module.exports = validate;

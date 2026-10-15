const { error } = require('../utils/apiResponse');
const { normalizeRole } = require('../config/roles');

/**
 * Restricts a route to specific canonical roles (patient | doctor | admin).
 * Legacy names passed here (e.g. 'therapist') are normalized too, so the role vocabulary
 * is translated in one place only (config/roles.js).
 */
function requireRole(...allowedRoles) {
  const allowed = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    if (!allowed.includes(req.user.role)) {
      return error(
        res,
        'FORBIDDEN',
        `Access forbidden. Role '${req.user.role}' does not have required permissions.`,
        403
      );
    }
    next();
  };
}

module.exports = {
  requireRole
};

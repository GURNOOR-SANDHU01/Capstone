const { auth } = require('../config/firebase/admin');
const { error } = require('../utils/apiResponse');
const logger = require('../utils/logger');
const { normalizeRole } = require('../config/roles');

/**
 * Authentication middleware verifying Firebase ID token.
 * Extracts Bearer token from Authorization header and verifies it via Firebase Admin SDK.
 * Attaches decoded user context to req.user.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(
      res,
      'UNAUTHORIZED',
      'Missing or malformed Authorization header. Expected Bearer <ID_TOKEN>',
      401
    );
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (!idToken) {
    return error(res, 'UNAUTHORIZED', 'Empty Firebase ID token provided', 401);
  }

  try {
    // checkRevoked=true: role changes and account disabling take effect immediately
    const decodedToken = await auth.verifyIdToken(idToken, true);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      role: normalizeRole(decodedToken.role),
      claims: decodedToken
    };
    return next();
  } catch (err) {
    logger.warn('Token verification failed', { error: err.message, code: err.code });

    if (err.code === 'auth/id-token-expired') {
      return error(res, 'TOKEN_EXPIRED', 'Firebase ID token has expired. Please refresh your session.', 401);
    }
    if (err.code === 'auth/id-token-revoked') {
      return error(res, 'TOKEN_REVOKED', 'Firebase ID token has been revoked.', 401);
    }
    if (err.code === 'auth/user-disabled') {
      return error(res, 'USER_DISABLED', 'This account has been disabled.', 401);
    }
    if (err.code === 'auth/argument-error' || err.code === 'auth/invalid-id-token') {
      return error(res, 'INVALID_TOKEN', 'Invalid Firebase ID token supplied.', 401);
    }

    return error(res, 'AUTHENTICATION_FAILED', 'Failed to authenticate user.', 401);
  }
}

module.exports = authenticate;

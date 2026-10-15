const { auth } = require('../config/firebase/admin');
const userRepository = require('../repositories/userRepository');
const adminAuditRepository = require('../repositories/adminAuditRepository');
const { ROLES, normalizeRole, isValidRole } = require('../config/roles');
const { httpError } = require('./accessPolicy');

/**
 * Assigns a canonical role to a Firebase Auth account.
 *  - the custom claim is the source of truth; the users/{uid}.role field is a display mirror
 *  - other existing custom claims are preserved
 *  - refresh tokens are revoked so the change takes effect immediately
 *    (authenticate() verifies tokens with checkRevoked=true)
 *
 * Used by the admin API (actor = authenticated admin) and by scripts/set-role.js
 * (actor = { uid: 'bootstrap-script', role: 'system' }).
 */
async function setUserRole(actor, targetUid, role) {
  if (!isValidRole(role)) {
    throw httpError(400, 'INVALID_ROLE', `Role must be one of: ${Object.values(ROLES).join(', ')}`);
  }
  if (actor.uid === targetUid) {
    throw httpError(400, 'SELF_ROLE_CHANGE', 'Administrators cannot change their own role.');
  }

  let record;
  try {
    record = await auth.getUser(targetUid);
  } catch (err) {
    if (err.code === 'auth/user-not-found') throw httpError(404, 'USER_NOT_FOUND', 'No account exists with this ID.');
    throw err;
  }

  const previousRole = normalizeRole(record.customClaims?.role);
  await auth.setCustomUserClaims(targetUid, { ...(record.customClaims || {}), role });
  await auth.revokeRefreshTokens(targetUid);

  const mirrored = await userRepository.setFields(targetUid, { role });
  if (!mirrored) {
    await userRepository.create(targetUid, {
      email: record.email || '',
      full_name: record.displayName || (record.email ? record.email.split('@')[0] : ''),
      role
    });
  }

  await adminAuditRepository.log({
    actorId: actor.uid,
    actorRole: actor.role,
    action: 'SET_ROLE',
    targetId: targetUid,
    details: { previous_role: previousRole, new_role: role }
  });

  return { uid: targetUid, previous_role: previousRole, role };
}

module.exports = { setUserRole };

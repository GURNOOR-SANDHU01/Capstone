/**
 * Canonical application roles.
 *
 * Roles are read ONLY from the Firebase custom claim `role`, which only the Admin SDK can set.
 * Anything the client sends (request bodies, Firestore profile fields) is never trusted for authorization.
 *
 * The Firestore schema keeps its original "therapist" naming (therapist_id, therapist_bridges, ...);
 * a doctor's UID is what is stored in those fields. This module is the single place where the
 * legacy role names are translated.
 */

const ROLES = Object.freeze({
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  ADMIN: 'admin'
});

const LEGACY_ROLE_MAP = Object.freeze({
  user: ROLES.PATIENT,
  therapist: ROLES.DOCTOR
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

/**
 * Normalizes a raw claim value to a canonical role.
 * Unknown or missing values fall back to the least-privileged role (patient).
 */
function normalizeRole(rawRole) {
  if (typeof rawRole !== 'string') return ROLES.PATIENT;
  const value = rawRole.trim().toLowerCase();
  if (ALL_ROLES.includes(value)) return value;
  return LEGACY_ROLE_MAP[value] || ROLES.PATIENT;
}

function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

module.exports = {
  ROLES,
  ALL_ROLES,
  LEGACY_ROLE_MAP,
  normalizeRole,
  isValidRole
};

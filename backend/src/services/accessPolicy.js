/**
 * Central data-access policy for patient records.
 *
 * Rules:
 *  - A patient always has full access to their own records.
 *  - A doctor can read a patient's journal entry only when ALL of these hold:
 *      1. the caller's verified role is `doctor`,
 *      2. the patient has an active consent bridge to that doctor (consent_granted: true),
 *      3. the bridge's access_level permits journal access (not `emergency_only`),
 *      4. the entry's visibility is `shared` (entries without the field are treated as private).
 *  - `longitudinal_summary_only` consent returns a summary projection (no journal text,
 *    no reflection responses); `full_reflection_access` returns the full masked entry.
 *  - Admins have no journal-content access through this policy.
 */
const consentRepository = require('../repositories/consentRepository');
const { ROLES } = require('../config/roles');

const VISIBILITY = Object.freeze({ PRIVATE: 'private', SHARED: 'shared' });

const ACCESS_LEVELS = Object.freeze({
  SUMMARY: 'longitudinal_summary_only',
  FULL: 'full_reflection_access',
  EMERGENCY: 'emergency_only'
});

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function entryVisibility(entry) {
  return entry?.visibility === VISIBILITY.SHARED ? VISIBILITY.SHARED : VISIBILITY.PRIVATE;
}

function journalAccessFor(accessLevel) {
  if (accessLevel === ACCESS_LEVELS.FULL) return 'full';
  if (accessLevel === ACCESS_LEVELS.SUMMARY) return 'summary';
  return 'none';
}

/**
 * Summary projection for doctors with longitudinal_summary_only consent:
 * trends and safety signals, but never the journal text or reflection answers.
 */
function toSummaryView(entry) {
  return {
    id: entry.id,
    user_id: entry.user_id,
    entry_date: entry.entry_date,
    created_at: entry.created_at,
    entry_type: entry.entry_type,
    input_source: entry.input_source,
    visibility: entryVisibility(entry),
    extracted_themes: entry.extracted_themes || [],
    detected_emotions: {
      primary_state: entry.detected_emotions?.primary_state ?? null,
      sentiment_score: entry.detected_emotions?.sentiment_score ?? null,
      corrected_emotion: entry.detected_emotions?.corrected_emotion ?? null
    },
    safety_flags: entry.safety_flags || null,
    access: 'summary'
  };
}

function toDoctorView(entry, access) {
  if (access === 'full') return { ...entry, visibility: entryVisibility(entry), access: 'full' };
  return toSummaryView(entry);
}

/**
 * Resolves the journal access a doctor has for a patient.
 * Throws 403 when the caller is not a doctor or has no usable consent.
 */
async function resolveDoctorJournalAccess(user, patientId) {
  if (!user || user.role !== ROLES.DOCTOR) {
    throw httpError(403, 'FORBIDDEN', 'Access denied to journal entry');
  }
  const bridge = await consentRepository.findActiveBridge(patientId, user.uid);
  if (!bridge) {
    throw httpError(403, 'FORBIDDEN', 'Access denied. No active patient consent granted for this relationship.');
  }
  const access = journalAccessFor(bridge.access_level);
  if (access === 'none') {
    throw httpError(403, 'FORBIDDEN', 'Access denied. Consent does not include journal access.');
  }
  return { bridge, access };
}

/**
 * Returns the view of `entry` that `user` may see, or throws 403.
 */
async function viewEntryFor(user, entry) {
  if (entry.user_id === user.uid) {
    return { ...entry, visibility: entryVisibility(entry), access: 'owner' };
  }
  const { access } = await resolveDoctorJournalAccess(user, entry.user_id);
  if (entryVisibility(entry) !== VISIBILITY.SHARED) {
    throw httpError(403, 'FORBIDDEN', 'Access denied. This journal entry is private.');
  }
  return toDoctorView(entry, access);
}

module.exports = {
  VISIBILITY,
  ACCESS_LEVELS,
  entryVisibility,
  journalAccessFor,
  resolveDoctorJournalAccess,
  viewEntryFor,
  toDoctorView,
  httpError
};

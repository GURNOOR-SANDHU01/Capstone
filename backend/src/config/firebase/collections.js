/**
 * Firestore collection names. Kept dependency-free so tests can import it without
 * initializing the Firebase Admin SDK.
 */
const COLLECTIONS = Object.freeze({
  USERS: 'users',
  THERAPIST_BRIDGES: 'therapist_bridges',
  MEMORIES: 'memories',
  JOURNAL_ENTRIES: 'journal_entries',
  REFLECTION_PROMPTS: 'reflection_prompts_and_responses',
  RED_FLAG_ALERTS: 'red_flag_alert_logs',
  CONSENT_AUDIT: 'consent_audit_logs',
  BIOMETRIC_SYNC: 'biometric_sync_logs',
  MEMORY_FEEDBACK: 'memory_feedback',
  ADMIN_AUDIT: 'admin_audit_logs',
  APPOINTMENTS: 'appointments',
  CARE_INSTRUCTIONS: 'care_instructions',
  MESSAGES: 'messages',
  CLINICS: 'clinics'
});

module.exports = { COLLECTIONS };

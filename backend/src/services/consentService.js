const consentRepository = require('../repositories/consentRepository');
const userRepository = require('../repositories/userRepository');
const { auth } = require('../config/firebase/admin');
const { ROLES, normalizeRole } = require('../config/roles');
const { httpError } = require('./accessPolicy');

/**
 * Verifies that `doctorUid` is an existing Firebase Auth account whose verified custom claim
 * is `doctor`. Firestore profile fields are not trusted for this decision.
 */
async function assertIsDoctor(doctorUid) {
  let record;
  try {
    record = await auth.getUser(doctorUid);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      throw httpError(404, 'DOCTOR_NOT_FOUND', 'No doctor account exists with this ID.');
    }
    throw err;
  }
  if (record.disabled || normalizeRole(record.customClaims?.role) !== ROLES.DOCTOR) {
    throw httpError(400, 'NOT_A_DOCTOR', 'Consent can only be granted to an active doctor account.');
  }
  return record;
}

class ConsentService {
  async getConsentStatus(userId) {
    const bridges = await consentRepository.listUserBridges(userId);
    const auditLogs = await consentRepository.listAuditLogs(userId);

    // Attach doctor display names so the patient can see who has access
    const profiles = await userRepository.getManyByIds(bridges.map((b) => b.therapist_id));
    const activeBridges = bridges.map((b) => ({
      ...b,
      doctor_name: profiles[b.therapist_id]?.full_name || null
    }));

    return {
      activeBridges,
      auditHistory: auditLogs
    };
  }

  async grantTherapistConsent(userId, data, meta) {
    if (data.therapist_id === userId) {
      throw httpError(400, 'INVALID_CONSENT_TARGET', 'You cannot grant consent to yourself.');
    }
    await assertIsDoctor(data.therapist_id);
    return consentRepository.grantConsent(userId, data, meta);
  }

  async revokeTherapistConsent(userId, data, meta) {
    const res = await consentRepository.revokeConsent(userId, data, meta);
    if (res.notFound) {
      throw httpError(404, 'NOT_FOUND', 'No therapist connection found to revoke');
    }
    return res;
  }

  /**
   * Patients who currently grant consent to this doctor (the doctor's roster).
   */
  async listPatientsForDoctor(doctorUid) {
    const bridges = await consentRepository.listActiveBridgesForTherapist(doctorUid);
    const profiles = await userRepository.getManyByIds(bridges.map((b) => b.user_id));
    return bridges.map((b) => ({
      patient_id: b.user_id,
      full_name: profiles[b.user_id]?.full_name || null,
      access_level: b.access_level,
      red_flag_alerts_enabled: Boolean(b.red_flag_alerts_enabled),
      consent_updated_at: b.consent_updated_at || null
    }));
  }
}

module.exports = new ConsentService();
module.exports.assertIsDoctor = assertIsDoctor;

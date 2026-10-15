const userRepository = require('../repositories/userRepository');
const adminAuditRepository = require('../repositories/adminAuditRepository');
const { ROLES } = require('../config/roles');
const { setUserRole } = require('./roleService');
const { httpError } = require('./accessPolicy');
const { auth } = require('../config/firebase/admin');
const safetyRepository = require('../repositories/safetyRepository');
const SimpleRepository = require('../repositories/simpleRepository');
const { COLLECTIONS } = require('../config/firebase/firestore');

const appointmentRepo = new SimpleRepository(COLLECTIONS.APPOINTMENTS);
const clinicRepo = new SimpleRepository(COLLECTIONS.CLINICS);

const publicUserFields = (u) => ({
  id: u.id,
  full_name: u.full_name || '',
  email: u.email || '',
  role: u.role || ROLES.PATIENT,
  created_at: u.created_at || null,
  doctor_profile: u.doctor_profile || null
});

class AdminService {
  async listUsers({ role } = {}) {
    const users = role ? await userRepository.listByRole(role, 500) : await userRepository.list(500);
    return users.map(publicUserFields);
  }

  async setRole(actor, uid, role) {
    return setUserRole(actor, uid, role);
  }

  /**
   * Doctor directory details (specialization, clinic, status) shown to patients.
   */
  async updateDoctorProfile(actor, uid, doctorProfile) {
    const profile = await userRepository.getById(uid);
    if (!profile) throw httpError(404, 'USER_NOT_FOUND', 'User profile not found');
    if (profile.role !== ROLES.DOCTOR) {
      throw httpError(400, 'NOT_A_DOCTOR', 'Assign the doctor role before editing doctor details.');
    }
    const updated = await userRepository.setFields(uid, {
      doctor_profile: { ...(profile.doctor_profile || {}), ...doctorProfile }
    });
    await adminAuditRepository.log({
      actorId: actor.uid,
      actorRole: actor.role,
      action: 'UPDATE_DOCTOR_PROFILE',
      targetId: uid,
      details: doctorProfile
    });
    return publicUserFields(updated);
  }

  /**
   * Promotes an existing account (found by email) to doctor and sets directory details.
   * Accounts are created by the person signing up; admins never create credentials.
   */
  async addDoctorByEmail(actor, { email, ...doctorProfile }) {
    let record;
    try {
      record = await auth.getUserByEmail(email);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        throw httpError(404, 'USER_NOT_FOUND', 'No account uses this email. Ask the doctor to sign up first.');
      }
      throw err;
    }
    await setUserRole(actor, record.uid, ROLES.DOCTOR);
    if (Object.keys(doctorProfile).length) return this.updateDoctorProfile(actor, record.uid, doctorProfile);
    return publicUserFields(await userRepository.getById(record.uid));
  }

  async stats() {
    const [users, alerts, appointments, clinics] = await Promise.all([
      userRepository.list(1000),
      safetyRepository.listAll({ page: 1, limit: 500 }),
      appointmentRepo.listAll(1000),
      clinicRepo.listAll(500)
    ]);
    const byRole = users.reduce((acc, u) => ((acc[u.role || ROLES.PATIENT] = (acc[u.role || ROLES.PATIENT] || 0) + 1), acc), {});
    return {
      users: byRole,
      open_alerts: alerts.alerts.filter((a) => a.alert_status !== 'resolved').length,
      unassigned_alerts: alerts.alerts.filter((a) => !a.therapist_id && a.alert_status !== 'resolved').length,
      appointments: appointments.length,
      upcoming_appointments: appointments.filter((a) => ['PENDING', 'CONFIRMED', 'RESCHEDULE_REQUESTED'].includes(a.status)).length,
      clinics: clinics.length
    };
  }

  async listAuditLogs(limit) {
    return adminAuditRepository.list(limit);
  }
}

module.exports = new AdminService();

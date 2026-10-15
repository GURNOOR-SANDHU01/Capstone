/**
 * Care instructions (doctor -> patient reminders), secure messaging, and clinics.
 * Doctor-patient features require an active consent bridge; identities come from tokens.
 */
const SimpleRepository = require('../repositories/simpleRepository');
const consentRepository = require('../repositories/consentRepository');
const userRepository = require('../repositories/userRepository');
const adminAuditRepository = require('../repositories/adminAuditRepository');
const { COLLECTIONS } = require('../config/firebase/firestore');
const { ROLES } = require('../config/roles');
const { httpError } = require('./accessPolicy');

const careRepo = new SimpleRepository(COLLECTIONS.CARE_INSTRUCTIONS);
const messageRepo = new SimpleRepository(COLLECTIONS.MESSAGES);
const clinicRepo = new SimpleRepository(COLLECTIONS.CLINICS);

const millis = (ts) => (ts?.toMillis ? ts.toMillis() : (ts?._seconds ?? ts?.seconds ?? 0) * 1000);
const newestFirst = (a, b) => millis(b.created_at) - millis(a.created_at);
const oldestFirst = (a, b) => millis(a.created_at) - millis(b.created_at);

async function requireBridge(patientId, doctorId, message) {
  const bridge = await consentRepository.findActiveBridge(patientId, doctorId);
  if (!bridge) throw httpError(403, 'FORBIDDEN', message);
  return bridge;
}

class CareService {
  /* ---------------- care instructions ---------------- */

  async createInstruction(doctor, body) {
    await requireBridge(body.patient_id, doctor.uid, 'You can only send care instructions to patients who consent to your care.');
    const profiles = await userRepository.getManyByIds([body.patient_id, doctor.uid]);
    return careRepo.create({
      patient_id: body.patient_id,
      patient_name: profiles[body.patient_id]?.full_name || null,
      doctor_id: doctor.uid,
      doctor_name: profiles[doctor.uid]?.full_name || null,
      type: body.type,
      medication_name: body.medication_name || null,
      schedule: body.schedule,
      start_date: body.start_date,
      end_date: body.end_date || null,
      notes: body.notes || null,
      status: 'Active'
    });
  }

  async listInstructions(user) {
    const filter = user.role === ROLES.DOCTOR ? { doctor_id: user.uid } : { patient_id: user.uid };
    return (await careRepo.listWhere(filter)).sort(newestFirst);
  }

  async updateInstructionStatus(doctor, id, status) {
    const item = await careRepo.getById(id);
    if (!item) throw httpError(404, 'NOT_FOUND', 'Care instruction not found');
    if (item.doctor_id !== doctor.uid) throw httpError(403, 'FORBIDDEN', 'You did not create this care instruction.');
    return careRepo.update(id, { status });
  }

  /* ---------------- messaging ---------------- */

  /** Resolves the (patient, doctor) pair for a conversation between the caller and `counterpartId`. */
  async conversationPair(user, counterpartId) {
    if (!counterpartId) throw httpError(400, 'VALIDATION_ERROR', 'A conversation partner is required.');
    const pair =
      user.role === ROLES.PATIENT
        ? { patient_id: user.uid, doctor_id: counterpartId }
        : user.role === ROLES.DOCTOR
          ? { patient_id: counterpartId, doctor_id: user.uid }
          : null;
    if (!pair) throw httpError(403, 'FORBIDDEN', 'Only patients and doctors can use secure messaging.');
    await requireBridge(pair.patient_id, pair.doctor_id, 'Messaging requires an active consent relationship.');
    return pair;
  }

  async listMessages(user, counterpartId) {
    const pair = await this.conversationPair(user, counterpartId);
    return (await messageRepo.listWhere(pair, 500)).sort(oldestFirst);
  }

  async sendMessage(user, counterpartId, text) {
    const pair = await this.conversationPair(user, counterpartId);
    const sender = await userRepository.getById(user.uid);
    return messageRepo.create({
      ...pair,
      sender_id: user.uid,
      sender_role: user.role,
      sender_name: sender?.full_name || null,
      text
    });
  }

  /* ---------------- clinics ---------------- */

  async listClinics() {
    const [clinics, doctors] = await Promise.all([clinicRepo.listAll(200), userRepository.listByRole(ROLES.DOCTOR, 500)]);
    return clinics
      .map((c) => ({ ...c, doctors_count: doctors.filter((d) => d.doctor_profile?.clinic_name === c.name).length }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createClinic(admin, body) {
    const clinic = await clinicRepo.create({ ...body, status: body.status || 'Active' });
    await adminAuditRepository.log({ actorId: admin.uid, actorRole: admin.role, action: 'ADD_CLINIC', targetId: clinic.id, details: { name: body.name } });
    return clinic;
  }
}

module.exports = new CareService();

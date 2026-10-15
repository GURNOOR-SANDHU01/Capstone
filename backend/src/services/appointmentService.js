const crypto = require('crypto');
const SimpleRepository = require('../repositories/simpleRepository');
const consentRepository = require('../repositories/consentRepository');
const userRepository = require('../repositories/userRepository');
const { COLLECTIONS } = require('../config/firebase/firestore');
const { ROLES } = require('../config/roles');
const { assertIsDoctor } = require('./consentService');
const { httpError } = require('./accessPolicy');

const repo = new SimpleRepository(COLLECTIONS.APPOINTMENTS);

const STATUS = Object.freeze({
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
  RESCHEDULE_REQUESTED: 'RESCHEDULE_REQUESTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED'
});

/**
 * Who may perform which action, from which status. Anything not listed is rejected.
 */
const TRANSITIONS = {
  confirm: { by: ROLES.DOCTOR, from: [STATUS.PENDING], to: STATUS.CONFIRMED },
  reject: { by: ROLES.DOCTOR, from: [STATUS.PENDING, STATUS.RESCHEDULE_REQUESTED], to: STATUS.REJECTED },
  reschedule: { by: ROLES.DOCTOR, from: [STATUS.PENDING, STATUS.CONFIRMED], to: STATUS.RESCHEDULE_REQUESTED },
  accept_reschedule: { by: ROLES.PATIENT, from: [STATUS.RESCHEDULE_REQUESTED], to: STATUS.CONFIRMED },
  complete: { by: ROLES.DOCTOR, from: [STATUS.CONFIRMED], to: STATUS.COMPLETED },
  cancel: { by: 'either', from: [STATUS.PENDING, STATUS.CONFIRMED, STATUS.RESCHEDULE_REQUESTED], to: STATUS.CANCELLED }
};

/** A unique video room per appointment (Jitsi Meet rooms need no account or API key). */
const newMeetingUrl = () => `https://meet.jit.si/SentiMed-${crypto.randomBytes(9).toString('hex')}`;

const byDateTime = (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);

function isParticipant(user, apt) {
  return (user.role === ROLES.PATIENT && apt.patient_id === user.uid) || (user.role === ROLES.DOCTOR && apt.doctor_id === user.uid);
}

class AppointmentService {
  async list(user) {
    let items;
    if (user.role === ROLES.PATIENT) items = await repo.listWhere({ patient_id: user.uid });
    else if (user.role === ROLES.DOCTOR) items = await repo.listWhere({ doctor_id: user.uid });
    else throw httpError(403, 'FORBIDDEN', 'Only appointment participants can list appointments.');
    return items.sort(byDateTime);
  }

  /**
   * Patients request (PENDING) an appointment with any active doctor.
   * Doctors schedule (CONFIRMED) only with patients who currently consent to them.
   * Identities and names come from verified accounts, never from the request body.
   */
  async create(user, body) {
    let patientId;
    let doctorId;
    let status;
    if (user.role === ROLES.PATIENT) {
      patientId = user.uid;
      doctorId = body.doctor_id;
      if (!doctorId) throw httpError(400, 'VALIDATION_ERROR', 'doctor_id is required');
      await assertIsDoctor(doctorId);
      status = STATUS.PENDING;
    } else if (user.role === ROLES.DOCTOR) {
      doctorId = user.uid;
      patientId = body.patient_id;
      if (!patientId) throw httpError(400, 'VALIDATION_ERROR', 'patient_id is required');
      const bridge = await consentRepository.findActiveBridge(patientId, doctorId);
      if (!bridge) throw httpError(403, 'FORBIDDEN', 'You can only schedule appointments with patients who consent to your care.');
      status = STATUS.CONFIRMED;
    } else {
      throw httpError(403, 'FORBIDDEN', 'Only patients and doctors can create appointments.');
    }

    const profiles = await userRepository.getManyByIds([patientId, doctorId]);
    const doctorProfile = profiles[doctorId]?.doctor_profile || {};
    return repo.create({
      patient_id: patientId,
      patient_name: profiles[patientId]?.full_name || null,
      doctor_id: doctorId,
      doctor_name: profiles[doctorId]?.full_name || null,
      specialization: doctorProfile.specialization || null,
      clinic_name: body.clinic_name || doctorProfile.clinic_name || null,
      date: body.date,
      time: body.time,
      type: body.type,
      reason: body.reason,
      notes: body.notes || null,
      status,
      created_by: user.role,
      meeting_provider: status === STATUS.CONFIRMED ? 'jitsi' : null,
      meeting_url: status === STATUS.CONFIRMED ? newMeetingUrl() : null
    });
  }

  async act(user, id, body) {
    const rule = TRANSITIONS[body.action];
    if (!rule) throw httpError(400, 'INVALID_ACTION', 'Unknown appointment action.');

    const updated = await repo.transition(id, (apt) => {
      if (!isParticipant(user, apt)) throw httpError(403, 'FORBIDDEN', 'You are not a participant in this appointment.');
      if (rule.by !== 'either' && rule.by !== user.role) {
        throw httpError(403, 'FORBIDDEN', `Only the ${rule.by} can ${body.action.replace('_', ' ')} this appointment.`);
      }
      if (!rule.from.includes(apt.status)) {
        throw httpError(409, 'INVALID_STATE', `Cannot ${body.action.replace('_', ' ')} an appointment that is ${apt.status}.`);
      }

      const fields = { status: rule.to, last_action_by: user.role };
      switch (body.action) {
        case 'confirm':
          fields.meeting_provider = 'jitsi';
          fields.meeting_url = apt.meeting_url || newMeetingUrl();
          fields.notes = 'Confirmed by clinician.';
          break;
        case 'reject':
          fields.rejection_reason = body.reason || 'Clinician unavailable at requested time.';
          break;
        case 'reschedule':
          if (!body.date || !body.time) throw httpError(400, 'VALIDATION_ERROR', 'A new date and time are required to reschedule.');
          fields.rescheduled_date = body.date;
          fields.rescheduled_time = body.time;
          fields.reschedule_note = body.note || 'Clinician proposed a new consultation time.';
          break;
        case 'accept_reschedule':
          fields.date = apt.rescheduled_date || apt.date;
          fields.time = apt.rescheduled_time || apt.time;
          fields.rescheduled_date = null;
          fields.rescheduled_time = null;
          fields.reschedule_note = null;
          fields.meeting_provider = 'jitsi';
          fields.meeting_url = apt.meeting_url || newMeetingUrl();
          fields.notes = 'Rescheduled time accepted by patient.';
          break;
        case 'cancel':
          fields.cancelled_by = user.role;
          break;
        default:
          break;
      }
      return fields;
    });

    if (!updated) throw httpError(404, 'NOT_FOUND', 'Appointment not found');
    return updated;
  }
}

module.exports = new AppointmentService();
module.exports.STATUS = STATUS;
module.exports.TRANSITIONS = TRANSITIONS;

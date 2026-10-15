const safetyRepository = require('../repositories/safetyRepository');
const consentRepository = require('../repositories/consentRepository');
const userRepository = require('../repositories/userRepository');
const { ROLES } = require('../config/roles');
const { httpError } = require('./accessPolicy');
const logger = require('../utils/logger');

const SEVERITIES = ['moderate', 'high', 'critical'];

/**
 * Bridges through which this doctor currently receives red-flag alerts, keyed by patient.
 */
async function alertBridgesForDoctor(doctorUid) {
  const bridges = await consentRepository.listActiveBridgesForTherapist(doctorUid);
  return new Map(bridges.filter((b) => b.red_flag_alerts_enabled).map((b) => [b.user_id, b]));
}

async function withPatientNames(alerts) {
  const profiles = await userRepository.getManyByIds(alerts.map((a) => a.user_id));
  return alerts.map((a) => ({ ...a, patient_name: profiles[a.user_id]?.full_name || null }));
}

class SafetyService {
  /**
   * - patient: their own alerts
   * - doctor: alerts addressed to them, only for patients who still consent to red-flag alerts
   * - admin: all alerts, including the unassigned triage queue (therapist_id '')
   */
  async listAlerts(user, query) {
    if (user.role === ROLES.DOCTOR) {
      const consented = await alertBridgesForDoctor(user.uid);
      if (query.patient_id && !consented.has(query.patient_id)) {
        throw httpError(403, 'FORBIDDEN', 'Access denied. No active consent for red flag alerts with this patient.');
      }
      const result = await safetyRepository.listAlertsForTherapist(user.uid, query);
      result.alerts = await withPatientNames(result.alerts.filter((a) => consented.has(a.user_id)));
      result.pagination.count = result.alerts.length;
      return result;
    }

    if (user.role === ROLES.ADMIN) {
      const result = await safetyRepository.listAll(query);
      let alerts = result.alerts;
      if (query.status) alerts = alerts.filter((a) => a.alert_status === query.status);
      if (query.severity) alerts = alerts.filter((a) => a.severity === query.severity);
      result.alerts = await withPatientNames(alerts);
      result.pagination.count = result.alerts.length;
      return result;
    }

    return safetyRepository.listAlertsForUser(user.uid, query);
  }

  /**
   * - doctor: only alerts addressed to them, and only while the patient still consents
   * - admin: any alert (unassigned triage alerts are admin-only); every admin action is logged
   */
  async updateAlert(alertId, user, updates) {
    const alert = await safetyRepository.getById(alertId);
    if (!alert) throw httpError(404, 'NOT_FOUND', 'Safety alert not found');

    if (user.role === ROLES.DOCTOR) {
      if (!alert.therapist_id || alert.therapist_id !== user.uid) {
        throw httpError(403, 'FORBIDDEN', 'Access denied. You are not the assigned doctor for this alert.');
      }
      const bridge = await consentRepository.findActiveBridge(alert.user_id, user.uid);
      if (!bridge || !bridge.red_flag_alerts_enabled) {
        throw httpError(403, 'FORBIDDEN', 'Access denied. The patient no longer shares red flag alerts with you.');
      }
    } else if (user.role === ROLES.ADMIN) {
      logger.info('Admin updated safety alert', { alertId, adminUid: user.uid, status: updates.alert_status });
    } else {
      throw httpError(403, 'FORBIDDEN', 'Access forbidden.');
    }

    return safetyRepository.applyStatusUpdate(alertId, alert, updates, user);
  }

  /**
   * Creates alerts for a risk event, addressed to every doctor with active red-flag consent,
   * or to the admin triage queue when there is none. Never stores journal text.
   */
  async raiseAlert(userId, { severity, alertType, reason }) {
    if (!SEVERITIES.includes(severity)) throw new Error(`Invalid severity ${severity}`);
    const bridges = await consentRepository.listUserBridges(userId);
    const recipients = bridges.filter((b) => b.consent_granted && b.red_flag_alerts_enabled).map((b) => b.therapist_id);
    const created = [];
    for (const therapistId of recipients.length ? recipients : ['']) {
      created.push(
        await safetyRepository.createAlert({
          user_id: userId,
          therapist_id: therapistId,
          alert_type: alertType,
          severity,
          trigger_reason: reason
        })
      );
    }
    return created;
  }
}

module.exports = new SafetyService();

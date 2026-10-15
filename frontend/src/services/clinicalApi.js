/**
 * Clinical, care-team and admin data for the UI.
 *
 * Every function is async and works in both modes:
 *   - Live: Express API (identities and permissions are decided by the backend)
 *   - Sandbox: the existing localStorage demo services
 * Each API record is mapped to the field names the existing components already render.
 */
import { isRealFirebaseConfigured } from "./firebase";
import { api } from "./apiClient";
import { formatEntryDate } from "./journalService";
import { CLINICIAN_PATIENTS_DEMO } from "../data/mockData";
import { AVAILABLE_DOCTORS_DEMO } from "../data/mockData";
import { getDoctorReminders, createDoctorReminder } from "./doctorService";
import { getMessages, sendMessage } from "./messagingService";
import { getRiskAlerts, markAlertResolved } from "./riskWorkflowService";
import { getAdminDoctors, getAdminClinics, getAuditLogs, addDoctor, addClinic } from "./adminService";
import { getAppointments } from "./appointmentService";

const live = () => isRealFirebaseConfigured;

const millis = (ts) => {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") return Date.parse(ts) || 0;
  return ((ts._seconds ?? ts.seconds) || 0) * 1000;
};
const when = (ts) => (millis(ts) ? formatEntryDate(millis(ts)) : "");

export const ACCESS_LEVEL_LABELS = {
  full_reflection_access: "Full journal access (shared entries)",
  longitudinal_summary_only: "Summary only (mood trends, no text)",
  emergency_only: "Emergency alerts only"
};

/* ---------------- people ---------------- */

/** Doctor: patients who currently consent to share with them. */
export async function listMyPatients() {
  if (!live()) {
    return CLINICIAN_PATIENTS_DEMO.map((p) => ({ id: p.id, name: p.name, accessLevel: "full_reflection_access", redFlagAlerts: true, status: p.status }));
  }
  const { data } = await api.get("/patients");
  return (data || []).map((p) => ({
    id: p.patient_id,
    name: p.full_name || "Patient",
    accessLevel: p.access_level,
    redFlagAlerts: p.red_flag_alerts_enabled,
    consentSince: when(p.consent_updated_at)
  }));
}

/** Directory of active doctors (patients use it to book and to grant consent). */
export async function listDoctors() {
  if (!live()) return AVAILABLE_DOCTORS_DEMO;
  const { data } = await api.get("/doctors");
  return (data || []).map((d) => ({
    id: d.id,
    name: d.full_name || "Doctor",
    specialization: d.specialization || "General Practice",
    clinic: d.clinic_name || "SentiMed Network",
    availability: d.status
  }));
}

/* ---------------- consent (live only) ---------------- */

export async function getConsentStatus() {
  if (!live()) return { bridges: [], history: [] };
  const { data } = await api.get("/consent");
  return {
    bridges: (data.activeBridges || []).map((b) => ({
      id: b.id,
      doctorId: b.therapist_id,
      doctorName: b.doctor_name || "Doctor",
      active: Boolean(b.consent_granted),
      accessLevel: b.access_level,
      redFlagAlerts: Boolean(b.red_flag_alerts_enabled),
      updated: when(b.consent_updated_at)
    })),
    history: (data.auditHistory || []).map((h) => ({
      id: h.id,
      action: h.action,
      doctorId: h.metadata?.therapist_id,
      accessLevel: h.access_level,
      when: when(h.action_timestamp)
    }))
  };
}

export async function grantConsent(doctorId, accessLevel, redFlagAlerts) {
  await api.post("/consent/therapist", { therapist_id: doctorId, access_level: accessLevel, red_flag_alerts_enabled: redFlagAlerts });
}

export async function revokeConsent(doctorId) {
  await api.delete("/consent/therapist", { therapist_id: doctorId });
}

/* ---------------- care instructions ---------------- */

const fromApiInstruction = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  patientName: r.patient_name || "Patient",
  doctorName: r.doctor_name || "Your doctor",
  type: r.type,
  medicationName: r.medication_name || r.type,
  schedule: r.schedule,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  notes: r.notes || ""
});

export async function listCareInstructions() {
  if (!live()) return getDoctorReminders();
  const { data } = await api.get("/care-instructions");
  return (data || []).map(fromApiInstruction);
}

export async function createCareInstruction(form) {
  if (!live()) return createDoctorReminder(form).created;
  const body = {
    patient_id: form.patientId,
    type: form.type || "Medication Reminder",
    schedule: form.schedule,
    start_date: form.startDate
  };
  if (form.medicationName) body.medication_name = form.medicationName;
  if (form.endDate) body.end_date = form.endDate;
  if (form.notes) body.notes = form.notes;
  const { data } = await api.post("/care-instructions", body);
  return fromApiInstruction(data);
}

/* ---------------- messaging ---------------- */

const fromApiMessage = (m) => ({
  id: m.id,
  senderRole: m.sender_role,
  senderName: m.sender_name || (m.sender_role === "doctor" ? "Doctor" : "Patient"),
  text: m.text,
  time: when(m.created_at)
});

export async function listConversation(counterpartId) {
  if (!live()) return getMessages();
  const { data } = await api.get("/messages", { with: counterpartId });
  return (data || []).map(fromApiMessage);
}

export async function sendConversationMessage(counterpartId, text, sandboxSender = { role: "doctor", name: "Doctor" }) {
  if (!live()) return sendMessage(sandboxSender.role, sandboxSender.name, text);
  await api.post("/messages", { to: counterpartId, text });
  return listConversation(counterpartId);
}

/* ---------------- safety alerts ---------------- */

const RISK = { HIGH_URGENT: "HIGH_URGENT", MODERATE: "MODERATE" };

const fromApiAlert = (a) => {
  const urgent = a.severity === "critical" || a.severity === "high";
  const status =
    a.alert_status === "resolved"
      ? "Resolved & Reviewed"
      : a.alert_status === "viewed"
        ? "Viewed"
        : urgent
          ? "Urgent Review Required"
          : "Moderate Flagged";
  return {
    id: a.id,
    patientId: a.user_id,
    patientName: a.patient_name || "Patient",
    riskCategory: urgent ? RISK.HIGH_URGENT : RISK.MODERATE,
    severity: a.severity,
    timestamp: when(a.triggered_at),
    status,
    details: a.trigger_reason,
    alertType: a.alert_type,
    assigned: Boolean(a.therapist_id),
    actionTaken: a.therapist_action_taken || ""
  };
};

export async function listSafetyAlerts() {
  if (!live()) return getRiskAlerts();
  const { data } = await api.get("/safety-alerts", { limit: 100 });
  return (data || []).map(fromApiAlert);
}

export async function resolveSafetyAlert(id, actionTaken) {
  if (!live()) return markAlertResolved(id);
  const body = { alert_status: "resolved" };
  if (actionTaken) body.therapist_action_taken = actionTaken;
  await api.patch(`/safety-alerts/${encodeURIComponent(id)}`, body);
  return listSafetyAlerts();
}

/* ---------------- admin ---------------- */

const fromApiDoctor = (u) => ({
  id: u.id,
  name: u.full_name || u.email,
  email: u.email,
  specialization: u.doctor_profile?.specialization || "—",
  clinic: u.doctor_profile?.clinic_name || "Unassigned",
  status: u.doctor_profile?.status || "Active"
});

export async function listAdminDoctors() {
  if (!live()) return getAdminDoctors();
  const { data } = await api.get("/admin/users", { role: "doctor" });
  return (data || []).map(fromApiDoctor);
}

/** Live: promotes an existing account (by email) to doctor. Sandbox: adds a demo record. */
export async function addAdminDoctor({ name, email, specialization, clinic }) {
  if (!live()) return addDoctor({ name, email, specialization, clinic });
  const body = { email };
  if (specialization) body.specialization = specialization;
  if (clinic) body.clinic_name = clinic;
  await api.post("/admin/doctors", body);
  return listAdminDoctors();
}

const fromApiClinic = (c) => ({
  id: c.id,
  name: c.name,
  location: c.location,
  contact: c.contact,
  status: c.status,
  doctorsCount: c.doctors_count ?? 0,
  patientsCount: "—"
});

export async function listClinics() {
  if (!live()) return getAdminClinics();
  const { data } = await api.get("/clinics");
  return (data || []).map(fromApiClinic);
}

export async function addAdminClinic({ name, location, contact }) {
  if (!live()) return addClinic({ name, location, contact });
  await api.post("/clinics", { name, location, contact });
  return listClinics();
}

export async function listAuditLogs() {
  if (!live()) return getAuditLogs();
  const { data } = await api.get("/admin/audit-logs", { limit: 200 });
  return (data || []).map((l) => ({
    id: l.id,
    timestamp: when(l.timestamp),
    actor: `${l.actor_role} (${l.actor_id})`,
    action: l.action,
    resource: l.target_id ? `${l.target_id}${l.details?.new_role ? ` → ${l.details.new_role}` : ""}` : "—",
    status: "SUCCESS"
  }));
}

export async function getAdminStats() {
  if (!live()) {
    return {
      doctors: getAdminDoctors().length,
      clinics: getAdminClinics().length,
      appointments: getAppointments().length,
      patients: CLINICIAN_PATIENTS_DEMO.length,
      openAlerts: getRiskAlerts().filter((a) => !a.status.includes("Resolved")).length,
      unassignedAlerts: 0
    };
  }
  const { data } = await api.get("/admin/stats");
  return {
    doctors: data.users?.doctor || 0,
    patients: data.users?.patient || 0,
    admins: data.users?.admin || 0,
    clinics: data.clinics,
    appointments: data.appointments,
    upcomingAppointments: data.upcoming_appointments,
    openAlerts: data.open_alerts,
    unassignedAlerts: data.unassigned_alerts
  };
}

/* ---------------- remembered patterns (memories) ---------------- */

export async function listMemories() {
  if (!live()) return [];
  const { data } = await api.get("/memories", { limit: 20 });
  return (data || []).map((m) => ({
    id: m.id,
    text: m.memory_text,
    type: m.memory_type,
    importance: Math.round((m.importance_score ?? 0.5) * 100)
  }));
}

/** feedback: "agree" | "disagree" | "partially" — adjusts the pattern's importance on the server */
export async function sendMemoryFeedback(id, feedback) {
  const { data } = await api.post(`/memories/${encodeURIComponent(id)}/feedback`, { user_feedback: feedback });
  return Math.round((data.updatedImportanceScore ?? 0.5) * 100);
}

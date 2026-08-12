/**
 * Admin Service Layer
 * Platform analytics, doctor/clinic administration, and audit logging.
 */

const DOCTORS_KEY = "sentimed_admin_doctors";
const CLINICS_KEY = "sentimed_admin_clinics";
const AUDIT_LOGS_KEY = "sentimed_admin_audit_logs";

export const INITIAL_DOCTORS = [
  {
    id: "D-201",
    name: "Dr. Sarah Jenkins",
    email: "sarah.jenkins@sentimed.io",
    specialization: "Clinical Neuropsychology",
    clinic: "SentiMed Central Clinic",
    status: "Active",
    assignedPatientsCount: 14
  },
  {
    id: "D-202",
    name: "Dr. Marcus Vance",
    email: "marcus.vance@sentimed.io",
    specialization: "Behavioral Psychotherapy",
    clinic: "MindWellness East Clinic",
    status: "Active",
    assignedPatientsCount: 8
  },
  {
    id: "D-203",
    name: "Dr. Elena Rostova",
    email: "elena.rostova@sentimed.io",
    specialization: "Psychiatry & Somnology",
    clinic: "SentiMed Central Clinic",
    status: "On Leave",
    assignedPatientsCount: 19
  }
];

export const INITIAL_CLINICS = [
  {
    id: "C-101",
    name: "SentiMed Central Clinic",
    location: "San Francisco, CA",
    contact: "+1 (415) 890-1234",
    status: "Active",
    doctorsCount: 12,
    patientsCount: 140
  },
  {
    id: "C-102",
    name: "MindWellness East Clinic",
    location: "Boston, MA",
    contact: "+1 (617) 555-4321",
    status: "Active",
    doctorsCount: 8,
    patientsCount: 95
  }
];

export const INITIAL_AUDIT_LOGS = [
  {
    id: "log-1",
    timestamp: "2026-08-12 10:14 AM",
    actor: "Admin (admin@sentimed.io)",
    action: "ADD_DOCTOR",
    resource: "Dr. Sarah Jenkins (D-201)",
    status: "SUCCESS"
  },
  {
    id: "log-2",
    timestamp: "2026-08-11 04:30 PM",
    actor: "System Auto-Audit",
    action: "PII_MASKING_POLICY_ENFORCED",
    resource: "Patient Journal Pipeline",
    status: "SUCCESS"
  },
  {
    id: "log-3",
    timestamp: "2026-08-10 09:00 AM",
    actor: "Dr. Sarah Jenkins",
    action: "MEDICATION_REMINDER_CREATED",
    resource: "Patient Gurnoor Sandhu (P-0041)",
    status: "SUCCESS"
  }
];

export const getAdminDoctors = () => {
  try {
    const saved = localStorage.getItem(DOCTORS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_DOCTORS;
};

export const getAdminClinics = () => {
  try {
    const saved = localStorage.getItem(CLINICS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_CLINICS;
};

export const getAuditLogs = () => {
  try {
    const saved = localStorage.getItem(AUDIT_LOGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return INITIAL_AUDIT_LOGS;
};

export const addDoctor = (docData) => {
  const current = getAdminDoctors();
  const created = {
    id: `D-${Math.floor(Math.random() * 900 + 100)}`,
    status: "Active",
    assignedPatientsCount: 0,
    ...docData
  };
  const updated = [created, ...current];
  localStorage.setItem(DOCTORS_KEY, JSON.stringify(updated));
  return updated;
};

export const addClinic = (clinicData) => {
  const current = getAdminClinics();
  const created = {
    id: `C-${Math.floor(Math.random() * 900 + 100)}`,
    status: "Active",
    doctorsCount: 0,
    patientsCount: 0,
    ...clinicData
  };
  const updated = [created, ...current];
  localStorage.setItem(CLINICS_KEY, JSON.stringify(updated));
  return updated;
};

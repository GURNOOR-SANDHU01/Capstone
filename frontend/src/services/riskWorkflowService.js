import { RISK_LEVELS } from "./screeningService";

/**
 * SentiMed Risk Workflow & Clinical Alert Service
 * Manages Doctor & Admin Safety Center alerts, triage queues, and event logs.
 */

const RISK_ALERTS_KEY = "sentimed_risk_alerts";

export const INITIAL_RISK_ALERTS = [
  {
    id: "alert-901",
    patientId: "P-0039",
    patientName: "Patient B (Anonymized)",
    doctorName: "Dr. Sarah Jenkins",
    riskCategory: RISK_LEVELS.HIGH_URGENT,
    timestamp: "2026-08-12 11:30 AM",
    triggerSource: "Safety Screening Assessment",
    status: "Urgent Review Required",
    details: "Reported frequent crisis thoughts and severe sleep disturbance (> 18% dip)."
  },
  {
    id: "alert-902",
    patientId: "P-0052",
    patientName: "Patient C (Anonymized)",
    doctorName: "Dr. Sarah Jenkins",
    riskCategory: RISK_LEVELS.MODERATE,
    timestamp: "2026-08-11 02:15 PM",
    triggerSource: "Wellness Screening Survey",
    status: "Moderate Flagged",
    details: "Elevated anxiety keywords and fatigue tags over 4 days."
  }
];

export const getRiskAlerts = () => {
  try {
    const saved = localStorage.getItem(RISK_ALERTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* localStorage unavailable: fall back to demo data */
  }
  return INITIAL_RISK_ALERTS;
};

export const saveRiskAlerts = (alerts) => {
  try {
    localStorage.setItem(RISK_ALERTS_KEY, JSON.stringify(alerts));
  } catch (err) {
    console.warn("Failed to save risk alerts", err);
  }
};

export const createRiskAlert = (screeningRecord) => {
  if (screeningRecord.riskCategory === RISK_LEVELS.LOW) return null;

  const alerts = getRiskAlerts();
  const newAlert = {
    id: `alert-${Date.now()}`,
    patientId: "P-0041",
    patientName: screeningRecord.patientName || "Gurnoor Sandhu",
    doctorName: "Dr. Sarah Jenkins",
    riskCategory: screeningRecord.riskCategory,
    timestamp: new Date().toLocaleString(),
    triggerSource: "Patient Screening Workflow",
    status: screeningRecord.riskCategory === RISK_LEVELS.HIGH_URGENT ? "Urgent Review Required" : "Moderate Flagged",
    details: screeningRecord.riskCategory === RISK_LEVELS.HIGH_URGENT
      ? "Patient screening responses triggered urgent safety review protocol."
      : "Patient reported moderate anxiety / sleep disruption."
  };

  const updated = [newAlert, ...alerts];
  saveRiskAlerts(updated);
  return newAlert;
};

export const markAlertResolved = (alertId) => {
  const alerts = getRiskAlerts();
  const updated = alerts.map(a => a.id === alertId ? { ...a, status: "Resolved & Reviewed" } : a);
  saveRiskAlerts(updated);
  return updated;
};

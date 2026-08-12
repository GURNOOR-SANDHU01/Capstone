/**
 * Doctor Service Layer
 * Manages clinical reminders, authorized patient lists, and medication instructions.
 */

const REMINDERS_KEY = "sentimed_doctor_reminders";

export const INITIAL_REMINDERS = [
  {
    id: "rem-1",
    patientId: "P-0041",
    patientName: "Gurnoor Sandhu",
    doctorName: "Dr. Sarah Jenkins",
    type: "Medication Reminder",
    medicationName: "Magnesium Glycinate (200mg)",
    schedule: "Daily at 9:00 PM before sleep",
    startDate: "2026-08-10",
    endDate: "2026-09-10",
    status: "Active",
    notes: "Authorized non-sedative sleep hygiene supplement instruction."
  },
  {
    id: "rem-2",
    patientId: "P-0039",
    patientName: "Patient B (Anonymized)",
    doctorName: "Dr. Sarah Jenkins",
    type: "Wellness Check-in",
    medicationName: "N/A",
    schedule: "Every 48 Hours",
    startDate: "2026-08-12",
    endDate: "2026-08-26",
    status: "Active",
    notes: "Prompt patient to complete CBT anxiety reframing sheet."
  }
];

export const getDoctorReminders = () => {
  try {
    const saved = localStorage.getItem(REMINDERS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn("Failed to load doctor reminders", err);
  }
  return INITIAL_REMINDERS;
};

export const saveDoctorReminders = (reminders) => {
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  } catch (err) {
    console.warn("Failed to save doctor reminders", err);
  }
};

export const createDoctorReminder = (data) => {
  const current = getDoctorReminders();
  const created = {
    id: `rem-${Date.now()}`,
    status: "Active",
    ...data
  };
  const updated = [created, ...current];
  saveDoctorReminders(updated);
  return { updated, created };
};

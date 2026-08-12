/**
 * SentiMed Appointment & Consultation Service
 * Manages full lifecycle appointment requests, approvals, rejections, rescheduling, and confirmed Google Meet consultations.
 */

const APPOINTMENTS_STORAGE_KEY = "sentimed_appointments";

export const APPOINTMENT_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  RESCHEDULE_REQUESTED: "RESCHEDULE_REQUESTED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED"
};

export const MOCK_INITIAL_APPOINTMENTS = [
  {
    id: "apt-101",
    patientId: "P-0041",
    patientName: "Gurnoor Sandhu",
    doctorId: "D-201",
    doctorName: "Dr. Sarah Jenkins",
    specialization: "Clinical Neuropsychology",
    clinicName: "SentiMed Central Clinic",
    date: "2026-08-15",
    time: "10:30 AM",
    type: "Video Consultation",
    status: APPOINTMENT_STATUS.CONFIRMED,
    createdBy: "patient",
    meetingProvider: "google-meet",
    meetingUrl: "https://meet.google.com/demo-sentimed-call",
    reason: "Follow-up CBT evaluation & sleep score review",
    notes: "Confirmed by clinician."
  },
  {
    id: "apt-102",
    patientId: "P-0041",
    patientName: "Gurnoor Sandhu",
    doctorId: "D-202",
    doctorName: "Dr. Marcus Vance",
    specialization: "Behavioral Psychotherapy",
    clinicName: "MindWellness Center",
    date: "2026-08-22",
    time: "02:00 PM",
    type: "Follow-up",
    status: APPOINTMENT_STATUS.PENDING,
    createdBy: "patient",
    meetingProvider: null,
    meetingUrl: null,
    reason: "Discuss stress management techniques",
    notes: "Awaiting clinician approval"
  },
  {
    id: "apt-103",
    patientId: "P-0041",
    patientName: "Gurnoor Sandhu",
    doctorId: "D-201",
    doctorName: "Dr. Sarah Jenkins",
    specialization: "Clinical Neuropsychology",
    clinicName: "SentiMed Central Clinic",
    date: "2026-08-18",
    time: "04:00 PM",
    type: "Video Consultation",
    status: APPOINTMENT_STATUS.RESCHEDULE_REQUESTED,
    createdBy: "patient",
    meetingProvider: null,
    meetingUrl: null,
    rescheduledDate: "2026-08-19",
    rescheduledTime: "03:00 PM",
    rescheduleNote: "Clinician has clinic emergency on original date. Please review proposed time.",
    reason: "Monthly check-in"
  },
  {
    id: "apt-104",
    patientId: "P-0041",
    patientName: "Gurnoor Sandhu",
    doctorId: "D-202",
    doctorName: "Dr. Marcus Vance",
    specialization: "Behavioral Psychotherapy",
    clinicName: "MindWellness Center",
    date: "2026-08-10",
    time: "01:00 PM",
    type: "Video Consultation",
    status: APPOINTMENT_STATUS.REJECTED,
    createdBy: "patient",
    meetingProvider: null,
    meetingUrl: null,
    rejectionReason: "Doctor unavailable due to scheduled medical conference.",
    reason: "Initial evaluation"
  },
  {
    id: "apt-105",
    patientId: "P-0041",
    patientName: "Gurnoor Sandhu",
    doctorId: "D-201",
    doctorName: "Dr. Sarah Jenkins",
    specialization: "Clinical Neuropsychology",
    clinicName: "SentiMed Central Clinic",
    date: "2026-08-25",
    time: "11:00 AM",
    type: "Video Consultation",
    status: APPOINTMENT_STATUS.CONFIRMED,
    createdBy: "doctor",
    meetingProvider: "google-meet",
    meetingUrl: "https://meet.google.com/demo-sentimed-call",
    reason: "Clinician-initiated cognitive wellness follow-up",
    notes: "Directly scheduled by Dr. Sarah Jenkins"
  }
];

export const getAppointments = () => {
  try {
    const saved = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn("Failed to load appointments", err);
  }
  return MOCK_INITIAL_APPOINTMENTS;
};

export const saveAppointments = (appointments) => {
  try {
    localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(appointments));
  } catch (err) {
    console.warn("Failed to save appointments", err);
  }
};

/**
 * Patient requests an appointment (status: PENDING, createdBy: "patient")
 */
export const createPatientAppointment = (data) => {
  const current = getAppointments();
  const newApt = {
    id: `apt-${Date.now()}`,
    status: APPOINTMENT_STATUS.PENDING,
    createdBy: "patient",
    meetingProvider: null,
    meetingUrl: null,
    ...data
  };
  const updated = [newApt, ...current];
  saveAppointments(updated);
  return { updated, newApt };
};

/**
 * Doctor creates an appointment directly (status: CONFIRMED, createdBy: "doctor")
 */
export const createDoctorAppointment = (data) => {
  const current = getAppointments();
  const newApt = {
    id: `apt-${Date.now()}`,
    status: APPOINTMENT_STATUS.CONFIRMED,
    createdBy: "doctor",
    meetingProvider: "google-meet",
    meetingUrl: "https://meet.google.com/demo-sentimed-call",
    ...data
  };
  const updated = [newApt, ...current];
  saveAppointments(updated);
  return { updated, newApt };
};

/**
 * Doctor confirms an appointment (status: CONFIRMED)
 */
export const confirmAppointment = (appointmentId) => {
  const current = getAppointments();
  const updated = current.map(apt => {
    if (apt.id === appointmentId) {
      return {
        ...apt,
        status: APPOINTMENT_STATUS.CONFIRMED,
        meetingProvider: "google-meet",
        meetingUrl: "https://meet.google.com/demo-sentimed-call",
        notes: "Confirmed by clinician."
      };
    }
    return apt;
  });
  saveAppointments(updated);
  return updated;
};

/**
 * Doctor rejects an appointment with reason (status: REJECTED)
 */
export const rejectAppointment = (appointmentId, rejectionReason) => {
  const current = getAppointments();
  const updated = current.map(apt => {
    if (apt.id === appointmentId) {
      return {
        ...apt,
        status: APPOINTMENT_STATUS.REJECTED,
        rejectionReason: rejectionReason || "Clinician unavailable at requested time."
      };
    }
    return apt;
  });
  saveAppointments(updated);
  return updated;
};

/**
 * Doctor reschedules appointment with proposed date/time (status: RESCHEDULE_REQUESTED)
 */
export const rescheduleAppointment = (appointmentId, rescheduledDate, rescheduledTime, rescheduleNote) => {
  const current = getAppointments();
  const updated = current.map(apt => {
    if (apt.id === appointmentId) {
      return {
        ...apt,
        status: APPOINTMENT_STATUS.RESCHEDULE_REQUESTED,
        rescheduledDate,
        rescheduledTime,
        rescheduleNote: rescheduleNote || "Clinician proposed a new consultation time."
      };
    }
    return apt;
  });
  saveAppointments(updated);
  return updated;
};

/**
 * Patient accepts rescheduled time (status: CONFIRMED)
 */
export const acceptReschedule = (appointmentId) => {
  const current = getAppointments();
  const updated = current.map(apt => {
    if (apt.id === appointmentId) {
      return {
        ...apt,
        date: apt.rescheduledDate || apt.date,
        time: apt.rescheduledTime || apt.time,
        status: APPOINTMENT_STATUS.CONFIRMED,
        meetingProvider: "google-meet",
        meetingUrl: "https://meet.google.com/demo-sentimed-call",
        rescheduledDate: null,
        rescheduledTime: null,
        rescheduleNote: null,
        notes: "Rescheduled time accepted by patient."
      };
    }
    return apt;
  });
  saveAppointments(updated);
  return updated;
};

/**
 * Cancel appointment (status: CANCELLED)
 */
export const cancelAppointment = (appointmentId) => {
  const current = getAppointments();
  const updated = current.map(apt => {
    if (apt.id === appointmentId) {
      return { ...apt, status: APPOINTMENT_STATUS.CANCELLED };
    }
    return apt;
  });
  saveAppointments(updated);
  return updated;
};

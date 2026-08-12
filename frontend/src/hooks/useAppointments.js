import { useState, useCallback, useMemo } from 'react';
import { 
  getAppointments, 
  createPatientAppointment, 
  createDoctorAppointment, 
  confirmAppointment, 
  rejectAppointment, 
  rescheduleAppointment, 
  acceptReschedule, 
  cancelAppointment,
  APPOINTMENT_STATUS
} from '../services/appointmentService';

export function useAppointments() {
  const [appointments, setAppointments] = useState(() => getAppointments());

  const refresh = useCallback(() => {
    setAppointments(getAppointments());
  }, []);

  const requestPatientAppointment = useCallback((data) => {
    const { updated, newApt } = createPatientAppointment(data);
    setAppointments(updated);
    return newApt;
  }, []);

  const scheduleDoctorAppointment = useCallback((data) => {
    const { updated, newApt } = createDoctorAppointment(data);
    setAppointments(updated);
    return newApt;
  }, []);

  const handleConfirm = useCallback((id) => {
    const updated = confirmAppointment(id);
    setAppointments(updated);
  }, []);

  const handleReject = useCallback((id, reason) => {
    const updated = rejectAppointment(id, reason);
    setAppointments(updated);
  }, []);

  const handleReschedule = useCallback((id, date, time, note) => {
    const updated = rescheduleAppointment(id, date, time, note);
    setAppointments(updated);
  }, []);

  const handleAcceptReschedule = useCallback((id) => {
    const updated = acceptReschedule(id);
    setAppointments(updated);
  }, []);

  const handleCancel = useCallback((id) => {
    const updated = cancelAppointment(id);
    setAppointments(updated);
  }, []);

  // Filtered computed views
  const pendingRequests = useMemo(() => {
    return appointments.filter(a => a.status === APPOINTMENT_STATUS.PENDING);
  }, [appointments]);

  const confirmedConsultations = useMemo(() => {
    return appointments.filter(a => a.status === APPOINTMENT_STATUS.CONFIRMED);
  }, [appointments]);

  const rescheduleRequested = useMemo(() => {
    return appointments.filter(a => a.status === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED);
  }, [appointments]);

  return {
    appointments,
    pendingRequests,
    confirmedConsultations,
    rescheduleRequested,
    refresh,
    requestPatientAppointment,
    scheduleDoctorAppointment,
    handleConfirm,
    handleReject,
    handleReschedule,
    handleAcceptReschedule,
    handleCancel
  };
}

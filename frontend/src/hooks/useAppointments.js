import { useCallback, useMemo } from 'react';
import {
  fetchAppointments,
  requestAppointment,
  scheduleAppointment,
  appointmentAction,
  APPOINTMENT_STATUS
} from '../services/appointmentService';
import { useAsyncData } from './useAsyncData';

/**
 * Appointment list + actions. Each action resolves with the server's updated appointment
 * and replaces it in local state (no page reload, no unconfirmed optimistic data).
 * Actions throw on failure so the caller can show an error.
 */
export function useAppointments() {
  const { data, setData, loading, error, reload } = useAsyncData(fetchAppointments, [], []);
  const appointments = useMemo(() => data || [], [data]);

  const upsert = useCallback((apt) => {
    setData((prev) => {
      const list = prev || [];
      return list.some((a) => a.id === apt.id) ? list.map((a) => (a.id === apt.id ? apt : a)) : [apt, ...list];
    });
    return apt;
  }, [setData]);

  const requestPatientAppointment = useCallback(async (form) => upsert(await requestAppointment(form)), [upsert]);
  const scheduleDoctorAppointment = useCallback(async (form) => upsert(await scheduleAppointment(form)), [upsert]);
  const handleConfirm = useCallback(async (id) => upsert(await appointmentAction(id, 'confirm')), [upsert]);
  const handleReject = useCallback(async (id, reason) => upsert(await appointmentAction(id, 'reject', { reason })), [upsert]);
  const handleReschedule = useCallback(
    async (id, date, time, note) => upsert(await appointmentAction(id, 'reschedule', { date, time, note })),
    [upsert]
  );
  const handleAcceptReschedule = useCallback(async (id) => upsert(await appointmentAction(id, 'accept_reschedule')), [upsert]);
  const handleCancel = useCallback(async (id) => upsert(await appointmentAction(id, 'cancel')), [upsert]);

  const pendingRequests = useMemo(() => appointments.filter((a) => a.status === APPOINTMENT_STATUS.PENDING), [appointments]);
  const confirmedConsultations = useMemo(() => appointments.filter((a) => a.status === APPOINTMENT_STATUS.CONFIRMED), [appointments]);
  const rescheduleRequested = useMemo(
    () => appointments.filter((a) => a.status === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED),
    [appointments]
  );

  return {
    appointments,
    loading,
    error,
    pendingRequests,
    confirmedConsultations,
    rescheduleRequested,
    refresh: reload,
    requestPatientAppointment,
    scheduleDoctorAppointment,
    handleConfirm,
    handleReject,
    handleReschedule,
    handleAcceptReschedule,
    handleCancel
  };
}

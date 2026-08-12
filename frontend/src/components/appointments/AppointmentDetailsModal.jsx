import React from 'react';
import { Modal, Button, Badge } from '../ui';
import { AppointmentTimeline } from './AppointmentTimeline';
import { MeetingButton } from './MeetingButton';

export function AppointmentDetailsModal({ isOpen, onClose, appointment }) {
  if (!appointment) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Appointment Details & History">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{appointment.doctorName}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{appointment.specialization} • {appointment.clinicName}</div>
          </div>
          <Badge variant={appointment.status === "CONFIRMED" ? "primary" : appointment.status === "REJECTED" ? "danger" : "warning"}>
            {appointment.status}
          </Badge>
        </div>

        <AppointmentTimeline status={appointment.status} createdBy={appointment.createdBy} />

        <div style={{ background: "var(--color-bg)", padding: 14, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <div><strong>Scheduled Date & Time:</strong> {appointment.date} at {appointment.time}</div>
          <div><strong>Consultation Type:</strong> {appointment.type}</div>
          <div><strong>Created By:</strong> {appointment.createdBy === "doctor" ? "Clinician (Direct)" : "Patient Request"}</div>
          {appointment.reason && <div><strong>Reason:</strong> {appointment.reason}</div>}
          {appointment.notes && <div><strong>Notes:</strong> {appointment.notes}</div>}
        </div>

        {appointment.rejectionReason && (
          <div style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)", padding: 14, borderRadius: 10, fontSize: 13 }}>
            <strong>Rejection Reason from Clinician:</strong>
            <p style={{ marginTop: 4, margin: 0 }}>{appointment.rejectionReason}</p>
          </div>
        )}

        {appointment.rescheduledDate && (
          <div style={{ background: "#FFF8EC", border: "1px solid #F5A623", padding: 14, borderRadius: 10, fontSize: 13 }}>
            <strong>Proposed Rescheduled Time:</strong> {appointment.rescheduledDate} at {appointment.rescheduledTime}
            {appointment.rescheduleNote && <p style={{ marginTop: 4, margin: 0, color: "var(--color-text-muted)" }}>Note: {appointment.rescheduleNote}</p>}
          </div>
        )}

        {appointment.status === "CONFIRMED" && (
          <MeetingButton meetingUrl={appointment.meetingUrl} size="md" />
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Button variant="outline" onClick={onClose}>Close Details</Button>
        </div>
      </div>
    </Modal>
  );
}

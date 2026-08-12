import React from 'react';
import { CheckCircle2, Clock, Calendar, Video } from 'lucide-react';
import { APPOINTMENT_STATUS } from '../../services/appointmentService';

export function AppointmentTimeline({ status, createdBy }) {
  const steps = [
    { key: "requested", label: "Requested", done: true },
    { key: "reviewed", label: "Clinician Review", done: status !== APPOINTMENT_STATUS.PENDING },
    { key: "confirmed", label: "Confirmed", done: status === APPOINTMENT_STATUS.CONFIRMED || status === APPOINTMENT_STATUS.COMPLETED },
    { key: "scheduled", label: "Google Meet Ready", done: status === APPOINTMENT_STATUS.CONFIRMED || status === APPOINTMENT_STATUS.COMPLETED }
  ];

  if (status === APPOINTMENT_STATUS.REJECTED) {
    return (
      <div style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
        Status: Request Declined by Clinician
      </div>
    );
  }

  if (status === APPOINTMENT_STATUS.CANCELLED) {
    return (
      <div style={{ background: "var(--color-bg)", padding: "10px 14px", borderRadius: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
        Status: Appointment Cancelled
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "8px 0" }}>
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: step.done ? 1 : 0.4 }}>
            <CheckCircle2 size={15} color={step.done ? "var(--color-primary-dark)" : "var(--color-text-muted)"} />
            <span style={{ fontSize: 11, fontWeight: step.done ? 700 : 500, color: step.done ? "var(--color-text)" : "var(--color-text-muted)" }}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, backgroundColor: step.done ? "var(--color-primary)" : "var(--color-border)" }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

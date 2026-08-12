import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Stethoscope, User, Info, Check, X, RefreshCw } from 'lucide-react';
import { Card, Badge, Button } from '../ui';
import { MeetingButton } from './MeetingButton';
import { AppointmentDetailsModal } from './AppointmentDetailsModal';
import { APPOINTMENT_STATUS } from '../../services/appointmentService';

export function AppointmentCard({ 
  appointment, 
  userRole = "patient", 
  onConfirm,
  onReject,
  onReschedule,
  onAcceptReschedule,
  onCancel 
}) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const isDoctor = userRole === "doctor";
  const displayName = isDoctor ? appointment.patientName : appointment.doctorName;
  const subText = isDoctor ? `Patient ID: ${appointment.patientId}` : appointment.specialization;

  const isPending = appointment.status === APPOINTMENT_STATUS.PENDING;
  const isConfirmed = appointment.status === APPOINTMENT_STATUS.CONFIRMED;
  const isRejected = appointment.status === APPOINTMENT_STATUS.REJECTED;
  const isRescheduleReq = appointment.status === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED;

  return (
    <>
      <Card className="appointment-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#EAF7F2", color: "#2E7D62", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isDoctor ? <User size={22} /> : <Stethoscope size={22} />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>{displayName}</span>
                {appointment.createdBy && (
                  <span className="badge badge-muted" style={{ fontSize: 10 }}>
                    {appointment.createdBy === "doctor" ? "Clinician Scheduled" : "Patient Requested"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{subText}</div>
              {appointment.clinicName && (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <MapPin size={12} /> {appointment.clinicName}
                </div>
              )}
            </div>
          </div>

          <Badge variant={isConfirmed ? "primary" : isRejected ? "danger" : isRescheduleReq ? "warning" : "muted"}>
            {appointment.status}
          </Badge>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, background: "var(--color-bg)", padding: "10px 14px", borderRadius: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--color-primary-dark)" }}>
            <Calendar size={15} />
            <span>{appointment.date}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text)" }}>
            <Clock size={15} />
            <span>{appointment.time}</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>• {appointment.type}</span>
        </div>

        {appointment.reason && (
          <div style={{ fontSize: 12, color: "var(--color-text)" }}>
            <strong>Reason:</strong> {appointment.reason}
          </div>
        )}

        {isRejected && appointment.rejectionReason && (
          <div style={{ fontSize: 12, color: "var(--color-danger)", background: "var(--color-danger-soft)", padding: 10, borderRadius: 6 }}>
            <strong>Rejection Reason:</strong> {appointment.rejectionReason}
          </div>
        )}

        {isRescheduleReq && (
          <div style={{ fontSize: 12, color: "#B8690A", background: "#FFF8EC", padding: 10, borderRadius: 6 }}>
            <strong>Proposed Time:</strong> {appointment.rescheduledDate} at {appointment.rescheduledTime}
            {appointment.rescheduleNote && <div style={{ fontSize: 11, marginTop: 2 }}>Note: {appointment.rescheduleNote}</div>}
          </div>
        )}

        {/* Action Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <Button variant="ghost" size="sm" icon={Info} onClick={() => setShowDetailsModal(true)}>
            View Details
          </Button>

          {/* Doctor Specific Actions */}
          {isDoctor && isPending && (
            <>
              <Button variant="outline" size="sm" icon={X} onClick={() => onReject(appointment.id)}>
                Reject
              </Button>
              <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => onReschedule(appointment)}>
                Reschedule
              </Button>
              <Button variant="primary" size="sm" icon={Check} onClick={() => onConfirm(appointment.id)}>
                Confirm Request
              </Button>
            </>
          )}

          {/* Patient Specific Actions */}
          {!isDoctor && isPending && onCancel && (
            <Button variant="outline" size="sm" onClick={() => onCancel(appointment.id)}>
              Cancel Request
            </Button>
          )}

          {!isDoctor && isRescheduleReq && onAcceptReschedule && (
            <Button variant="primary" size="sm" icon={Check} onClick={() => onAcceptReschedule(appointment.id)}>
              Accept New Time
            </Button>
          )}

          {isConfirmed && (
            <MeetingButton
              meetingUrl={appointment.meetingUrl}
              provider={appointment.meetingProvider}
              size="sm"
            />
          )}
        </div>
      </Card>

      <AppointmentDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        appointment={appointment}
      />
    </>
  );
}

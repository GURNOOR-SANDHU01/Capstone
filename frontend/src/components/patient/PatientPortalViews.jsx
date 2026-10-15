import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  Bell,
  Plus,
  FileText,
  Lock,
  Users,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import { useAppointments } from '../../hooks/useAppointments';
import { listCareInstructions, getConsentStatus } from '../../services/clinicalApi';
import { describeError } from '../../services/apiClient';
import { useAsyncData } from '../../hooks/useAsyncData';
import { MessageThread } from '../doctor/DoctorPortalViews';
import { meetingProviderLabel } from '../../services/appointmentService';
import { AppointmentCard } from '../appointments/AppointmentCard';
import { AppointmentRequestDrawer } from '../appointments/AppointmentRequestDrawer';
import { MeetingButton } from '../appointments/MeetingButton';
import { PageHeader, Button, Card, Badge, EmptyState, LoadState } from '../ui';
import { PageTransition } from '../animations';

// Patient Appointments View (Request & Lifecycle Management)
export function PatientAppointmentsView({ onNotification }) {
  const {
    appointments,
    loading,
    error,
    refresh,
    requestPatientAppointment,
    handleAcceptReschedule,
    handleCancel
  } = useAppointments();

  const [isAppointmentDrawerOpen, setIsAppointmentDrawerOpen] = useState(false);
  const notify = (title, message) => onNotification && onNotification(title, message);

  const handleRequestSubmit = async (data) => {
    await requestPatientAppointment(data); // errors are shown inside the drawer
    notify("Appointment request sent successfully.", `Your request has been sent to ${data.doctorName}.`);
  };

  const handleCancelClick = async (id) => {
    try {
      await handleCancel(id);
      notify("Request Cancelled", "Selected appointment request has been cancelled.");
    } catch (err) {
      notify("Cancel Failed", describeError(err));
    }
  };

  const handleAcceptClick = async (id) => {
    try {
      await handleAcceptReschedule(id);
      notify("Time Accepted", "Rescheduled appointment confirmed.");
    } catch (err) {
      notify("Update Failed", describeError(err));
    }
  };

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Appointments"
          description="Manage your appointment requests and upcoming consultations."
          action={
            <Button icon={Plus} onClick={() => setIsAppointmentDrawerOpen(true)}>
              Schedule Consultation
            </Button>
          }
        />

        {/* Appointment List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <LoadState loading={loading} error={error} onRetry={refresh} label="Loading appointments..." />
          {loading || error ? null : appointments.length === 0 ? (
            <EmptyState title="No Appointments Scheduled" description="Click 'Schedule Consultation' above to request an appointment." />
          ) : (
            appointments.map((apt) => (
              <AppointmentCard
                key={apt.id}
                appointment={apt}
                userRole="patient"
                onCancel={handleCancelClick}
                onAcceptReschedule={handleAcceptClick}
              />
            ))
          )}
        </div>

        {/* Right-Side Appointment Request Drawer */}
        <AppointmentRequestDrawer
          open={isAppointmentDrawerOpen}
          onClose={() => setIsAppointmentDrawerOpen(false)}
          onSubmit={handleRequestSubmit}
        />
      </div>
    </PageTransition>
  );
}

// Patient Doctor Consultations View (CONFIRMED Google Meet Meetings ONLY)
export function PatientConsultationsView() {
  const { confirmedConsultations, loading, error, refresh } = useAppointments();

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Doctor Consultations"
          description="View your confirmed consultations and join scheduled meetings."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <LoadState loading={loading} error={error} onRetry={refresh} label="Loading consultations..." />
          {loading || error ? null : confirmedConsultations.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No Confirmed Consultations"
              description="Confirmed appointments with their video call links will appear here once approved by your doctor."
            />
          ) : (
            confirmedConsultations.map((apt) => (
              <Card key={apt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>{apt.doctorName}</span>
                    <Badge variant="primary">{meetingProviderLabel(apt.meetingProvider)}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                    {apt.specialization} • {apt.clinicName}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary-dark)", marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
                    <span><Calendar size={14} style={{ display: "inline", marginRight: 4 }} />{apt.date}</span>
                    <span><Clock size={14} style={{ display: "inline", marginRight: 4 }} />{apt.time}</span>
                  </div>
                </div>

                <MeetingButton
                  meetingUrl={apt.meetingUrl}
                  provider={apt.meetingProvider}
                  size="md"
                />
              </Card>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}

// Patient Reminders Sub-view
export function PatientRemindersView() {
  const remindersState = useAsyncData(listCareInstructions, [], []);
  const reminders = remindersState.data || [];

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Care & Medication Reminders"
          description="Authorized instructions and schedules issued by your care coordinator."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <LoadState loading={remindersState.loading} error={remindersState.error} onRetry={remindersState.reload} label="Loading reminders..." />
          {!remindersState.loading && !remindersState.error && reminders.length === 0 && (
            <EmptyState icon={Bell} title="No reminders yet" description="Care instructions from your doctor will appear here." />
          )}
          {reminders.map((rem) => (
            <div key={rem.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FFF8EC", color: "#B8690A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bell size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{rem.medicationName !== "N/A" ? rem.medicationName : rem.type}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Prescribed by {rem.doctorName} • {rem.schedule}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text)", marginTop: 4 }}>{rem.notes}</div>
                </div>
              </div>
              <span className="badge badge-warning">{rem.status}</span>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

// Patient History Sub-view
export function PatientHistoryView({ entries = [] }) {

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Activity History"
          description="Comprehensive record of consultations, AI chats, and journal entries."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.length === 0 && (
            <EmptyState title="No Activity Yet" description="Your journal entries will appear here once you start writing." />
          )}
          {entries.map((e) => (
            <div key={e.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <FileText size={18} color="var(--color-primary-dark)" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Journal Entry: {e.mood}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{e.date} • Score: {e.sentiment}%</div>
                </div>
              </div>
              <span className={`badge ${e.privacy === "shared" ? "badge-primary" : "badge-muted"}`}>
                {e.privacy === "shared" ? "Shared with Doctor" : "Private"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

// Patient Secure Messaging (with doctors the patient currently consents to)
export function PatientMessagingView({ onNotification }) {
  const consent = useAsyncData(getConsentStatus, [], { bridges: [] });
  const doctors = (consent.data?.bridges || []).filter((b) => b.active);
  const [doctorId, setDoctorId] = useState("");
  const selected = doctorId || doctors[0]?.doctorId || "";
  const doctorName = doctors.find((d) => d.doctorId === selected)?.doctorName || "your doctor";

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "calc(100vh - 120px)" }}>
        <PageHeader
          title="Care Team Messages"
          description="Secure messages with doctors you have granted access to in Profile & Settings."
        />
        <LoadState loading={consent.loading} error={consent.error} onRetry={consent.reload} label="Loading your care team..." />
        {!consent.loading && !consent.error && doctors.length === 0 && (
          <EmptyState
            icon={Users}
            title="No care team yet"
            description="Grant a doctor access from Profile & Settings to start a secure conversation."
          />
        )}
        {doctors.length > 0 && (
          <>
            <select className="input-field" value={selected} onChange={(e) => setDoctorId(e.target.value)} aria-label="Select doctor">
              {doctors.map((d) => (
                <option key={d.doctorId} value={d.doctorId}>{d.doctorName}</option>
              ))}
            </select>
            <MessageThread counterpartId={selected} counterpartName={doctorName} selfRole="patient" onNotification={onNotification} />
          </>
        )}
      </div>
    </PageTransition>
  );
}

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
import { getDoctorReminders } from '../../services/doctorService';
import { getJournalEntries } from '../../services/journalService';
import { AppointmentCard } from '../appointments/AppointmentCard';
import { AppointmentRequestDrawer } from '../appointments/AppointmentRequestDrawer';
import { MeetingButton } from '../appointments/MeetingButton';
import { PageHeader, Button, Card, Badge, EmptyState } from '../ui';
import { PageTransition } from '../animations';

// Patient Appointments View (Request & Lifecycle Management)
export function PatientAppointmentsView({ onNotification }) {
  const { 
    appointments, 
    requestPatientAppointment, 
    handleAcceptReschedule, 
    handleCancel 
  } = useAppointments();

  const [isAppointmentDrawerOpen, setIsAppointmentDrawerOpen] = useState(false);

  const handleRequestSubmit = (data) => {
    requestPatientAppointment(data);
    if (onNotification) {
      onNotification("Appointment request sent successfully.", `Your request has been sent to ${data.doctorName}.`);
    }
  };

  const handleCancelClick = (id) => {
    handleCancel(id);
    if (onNotification) {
      onNotification("Request Cancelled", "Selected appointment request has been cancelled.");
    }
  };

  const handleAcceptClick = (id) => {
    handleAcceptReschedule(id);
    if (onNotification) {
      onNotification("Time Accepted", "Rescheduled appointment confirmed.");
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
          {appointments.length === 0 ? (
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
  const { confirmedConsultations } = useAppointments();

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Doctor Consultations"
          description="View your confirmed consultations and join scheduled meetings."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {confirmedConsultations.length === 0 ? (
            <EmptyState 
              icon={Video} 
              title="No Confirmed Consultations" 
              description="Confirmed appointments with Google Meet links will appear here once approved by your doctor." 
            />
          ) : (
            confirmedConsultations.map((apt) => (
              <Card key={apt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>{apt.doctorName}</span>
                    <Badge variant="primary">Google Meet</Badge>
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
  const reminders = getDoctorReminders();

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Care & Medication Reminders"
          description="Authorized instructions and schedules issued by your care coordinator."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
export function PatientHistoryView() {
  const entries = getJournalEntries();

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Activity History"
          description="Comprehensive record of consultations, AI chats, and journal entries."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

import React, { useState } from 'react';
import { 
  Users, 
  Video, 
  Calendar, 
  Bell, 
  Lock, 
  ShieldCheck, 
  Plus, 
  Send,
  Clock,
  CheckCircle2
} from 'lucide-react';

import { CLINICIAN_PATIENTS_DEMO } from '../../data/mockData';
import { getJournalEntries } from '../../services/journalService';
import { getDoctorReminders, createDoctorReminder } from '../../services/doctorService';
import { getMessages, sendMessage } from '../../services/messagingService';
import { useAppointments } from '../../hooks/useAppointments';
import { AppointmentCard } from '../appointments/AppointmentCard';
import { DoctorScheduleDrawer } from '../appointments/DoctorScheduleDrawer';
import { CareInstructionDrawer } from './CareInstructionDrawer';
import { RescheduleAppointmentModal } from '../appointments/RescheduleAppointmentModal';
import { MeetingButton } from '../appointments/MeetingButton';
import { PageHeader, Button, Card, Badge, Modal, EmptyState } from '../ui';
import { PageTransition } from '../animations';
import SentimentBar from '../SentimentBar';

// Doctor Care Dashboard View
export function DoctorDashboardView({ onNavigate }) {
  const patients = CLINICIAN_PATIENTS_DEMO;
  const { confirmedConsultations, pendingRequests } = useAppointments();

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div 
          className="card" 
          style={{ 
            background: "linear-gradient(135deg, #1A1A2E 0%, #2E7D62 100%)", 
            color: "#FFFFFF", 
            padding: 28,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16
          }}
        >
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--color-primary)" }}>
              CLINICAL WORKSPACE
            </span>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, marginTop: 4 }}>
              Doctor Care Dashboard
            </h1>
            <p style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
              Monitor authorized patient telemetry, review appointment requests, and join Google Meet consultations.
            </p>
          </div>

          <Button 
            variant="primary" 
            size="lg" 
            icon={Calendar} 
            onClick={() => onNavigate('doctor-appointments')}
            style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E" }}
          >
            Manage Appointments ({pendingRequests.length} Pending)
          </Button>
        </div>

        <div className="app-grid-3">
          <div className="card">
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>ASSIGNED PATIENTS</span>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", marginTop: 4 }}>{patients.length}</div>
            <span className="badge badge-primary" style={{ marginTop: 8 }}>Authorized Roster</span>
          </div>

          <div className="card">
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>CONFIRMED CONSULTATIONS</span>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-primary-dark)", marginTop: 4 }}>{confirmedConsultations.length}</div>
            <span className="badge badge-primary" style={{ marginTop: 8 }}>Google Meet Scheduled</span>
          </div>

          <div className="card">
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>PENDING REQUESTS</span>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-warning)", marginTop: 4 }}>{pendingRequests.length}</div>
            <span className="badge badge-warning" style={{ marginTop: 8 }}>Requires Doctor Review</span>
          </div>
        </div>

        {/* Roster Summary */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Authorized Patient Overview</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('doctor-patients')}>View All</Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {patients.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--color-bg)", borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>ID: {p.id} • Streak: {p.streak} days</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`badge ${p.status === "danger" ? "badge-danger" : p.status === "monitor" ? "badge-warning" : "badge-primary"}`}>
                    {p.status}
                  </span>
                  <MeetingButton
                    meetingUrl="https://meet.google.com/demo-sentimed-call"
                    size="sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

// Doctor Appointments View (Request Queue & Confirm/Reject/Reschedule Actions)
export function DoctorAppointmentsView({ onNotification }) {
  const { 
    appointments, 
    handleConfirm, 
    handleReject, 
    handleReschedule, 
    scheduleDoctorAppointment 
  } = useAppointments();

  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);
  const [rejectingAptId, setRejectingAptId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reschedulingApt, setReschedulingApt] = useState(null);

  const handleConfirmClick = (id) => {
    handleConfirm(id);
    if (onNotification) {
      onNotification("Appointment Confirmed", "Meeting assigned with Google Meet link.");
    }
  };

  const handleRejectSubmit = (e) => {
    e.preventDefault();
    if (rejectingAptId) {
      handleReject(rejectingAptId, rejectionReason);
      setRejectingAptId(null);
      setRejectionReason("");
      if (onNotification) {
        onNotification("Request Declined", "Rejection reason saved and sent to patient.");
      }
    }
  };

  const handleRescheduleSubmit = (id, date, time, note) => {
    handleReschedule(id, date, time, note);
    if (onNotification) {
      onNotification("Reschedule Sent", "Proposed new time sent to patient for review.");
    }
  };

  const handleDoctorScheduleSubmit = (data) => {
    scheduleDoctorAppointment(data);
    if (onNotification) {
      onNotification("Appointment Scheduled", `Confirmed consultation scheduled for ${data.patientName}`);
    }
  };

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Appointments Management"
          description="Review patient appointment requests, confirm, reject, or propose new dates."
          action={
            <Button icon={Plus} onClick={() => setIsScheduleDrawerOpen(true)}>
              Schedule Direct Appointment
            </Button>
          }
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {appointments.map(apt => (
            <AppointmentCard
              key={apt.id}
              appointment={apt}
              userRole="doctor"
              onConfirm={handleConfirmClick}
              onReject={(id) => setRejectingAptId(id)}
              onReschedule={(aptToReschedule) => setReschedulingApt(aptToReschedule)}
            />
          ))}
        </div>

        {/* Right-Side Doctor Schedule Drawer */}
        <DoctorScheduleDrawer
          open={isScheduleDrawerOpen}
          onClose={() => setIsScheduleDrawerOpen(false)}
          onSubmit={handleDoctorScheduleSubmit}
        />

        {/* Reject Dialog */}
        <Modal isOpen={Boolean(rejectingAptId)} onClose={() => setRejectingAptId(null)} title="Decline Appointment Request">
          <form onSubmit={handleRejectSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>REASON FOR DECLINING</label>
              <textarea 
                className="input-field" 
                rows={3} 
                placeholder="Explain reason (e.g. Doctor unavailable at requested time)..." 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                required 
                style={{ height: "auto" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button variant="outline" onClick={() => setRejectingAptId(null)}>Cancel</Button>
              <Button type="submit" variant="danger">Decline Request</Button>
            </div>
          </form>
        </Modal>

        {/* Reschedule Modal */}
        <RescheduleAppointmentModal
          isOpen={Boolean(reschedulingApt)}
          onClose={() => setReschedulingApt(null)}
          appointment={reschedulingApt}
          onSubmit={handleRescheduleSubmit}
        />
      </div>
    </PageTransition>
  );
}

// Doctor Consultations View (Today's CONFIRMED Google Meet Meetings ONLY)
export function DoctorConsultationsView() {
  const { confirmedConsultations } = useAppointments();

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Doctor Consultations"
          description="View today's confirmed clinical consultations and join Google Meet meetings."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {confirmedConsultations.length === 0 ? (
            <EmptyState 
              icon={Video} 
              title="No Confirmed Consultations Today" 
              description="Confirmed patient appointments will appear here with active Google Meet links." 
            />
          ) : (
            confirmedConsultations.map((apt) => (
              <Card key={apt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>Patient: {apt.patientName}</span>
                    <Badge variant="primary">Google Meet</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                    Patient ID: {apt.patientId} • {apt.type}
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

// Doctor Shared Journal Review Sub-view
export function DoctorSharedJournalsView() {
  const allEntries = getJournalEntries();
  const sharedEntries = allEntries.filter(e => e.privacy === "shared");

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Shared Patient Journals</h1>
            <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ShieldCheck size={12} /> Authorized Access Only
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Backend permissions strictly enforce that only entries explicitly marked as "SHARED WITH DOCTOR" are accessible.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sharedEntries.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--color-text-muted)" }}>
              <Lock size={32} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
              <p>No patient entries shared with you yet.</p>
            </div>
          ) : (
            sharedEntries.map(e => (
              <div key={e.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Gurnoor Sandhu (P-0041)</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{e.date}</div>
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.5 }}>{e.text}</p>
                <SentimentBar value={e.sentiment} label="Multimodal Sentiment Score" />
                {e.reflection && (
                  <div style={{ background: "var(--color-bg)", padding: 8, borderRadius: 6, fontSize: 11 }}>
                    <strong>CBT Reflection:</strong> {e.reflection}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}

// Doctor Reminders / Care Instructions Creator (Drawer-based)
export function DoctorRemindersView({ onNotification }) {
  const [reminders, setReminders] = useState(() => getDoctorReminders());
  const [isCareDrawerOpen, setIsCareDrawerOpen] = useState(false);

  const handleCreateInstruction = (data) => {
    const { updated } = createDoctorReminder(data);
    setReminders(updated);
    if (onNotification) {
      onNotification("Reminder Created", `Instruction issued for ${data.patientName}`);
    }
  };

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Clinical Medication & Care Instructions"
          description="Issue patient-facing medication reminders and care schedules."
          action={
            <Button icon={Plus} onClick={() => setIsCareDrawerOpen(true)}>
              Issue Reminder Instruction
            </Button>
          }
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reminders.map(rem => (
            <div key={rem.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{rem.medicationName}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Patient: {rem.patientName} • Schedule: {rem.schedule}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{rem.notes}</div>
              </div>
              <span className="badge badge-primary">{rem.status}</span>
            </div>
          ))}
        </div>

        {/* Right-Side Care Instruction Drawer */}
        <CareInstructionDrawer
          open={isCareDrawerOpen}
          onClose={() => setIsCareDrawerOpen(false)}
          onSubmit={handleCreateInstruction}
        />
      </div>
    </PageTransition>
  );
}

// Doctor Patient Messaging Sub-view
export function DoctorMessagingView() {
  const [messages, setMsgs] = useState(() => getMessages());
  const [text, setText] = useState("");

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const updated = sendMessage("doctor", "Dr. Sarah Jenkins", text.trim());
    setMsgs(updated);
    setText("");
  };

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 120px)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Secure Patient Messaging</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Encrypted messaging thread with patient Gurnoor Sandhu (P-0041).</p>
        </div>

        <div className="card" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
          {messages.map(m => {
            const isDoctor = m.senderRole === "doctor";
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isDoctor ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>{m.senderName} • {m.time}</div>
                <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: 14, background: isDoctor ? "var(--color-primary-dark)" : "var(--color-bg)", color: isDoctor ? "#FFF" : "#1A1A2E" }}>
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSend} style={{ display: "flex", gap: 12 }}>
          <input type="text" className="input-field" placeholder="Type secure message to patient..." value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="primary" icon={Send}>Send</Button>
        </form>
      </div>
    </PageTransition>
  );
}

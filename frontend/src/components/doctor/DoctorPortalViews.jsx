import React, { useState } from 'react';
import {
  Users,
  Video,
  Calendar,
  Lock,
  ShieldCheck,
  Plus,
  Send,
  Clock,
  MessageSquare
} from 'lucide-react';

import { listPatientSharedEntries } from '../../services/journalService';
import {
  listMyPatients,
  listCareInstructions,
  createCareInstruction,
  listConversation,
  sendConversationMessage,
  listSafetyAlerts,
  ACCESS_LEVEL_LABELS
} from '../../services/clinicalApi';
import { describeError } from '../../services/apiClient';
import { useAppointments } from '../../hooks/useAppointments';
import { useAsyncData } from '../../hooks/useAsyncData';
import { AppointmentCard } from '../appointments/AppointmentCard';
import { DoctorScheduleDrawer } from '../appointments/DoctorScheduleDrawer';
import { CareInstructionDrawer } from './CareInstructionDrawer';
import { RescheduleAppointmentModal } from '../appointments/RescheduleAppointmentModal';
import { MeetingButton } from '../appointments/MeetingButton';
import { meetingProviderLabel } from '../../services/appointmentService';
import { PageHeader, Button, Card, Badge, Modal, EmptyState, LoadState } from '../ui';
import { PageTransition } from '../animations';
import SentimentBar from '../SentimentBar';

const notify = (onNotification, title, message) => onNotification && onNotification(title, message);

// Doctor Care Dashboard View
export function DoctorDashboardView({ onNavigate }) {
  const roster = useAsyncData(listMyPatients, [], []);
  const alerts = useAsyncData(listSafetyAlerts, [], []);
  const { confirmedConsultations, pendingRequests } = useAppointments();
  const patients = roster.data || [];
  const openAlertsFor = (patientId) =>
    (alerts.data || []).filter((a) => a.patientId === patientId && !a.status.includes("Resolved")).length;

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
              Review consenting patients, appointment requests, and safety alerts.
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
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>CONSENTING PATIENTS</span>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", marginTop: 4 }}>{roster.loading ? "…" : patients.length}</div>
            <span className="badge badge-primary" style={{ marginTop: 8 }}>Authorized Roster</span>
          </div>

          <div className="card">
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>CONFIRMED CONSULTATIONS</span>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-primary-dark)", marginTop: 4 }}>{confirmedConsultations.length}</div>
            <span className="badge badge-primary" style={{ marginTop: 8 }}>Video Calls Scheduled</span>
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
            <Button variant="ghost" size="sm" onClick={() => onNavigate('doctor-shared-journals')}>Shared Journals</Button>
          </div>

          <LoadState loading={roster.loading} error={roster.error} onRetry={roster.reload} label="Loading your patients..." />
          {!roster.loading && !roster.error && patients.length === 0 && (
            <EmptyState
              icon={Users}
              title="No consenting patients yet"
              description="Patients appear here after they grant you access from their Profile & Settings."
            />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {patients.map(p => {
              const open = openAlertsFor(p.id);
              return (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--color-bg)", borderRadius: 10, gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      {ACCESS_LEVEL_LABELS[p.accessLevel] || p.accessLevel}{p.consentSince ? ` • since ${p.consentSince}` : ""}
                    </div>
                  </div>
                  <span className={`badge ${open ? "badge-danger" : "badge-primary"}`}>
                    {open ? `${open} open alert${open > 1 ? "s" : ""}` : "No open alerts"}
                  </span>
                </div>
              );
            })}
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
    loading,
    error,
    refresh,
    handleConfirm,
    handleReject,
    handleReschedule,
    scheduleDoctorAppointment
  } = useAppointments();

  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);
  const [rejectingAptId, setRejectingAptId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reschedulingApt, setReschedulingApt] = useState(null);

  const run = async (fn, okTitle, okMessage) => {
    try {
      await fn();
      notify(onNotification, okTitle, okMessage);
      return true;
    } catch (err) {
      notify(onNotification, "Action Failed", describeError(err));
      return false;
    }
  };

  const handleConfirmClick = (id) =>
    run(() => handleConfirm(id), "Appointment Confirmed", "A secure video call link has been assigned.");

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingAptId) return;
    const ok = await run(() => handleReject(rejectingAptId, rejectionReason), "Request Declined", "Rejection reason sent to the patient.");
    if (ok) {
      setRejectingAptId(null);
      setRejectionReason("");
    }
  };

  const handleRescheduleSubmit = (id, date, time, note) =>
    run(() => handleReschedule(id, date, time, note), "Reschedule Sent", "Proposed new time sent to the patient for review.");

  const handleDoctorScheduleSubmit = async (data) => {
    await scheduleDoctorAppointment(data); // errors are shown inside the drawer
    notify(onNotification, "Appointment Scheduled", `Confirmed consultation scheduled for ${data.patientName}`);
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
          <LoadState loading={loading} error={error} onRetry={refresh} label="Loading appointments..." />
          {!loading && !error && appointments.length === 0 && (
            <EmptyState icon={Calendar} title="No appointments" description="Patient requests and scheduled consultations will appear here." />
          )}
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

// Doctor Consultations View (CONFIRMED meetings only)
export function DoctorConsultationsView() {
  const { confirmedConsultations, loading, error, refresh } = useAppointments();

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <PageHeader
          title="Doctor Consultations"
          description="Confirmed clinical consultations and their secure video call links."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <LoadState loading={loading} error={error} onRetry={refresh} label="Loading consultations..." />
          {!loading && !error && confirmedConsultations.length === 0 ? (
            <EmptyState
              icon={Video}
              title="No Confirmed Consultations"
              description="Confirmed patient appointments will appear here with their video call links."
            />
          ) : (
            confirmedConsultations.map((apt) => (
              <Card key={apt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E" }}>Patient: {apt.patientName}</span>
                    <Badge variant="primary">{meetingProviderLabel(apt.meetingProvider)}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                    {apt.type}{apt.clinicName ? ` • ${apt.clinicName}` : ""}
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

/** Patient picker shared by the doctor views below. */
function PatientPicker({ roster, value, onChange }) {
  const patients = roster.data || [];
  if (roster.loading || roster.error) return <LoadState loading={roster.loading} error={roster.error} onRetry={roster.reload} label="Loading patients..." />;
  if (patients.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No consenting patients"
        description="Patients appear here after they grant you access from their Profile & Settings."
      />
    );
  }
  return (
    <select className="input-field" value={value || ""} onChange={(e) => onChange(e.target.value)} aria-label="Select patient">
      {patients.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}

/** Selected patient id, defaulting to the first patient in the roster. */
function useSelectedPatient(roster) {
  const [patientId, setPatientId] = useState("");
  return [patientId || roster.data?.[0]?.id || "", setPatientId];
}

// Doctor Shared Journal Review Sub-view
export function DoctorSharedJournalsView() {
  const roster = useAsyncData(listMyPatients, [], []);
  const [patientId, setPatientId] = useSelectedPatient(roster);
  const journal = useAsyncData(
    () => (patientId ? listPatientSharedEntries(patientId) : Promise.resolve({ entries: [], access: null })),
    [patientId],
    { entries: [], access: null }
  );
  const { entries = [], access } = journal.data || {};
  const patientName = (roster.data || []).find((p) => p.id === patientId)?.name || "Patient";

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
            The server only returns entries the patient marked "Shared with Doctor", and only while they consent to your access.
          </p>
        </div>

        <PatientPicker roster={roster} value={patientId} onChange={setPatientId} />

        {access === "summary" && (
          <div className="card" style={{ fontSize: 13, background: "#FFF8EC" }}>
            <strong>Summary access:</strong> {patientName} shares mood and safety trends with you, but not journal text.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {patientId && <LoadState loading={journal.loading} error={journal.error} onRetry={journal.reload} label="Loading shared entries..." />}
          {patientId && !journal.loading && !journal.error && entries.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--color-text-muted)" }}>
              <Lock size={32} style={{ margin: "0 auto 8px auto", opacity: 0.5 }} />
              <p>{patientName} has not shared any journal entries yet.</p>
            </div>
          )}
          {entries.map(e => (
            <div key={e.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {patientName} <span className="badge badge-primary" style={{ marginLeft: 6 }}>{e.mood}</span>
                  {e.severity && e.severity !== "normal" && (
                    <span className={`badge ${e.severity === "high" ? "badge-danger" : "badge-warning"}`} style={{ marginLeft: 6 }}>{e.severity} concern</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{e.date}</div>
              </div>
              {e.access === "summary" ? (
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", fontStyle: "italic" }}>Journal text is not included in summary access.</p>
              ) : (
                <p style={{ fontSize: 13, lineHeight: 1.5 }}>{e.text}</p>
              )}
              <SentimentBar value={e.sentiment} label="Sentiment Score" />
              {e.reflection && (
                <div style={{ background: "var(--color-bg)", padding: 8, borderRadius: 6, fontSize: 11 }}>
                  <strong>CBT Reflection:</strong> {e.reflection}
                </div>
              )}
              {e.tags?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {e.tags.map((t) => <span key={t} className="badge badge-muted" style={{ fontSize: 10 }}>#{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}

// Doctor Reminders / Care Instructions Creator (Drawer-based)
export function DoctorRemindersView({ onNotification }) {
  const reminders = useAsyncData(listCareInstructions, [], []);
  const [isCareDrawerOpen, setIsCareDrawerOpen] = useState(false);

  const handleCreateInstruction = async (data) => {
    const created = await createCareInstruction(data); // errors are shown inside the drawer
    reminders.setData((prev) => [created, ...(prev || []).filter((r) => r.id !== created.id)]);
    notify(onNotification, "Reminder Created", `Instruction issued for ${data.patientName}`);
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
          <LoadState loading={reminders.loading} error={reminders.error} onRetry={reminders.reload} label="Loading care instructions..." />
          {!reminders.loading && !reminders.error && (reminders.data || []).length === 0 && (
            <EmptyState title="No care instructions issued" description="Issue a reminder to a consenting patient to see it here." />
          )}
          {(reminders.data || []).map(rem => (
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

/**
 * Secure messaging thread between the signed-in user and one counterpart.
 * Shared by the doctor and patient messaging views.
 */
export function MessageThread({ counterpartId, counterpartName, selfRole, onNotification }) {
  const thread = useAsyncData(
    () => (counterpartId ? listConversation(counterpartId) : Promise.resolve([])),
    [counterpartId],
    []
  );
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const updated = await sendConversationMessage(counterpartId, text.trim(), { role: selfRole, name: selfRole === "doctor" ? "Doctor" : "Patient" });
      thread.setData(updated);
      setText("");
    } catch (err) {
      notify(onNotification, "Message Not Sent", describeError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="card" style={{ flex: 1, minHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
        <LoadState loading={thread.loading} error={thread.error} onRetry={thread.reload} label="Loading conversation..." />
        {!thread.loading && !thread.error && (thread.data || []).length === 0 && (
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", marginTop: 24 }}>
            No messages yet. Start the conversation with {counterpartName}.
          </p>
        )}
        {(thread.data || []).map(m => {
          const mine = m.senderRole === selfRole;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>{m.senderName} • {m.time}</div>
              <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: 14, background: mine ? "var(--color-primary-dark)" : "var(--color-bg)", color: mine ? "#FFF" : "#1A1A2E" }}>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: 12 }}>
        <input
          type="text"
          className="input-field"
          placeholder={`Type a secure message to ${counterpartName}...`}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="primary" icon={Send} disabled={sending || !text.trim()}>{sending ? "Sending..." : "Send"}</Button>
      </form>
    </>
  );
}

// Doctor Patient Messaging Sub-view
export function DoctorMessagingView({ onNotification }) {
  const roster = useAsyncData(listMyPatients, [], []);
  const [patientId, setPatientId] = useSelectedPatient(roster);
  const patientName = (roster.data || []).find((p) => p.id === patientId)?.name || "patient";

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "calc(100vh - 120px)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquare size={22} /> Secure Patient Messaging
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Messaging is available with patients who currently consent to your care.</p>
        </div>

        <PatientPicker roster={roster} value={patientId} onChange={setPatientId} />
        {patientId && (
          <MessageThread counterpartId={patientId} counterpartName={patientName} selfRole="doctor" onNotification={onNotification} />
        )}
      </div>
    </PageTransition>
  );
}

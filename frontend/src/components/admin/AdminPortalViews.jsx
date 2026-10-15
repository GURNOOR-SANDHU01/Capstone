import React, { useState } from 'react';
import {
  Users,
  Stethoscope,
  Building2,
  Calendar,
  BarChart3,
  ShieldCheck,
  Plus,
  FileText,
  Activity,
  CheckCircle2,
  UserPlus,
  UserMinus,
  Search,
  Lock,
  Clock
} from 'lucide-react';

import {
  getAdminStats,
  listAdminDoctors,
  addAdminDoctor,
  listClinics,
  addAdminClinic,
  listAuditLogs
} from '../../services/clinicalApi';
import { isRealFirebaseConfigured } from '../../services/firebase';
import { describeError } from '../../services/apiClient';
import { useAsyncData } from '../../hooks/useAsyncData';
import { LoadState, EmptyState } from '../ui';

// Admin Dashboard View
export function AdminDashboardView({ onNavigate }) {
  const statsState = useAsyncData(getAdminStats, [], null);
  const auditState = useAsyncData(listAuditLogs, [], []);
  const stats = statsState.data || {};
  const auditLogs = auditState.data || [];
  const metric = (value) => (statsState.loading ? "…" : value ?? 0);

  return (
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
            PLATFORM ADMINISTRATION
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, marginTop: 4 }}>
            System Administrator Hub
          </h1>
          <p style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
            Manage platform resources, registered clinics, medical staff credentials, and audit security logs.
          </p>
        </div>

        <button onClick={() => onNavigate('admin-doctors')} className="btn btn-primary btn-lg" style={{ backgroundColor: "#FFFFFF", color: "#1A1A2E" }}>
          <UserPlus size={18} />
          <span>Add New Doctor</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="app-grid-3">
        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>ACTIVE CLINICAL STAFF</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", marginTop: 4 }}>{metric(stats.doctors)}</div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>Credentialed Doctors</span>
        </div>

        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>REGISTERED CLINICS</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-primary-dark)", marginTop: 4 }}>{metric(stats.clinics)}</div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>Active Centers</span>
        </div>

        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>PLATFORM CONSULTATIONS</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#4A90E2", marginTop: 4 }}>{metric(stats.appointments)}</div>
          <span className="badge badge-warning" style={{ marginTop: 8 }}>Total Booked</span>
        </div>
      </div>

      <LoadState error={statsState.error} onRetry={statsState.reload} />
      {stats.openAlerts > 0 && (
        <div className="card" role="status" style={{ borderLeft: "4px solid var(--color-danger)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13 }}>
            <strong>{stats.openAlerts}</strong> open safety alert(s){stats.unassignedAlerts ? <>, <strong>{stats.unassignedAlerts}</strong> awaiting triage (no consented doctor)</> : null}.
          </span>
          <button onClick={() => onNavigate('admin-safety')} className="btn btn-outline btn-sm">Open Safety Center</button>
        </div>
      )}

      {/* Audit Log Overview */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>System Audit Event Feed</h3>
          <button onClick={() => onNavigate('admin-audit')} className="btn btn-ghost btn-sm">View Full Log</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <LoadState loading={auditState.loading} error={auditState.error} onRetry={auditState.reload} />
          {!auditState.loading && !auditState.error && auditLogs.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No administrative events recorded yet.</p>
          )}
          {auditLogs.slice(0, 3).map((log) => (
            <div key={log.id} style={{ padding: 12, background: "var(--color-bg)", borderRadius: 8, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{log.action}</strong> • <span style={{ color: "var(--color-text-muted)" }}>{log.resource}</span>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>Actor: {log.actor}</div>
              </div>
              <span className="badge badge-primary">{log.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Admin Doctor Management View
export function AdminDoctorMgmtView({ onNotification }) {
  const doctorsState = useAsyncData(listAdminDoctors, [], []);
  const clinicsState = useAsyncData(listClinics, [], []);
  const doctors = doctorsState.data || [];
  const clinicOptions = (clinicsState.data || []).map((c) => c.name);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpecialization] = useState("Clinical Neuropsychology");
  const [clinic, setClinic] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim() || (!isRealFirebaseConfigured && !name.trim())) return;
    setSaving(true);
    setFormError("");
    try {
      const updated = await addAdminDoctor({
        name: name.trim(),
        email: email.trim(),
        specialization,
        clinic: clinic || clinicOptions[0] || ""
      });
      doctorsState.setData(updated);
      setShowModal(false);
      setName("");
      setEmail("");
      onNotification(
        "Doctor Credentialed",
        isRealFirebaseConfigured ? `${email.trim()} now has doctor access. They must sign in again.` : `${name} added.`
      );
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Medical Staff & Doctor Roster</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Manage clinician accounts, clinic assignments, and authorization credentials.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <UserPlus size={16} />
          <span>Credential New Doctor</span>
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <LoadState loading={doctorsState.loading} error={doctorsState.error} onRetry={doctorsState.reload} label="Loading doctors..." />
        {!doctorsState.loading && !doctorsState.error && doctors.length === 0 && (
          <EmptyState icon={Stethoscope} title="No doctors yet" description="Credential a doctor to let patients book and share with them." />
        )}
        {doctors.map(doc => (
          <div key={doc.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#EAF7F2", color: "#2E7D62", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Stethoscope size={22} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{doc.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{doc.email} • {doc.specialization}</div>
                <div style={{ fontSize: 12, color: "var(--color-primary-dark)", fontWeight: 600, marginTop: 2 }}>{doc.clinic}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`badge ${doc.status === "Active" ? "badge-primary" : "badge-warning"}`}>{doc.status}</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Credential New Doctor</h2>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {isRealFirebaseConfigured ? (
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                  The doctor must first create their own SentiMed account. Enter that account's email to grant doctor access.
                  Roles are applied server-side and recorded in the audit log.
                </p>
              ) : (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>FULL NAME</label>
                  <input type="text" className="input-field" placeholder="e.g. Dr. Emily Vance" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>EMAIL</label>
                <input type="email" className="input-field" placeholder="emily.vance@sentimed.io" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>SPECIALIZATION</label>
                <select className="input-field" value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
                  <option value="Clinical Neuropsychology">Clinical Neuropsychology</option>
                  <option value="Behavioral Psychotherapy">Behavioral Psychotherapy</option>
                  <option value="Psychiatry & Somnology">Psychiatry & Somnology</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>ASSIGNED CLINIC</label>
                <select className="input-field" value={clinic} onChange={(e) => setClinic(e.target.value)}>
                  {clinicOptions.length === 0 && <option value="">No clinics registered yet</option>}
                  {clinicOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                {formError && <span role="alert" style={{ color: "#C0392B", fontSize: 12, alignSelf: "center", flex: 1 }}>{formError}</span>}
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Add Doctor"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin Clinic Management View
export function AdminClinicMgmtView({ onNotification }) {
  const clinicsState = useAsyncData(listClinics, [], []);
  const clinics = clinicsState.data || [];
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !contact.trim()) {
      setFormError("Name, location and contact are required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const updated = await addAdminClinic({ name: name.trim(), location: location.trim(), contact: contact.trim() });
      clinicsState.setData(updated);
      setShowModal(false);
      setName("");
      setLocation("");
      setContact("");
      onNotification("Clinic Registered", `${name} added to platform network.`);
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Clinic & Center Network</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Manage physical and regional virtual clinic facilities.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Register New Clinic</span>
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <LoadState loading={clinicsState.loading} error={clinicsState.error} onRetry={clinicsState.reload} label="Loading clinics..." />
        {!clinicsState.loading && !clinicsState.error && clinics.length === 0 && (
          <EmptyState icon={Building2} title="No clinics registered" description="Register a clinic to assign doctors to it." />
        )}
        {clinics.map(c => (
          <div key={c.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#EEF5FC", color: "#4A90E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{c.location} • Contact: {c.contact}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>Doctors: {c.doctorsCount} • Patients: {c.patientsCount}</div>
              </div>
            </div>
            <span className="badge badge-primary">{c.status}</span>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Register New Clinic Facility</h2>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>CLINIC NAME</label>
                <input type="text" className="input-field" placeholder="e.g. SentiMed West Regional Center" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>LOCATION / CITY</label>
                <input type="text" className="input-field" placeholder="e.g. Seattle, WA" value={location} onChange={(e) => setLocation(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>CONTACT PHONE</label>
                <input type="text" className="input-field" placeholder="+1 (206) 555-0199" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                {formError && <span role="alert" style={{ color: "#C0392B", fontSize: 12, alignSelf: "center", flex: 1 }}>{formError}</span>}
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Register Clinic"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin Audit Logs View
export function AdminAuditLogsView() {
  const auditState = useAsyncData(listAuditLogs, [], []);
  const auditLogs = auditState.data || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Platform Audit & Security Event Logs</h1>
          <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ShieldCheck size={12} /> Server-Backed Audit Pipeline
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Immutable log records for administrative credential modifications, role updates, and system access.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <LoadState loading={auditState.loading} error={auditState.error} onRetry={auditState.reload} label="Loading audit log..." />
        {!auditState.loading && !auditState.error && auditLogs.length === 0 && (
          <EmptyState icon={FileText} title="No audit events yet" description="Role changes and administrative actions are recorded here." />
        )}
        {auditLogs.map((log) => (
          <div key={log.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{log.action}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>Resource: {log.resource} • Actor: {log.actor}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="badge badge-primary">{log.status}</span>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>{log.timestamp}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

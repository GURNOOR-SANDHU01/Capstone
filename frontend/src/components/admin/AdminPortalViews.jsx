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
  getAdminDoctors, 
  getAdminClinics, 
  getAuditLogs, 
  addDoctor, 
  addClinic 
} from '../../services/adminService';
import { getAppointments } from '../../services/appointmentService';

// Admin Dashboard View
export function AdminDashboardView({ onNavigate }) {
  const doctors = getAdminDoctors();
  const clinics = getAdminClinics();
  const appointments = getAppointments();
  const auditLogs = getAuditLogs();

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
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", marginTop: 4 }}>{doctors.length}</div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>Credentialed Doctors</span>
        </div>

        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>REGISTERED CLINICS</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-primary-dark)", marginTop: 4 }}>{clinics.length}</div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>Active Centers</span>
        </div>

        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>PLATFORM CONSULTATIONS</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#4A90E2", marginTop: 4 }}>{appointments.length}</div>
          <span className="badge badge-warning" style={{ marginTop: 8 }}>Total Booked</span>
        </div>
      </div>

      {/* Audit Log Overview */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>System Audit Event Feed</h3>
          <button onClick={() => onNavigate('admin-audit')} className="btn btn-ghost btn-sm">View Full Log</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
  const [doctors, setDoctors] = useState(() => getAdminDoctors());
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [specialization, setSpecialization] = useState("Clinical Neuropsychology");
  const [clinic, setClinic] = useState("SentiMed Central Clinic");

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const updated = addDoctor({
      name: name.trim(),
      email: email.trim(),
      specialization,
      clinic
    });

    setDoctors(updated);
    setShowModal(false);
    setName("");
    setEmail("");
    onNotification("Doctor Credentialed", `${name} added to ${clinic}`);
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
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>FULL NAME</label>
                <input type="text" className="input-field" placeholder="e.g. Dr. Emily Vance" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
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
                  <option value="SentiMed Central Clinic">SentiMed Central Clinic</option>
                  <option value="MindWellness East Clinic">MindWellness East Clinic</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Doctor</button>
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
  const [clinics, setClinics] = useState(() => getAdminClinics());
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return;

    const updated = addClinic({
      name: name.trim(),
      location: location.trim(),
      contact: contact.trim() || "+1 (555) 000-0000"
    });

    setClinics(updated);
    setShowModal(false);
    setName("");
    setLocation("");
    onNotification("Clinic Registered", `${name} added to platform network.`);
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
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Register Clinic</button>
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
  const auditLogs = getAuditLogs();

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

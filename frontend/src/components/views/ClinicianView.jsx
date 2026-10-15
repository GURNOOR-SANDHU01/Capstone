import React, { useState } from 'react';
import {
  Stethoscope,
  Lock,
  AlertTriangle,
  FileText,
  CheckCircle2,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { CLINICIAN_PATIENTS_DEMO } from '../../data/mockData';
import SentimentBar from '../SentimentBar';

export default function ClinicianView({ onNotification }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState("");

  const [patients, setPatients] = useState(CLINICIAN_PATIENTS_DEMO);
  const [selectedPatientId, setSelectedPatientId] = useState("P-0041");
  const [filterStatus, setFilterStatus] = useState("all");
  const [newNote, setNewNote] = useState("");

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin === "1234") {
      setIsAuthenticated(true);
      setAuthError("");
      onNotification("Clinician Workspace Unlocked", "Access granted to demo clinical triage interface.");
    } else {
      setAuthError("Invalid Security PIN code. Try PIN: 1234");
    }
  };

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0];

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const updatedPatients = patients.map((p) => {
      if (p.id === selectedPatientId) {
        return {
          ...p,
          sessionNotes: [
            { date: new Date().toLocaleDateString(), text: newNote.trim() },
            ...p.sessionNotes
          ]
        };
      }
      return p;
    });

    setPatients(updatedPatients);
    setNewNote("");
    onNotification("Note Appended", `Clinical session note saved for ${selectedPatient.name}`);
  };

  const filteredPatients = patients.filter(p => {
    if (filterStatus === "all") return true;
    return p.status === filterStatus;
  });

  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh"
        }}
      >
        <div className="card" style={{ maxWidth: 400, width: "100%", padding: 36, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              backgroundColor: "#EAF7F2",
              color: "#2E7D62",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto"
            }}
          >
            <Stethoscope size={28} />
          </div>

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800 }}>
            Clinician Verification
          </h2>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>
            Enter your clinical PIN to access anonymized triage telemetry.
          </p>

          <form onSubmit={handlePinSubmit} style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="input-group">
              <span className="input-icon-left">
                <Lock size={18} />
              </span>
              <input
                type="password"
                className="input-field"
                placeholder="Enter PIN (Demo: 1234)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                style={{ textAlign: "center", fontSize: 18, letterSpacing: "4px" }}
                maxLength={4}
              />
            </div>

            {authError && (
              <div style={{ color: "var(--color-danger)", fontSize: 12, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                <AlertTriangle size={14} />
                <span>{authError}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg">
              Verify Credentials
            </button>
          </form>

          <div style={{ marginTop: 20, fontSize: 11, color: "var(--color-text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <ShieldCheck size={13} />
            <span>Demo Environment • HIPAA Standards Active</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Banner Notice */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Clinical Triage Dashboard</h1>
            <span className="badge badge-warning">DEMO ENVIRONMENT</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Care coordinator view displaying synthetic patient metrics and attention flags.
          </p>
        </div>

        <button
          onClick={() => setIsAuthenticated(false)}
          className="btn btn-outline btn-sm"
        >
          <Lock size={14} />
          <span>Lock Workspace</span>
        </button>
      </div>

      {/* Main Split View */}
      <div className="app-split-2-1">
        {/* Left Column: Patient Triage List */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Patient Roster ({filteredPatients.length})</h3>
            <div style={{ display: "flex", gap: 6 }}>
              {["all", "danger", "monitor", "stable"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`btn btn-sm ${filterStatus === st ? "btn-primary" : "btn-outline"}`}
                  style={{ textTransform: "capitalize" }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredPatients.map((p) => {
              const isSelected = p.id === selectedPatientId;
              const statusBadge = p.status === "danger" ? "badge-danger" : p.status === "monitor" ? "badge-warning" : "badge-primary";

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  style={{
                    padding: 14,
                    borderRadius: "var(--radius-sm)",
                    border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
                    background: isSelected ? "var(--color-primary-soft)" : "var(--color-surface)",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                    <span className={`badge ${statusBadge}`} style={{ textTransform: "uppercase", fontSize: 10 }}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
                    <span>Streak: {p.streak} days</span>
                    <span>HRV: {p.biometrics.hrv}</span>
                    <span>Sleep: {p.biometrics.sleep}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Patient Details & Session Notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedPatient.fullName}</h3>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>ID: {selectedPatient.id} • Age: {selectedPatient.age}</span>
              </div>
              <span className="badge badge-primary">Baseline: {selectedPatient.baselineWellness}%</span>
            </div>

            <SentimentBar value={selectedPatient.baselineWellness} label="Aggregated Sentiment Index" />

            {/* Attention Flags */}
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
                ATTENTION FLAGS
              </span>
              {selectedPatient.flags.length === 0 ? (
                <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <CheckCircle2 size={12} />
                  <span>No active flags. Patient is stable.</span>
                </span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {selectedPatient.flags.map((flag, idx) => (
                    <div key={idx} className="badge badge-danger" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={12} />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Session Notes Form */}
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={16} />
                <span>Clinical Session Notes</span>
              </h4>

              <form onSubmit={handleAddNote} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Record clinical observations, intervention recommendations..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  style={{ height: "auto" }}
                />
                <div style={{ textAlign: "right" }}>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Append Clinical Note
                  </button>
                </div>
              </form>

              {/* Existing Notes List */}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedPatient.sessionNotes.map((note, idx) => (
                  <div key={idx} style={{ background: "var(--color-bg)", padding: 10, borderRadius: 6, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 2 }}>{note.date}</div>
                    <div>{note.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

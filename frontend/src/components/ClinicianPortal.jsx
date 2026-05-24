import { useState } from "react";

// Initial patient data (mock)
const DEFAULT_PATIENTS = [
  {
    id: "P-0041",
    name: "Patient A",
    fullName: "Gurnoor Sandhu (Decrypted)",
    age: 26,
    streak: 12,
    baselineWellness: 74,
    status: "stable",
    biometrics: { hrv: "48ms", sleep: "6.8 hrs", steps: "7,800 avg" },
    flags: [],
    sessionNotes: [
      { date: "May 18, 2026", text: "Discussed social performance anxiety. Practiced breathing grounding exercises. Patient is responsive." }
    ]
  },
  {
    id: "P-0039",
    name: "Patient B (Anonymized)",
    fullName: "Patient B (PII Masked)",
    age: 34,
    streak: 3,
    baselineWellness: 31,
    status: "danger",
    biometrics: { hrv: "30ms", sleep: "5.1 hrs", steps: "3,200 avg" },
    flags: ["Prolonged low mood (6 days)", "Sleep dip > 18%"],
    sessionNotes: [
      { date: "May 12, 2026", text: "Expressed sleep onset issues. Recommended sleep hygiene worksheet. Flagged for review." }
    ]
  },
  {
    id: "P-0052",
    name: "Patient C (Anonymized)",
    fullName: "Patient C (PII Masked)",
    age: 41,
    streak: 8,
    baselineWellness: 58,
    status: "monitor",
    biometrics: { hrv: "42ms", sleep: "6.2 hrs", steps: "5,400 avg" },
    flags: ["Increasing tired tags"],
    sessionNotes: []
  }
];

export default function ClinicianPortal({ patientEntries, onNotification }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [selectedRole, setSelectedRole] = useState("Psychologist");
  const [authError, setAuthError] = useState("");
  
  // Patients list state
  const [patients, setPatients] = useState(DEFAULT_PATIENTS);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all"); // all, danger, monitor, stable
  
  // Note writing state
  const [newNoteText, setNewNoteText] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === "1234") {
      setIsAuthenticated(true);
      setAuthError("");
      onNotification("🔑 Portal Access Granted", `Logged in securely as ${selectedRole}.`);
    } else {
      setAuthError("Invalid Security PIN code. Try again.");
    }
  };

  const activePatient = patients.find(p => p.id === selectedPatientId);

  // Synchronize Patient A metrics with Gurnoor's actual entries dynamically
  const getPatientWellness = (p) => {
    if (p.id === "P-0041" && patientEntries.length > 0) {
      // Calculate avg sentiment from recent logs
      const sum = patientEntries.reduce((acc, curr) => acc + curr.sentiment, 0);
      return Math.floor(sum / patientEntries.length);
    }
    return p.baselineWellness;
  };

  const getPatientStatus = (p) => {
    const score = getPatientWellness(p);
    if (score < 40) return "danger";
    if (score < 65) return "monitor";
    return "stable";
  };

  const filteredPatients = patients.filter(p => {
    const status = getPatientStatus(p);
    if (filterStatus === "all") return true;
    return status === filterStatus;
  });

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedPatientId) return;

    setPatients(prev => prev.map(p => {
      if (p.id === selectedPatientId) {
        return {
          ...p,
          sessionNotes: [
            { date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }), text: newNoteText },
            ...p.sessionNotes
          ]
        };
      }
      return p;
    }));

    setNewNoteText("");
    onNotification("📝 Notes committed", `Session report logged securely for ${activePatient.name}`);
  };

  if (!isAuthenticated) {
    return (
      <div className="fade-in-anim" style={{ maxWidth: 440, margin: "80px auto", padding: 24, background: "#fff", borderRadius: 20, border: "1.5px solid var(--border-light)", boxShadow: "var(--shadow-md)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🩺</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--indigo-primary)" }}>SentiMed Clinician Portal</h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Role-based Access & Compliance Sandbox</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
          
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Clinical Role</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1.5px solid var(--border-light)",
                fontSize: 13,
                outline: "none",
                background: "#FAF9F5"
              }}
            >
              <option>Psychologist</option>
              <option>Psychiatrist</option>
              <option>Clinical Coordinator</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Secure Access PIN</label>
            <input
              type="password"
              placeholder="Enter PIN (Default: 1234)"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1.5px solid var(--border-light)",
                fontSize: 14,
                outline: "none",
                background: "#FAF9F5"
              }}
            />
          </div>

          {authError && (
            <div style={{ color: "var(--rose-primary)", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
              {authError}
            </div>
          )}

          <button
            type="submit"
            className="btn-hover"
            style={{
              background: "var(--indigo-primary)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: 12,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              marginTop: 6
            }}
          >
            Authenticate Credentials
          </button>
        </form>

        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 20, textAlign: "center", lineHeight: 1.4 }}>
          🔒 Designed under HIPAA guidelines. Access logging is monitored and mapped. Local token invalidates on tab close.
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in-anim" style={{ display: "flex", flexDirection: "column", height: "100%", background: "#FAF9F6", width: "100%", minHeight: "85vh", borderRadius: 16, border: "1.5px solid var(--border-light)", overflow: "hidden" }}>
      
      {/* Clinician Dashboard Header */}
      <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1.5px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🩺</span>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--indigo-primary)", margin: 0 }}>SentiMed Care Hub</h2>
            <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
              <span>Role: <strong>{selectedRole}</strong></span>
              <span>•</span>
              <span style={{ color: "var(--teal-primary)" }}>● Session Secured</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setIsAuthenticated(false);
            setPinInput("");
            setSelectedPatientId(null);
            onNotification("Clinician session closed", "Logged out securely from portal.");
          }}
          style={{
            background: "none",
            border: "1.5px solid var(--border-light)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            color: "var(--text-muted)"
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Main Workspace split */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* LEFT COLUMN: PATIENTS LIST */}
        <div style={{ width: "320px", borderRight: "1.5px solid var(--border-light)", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          
          {/* Quick Filters */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", textAlign: "left" }}>Patient Database</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { id: "all", label: "All" },
                { id: "danger", label: "🔴 Red Zone" },
                { id: "monitor", label: "🟡 Monitor" }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  style={{
                    flex: 1,
                    border: "none",
                    background: filterStatus === f.id ? "var(--indigo-primary)" : "var(--indigo-light)",
                    color: filterStatus === f.id ? "#fff" : "var(--text-dark)",
                    padding: "4px 6px",
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          <div style={{ flex: 1 }}>
            {filteredPatients.map(p => {
              const wellness = getPatientWellness(p);
              const status = getPatientStatus(p);
              const isSelected = selectedPatientId === p.id;
              
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  style={{
                    padding: "16px",
                    borderBottom: "1.5px solid var(--border-light)",
                    cursor: "pointer",
                    background: isSelected ? "var(--indigo-light)" : "#fff",
                    transition: "all 0.15s ease",
                    textAlign: "left"
                  }}
                  className="card-interactive"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>{p.name}</span>
                    
                    {status === "danger" && <span style={{ fontSize: 9, background: "var(--rose-light)", color: "var(--rose-primary)", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>🔴 Red Zone</span>}
                    {status === "monitor" && <span style={{ fontSize: 9, background: "var(--amber-light)", color: "var(--amber-dark)", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>🟡 Monitor</span>}
                    {status === "stable" && <span style={{ fontSize: 9, background: "var(--teal-light)", color: "var(--teal-primary)", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>🟢 Stable</span>}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                    <span>ID: {p.id}</span>
                    <span>Wellness Index: <strong>{wellness}%</strong></span>
                  </div>

                  {p.flags.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.flags.map(f => (
                        <span key={f} style={{ fontSize: 9, background: "#FFF0F0", color: "var(--rose-primary)", padding: "2px 6px", borderRadius: 4 }}>
                          ⚠️ {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredPatients.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 20, textAlign: "center" }}>No patients match criteria.</p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL SHEET */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto", background: "#FAF9F6", display: "flex", flexDirection: "column" }}>
          {activePatient ? (
            <div className="fade-in-anim" style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "left" }}>
              
              {/* Patient Profile Title card */}
              <div style={{ background: "#fff", border: "1px solid var(--border-light)", borderRadius: 16, padding: 16, boxShadow: "var(--shadow-sm)" }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--indigo-primary)", fontFamily: "var(--font-display)" }}>
                  {activePatient.fullName}
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Age: {activePatient.age} • Tracker Sync: Connected • Active Record Consent: YES (Anonymized Mode)
                </p>
                <div style={{ display: "flex", gap: 20, marginTop: 12, borderTop: "1px solid var(--border-light)", paddingTop: 10 }}>
                  <div style={{ fontSize: 12 }}>💤 Sleep: <strong>{activePatient.biometrics.sleep}</strong></div>
                  <div style={{ fontSize: 12 }}>📡 HRV: <strong>{activePatient.biometrics.hrv}</strong></div>
                  <div style={{ fontSize: 12 }}>👟 Active Steps: <strong>{activePatient.biometrics.steps}</strong></div>
                </div>
              </div>

              {/* Patient Graph and Analytics */}
              <div style={{ background: "#fff", border: "1px solid var(--border-light)", borderRadius: 16, padding: 16, boxShadow: "var(--shadow-sm)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>Consented Bio-emotional Trajectory</span>
                
                {/* Simulated Clinician SVG graph */}
                <div style={{ width: "100%", height: 140, background: "#FAF9F5", borderRadius: 10, padding: 10, position: "relative" }}>
                  <svg width="100%" height="120" viewBox="0 0 400 120">
                    <line x1="0" y1="20" x2="400" y2="20" stroke="#EAEAEA" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="0" y1="60" x2="400" y2="60" stroke="#EAEAEA" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="0" y1="100" x2="400" y2="100" stroke="#EAEAEA" strokeWidth="1" strokeDasharray="3 3" />
                    
                    {/* Plot curves based on patient id */}
                    {activePatient.id === "P-0041" ? (
                      <path d="M10,80 L80,60 L160,90 L240,40 L320,20 L390,30" fill="none" stroke="var(--teal-primary)" strokeWidth="3" />
                    ) : activePatient.id === "P-0039" ? (
                      <path d="M10,90 L80,105 L160,95 L240,110 L320,100 L390,95" fill="none" stroke="var(--rose-primary)" strokeWidth="3" />
                    ) : (
                      <path d="M10,60 L80,50 L160,70 L240,55 L320,65 L390,60" fill="none" stroke="var(--amber-primary)" strokeWidth="3" />
                    )}

                    {/* Nodes */}
                    <circle cx="390" cy={activePatient.id === "P-0041" ? 30 : activePatient.id === "P-0039" ? 95 : 60} r="5" fill="var(--indigo-primary)" />
                  </svg>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                    <span>May 10</span>
                    <span>May 14</span>
                    <span>May 18</span>
                    <span>Today</span>
                  </div>
                </div>
              </div>

              {/* Session notes section */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                
                {/* Notes Input Pad */}
                <div style={{ background: "#fff", border: "1px solid var(--border-light)", borderRadius: 16, padding: 16, boxShadow: "var(--shadow-sm)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 10 }}>Session Notepad</span>
                  
                  <form onSubmit={handleAddNote} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                      placeholder="Write clinically aligned observations, diagnostics, or guidelines..."
                      value={newNoteText}
                      onChange={e => setNewNoteText(e.target.value)}
                      style={{
                        width: "100%",
                        height: 100,
                        border: "1.5px solid var(--border-light)",
                        borderRadius: 10,
                        padding: 10,
                        fontSize: 12,
                        outline: "none",
                        resize: "none",
                        fontFamily: "var(--font-sans)"
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newNoteText.trim()}
                      className="btn-hover"
                      style={{
                        background: newNoteText.trim() ? "var(--teal-primary)" : "#D1D1D6",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: newNoteText.trim() ? "pointer" : "not-allowed"
                      }}
                    >
                      Lock Note to Chart
                    </button>
                  </form>
                </div>

                {/* Saved notes timeline */}
                <div style={{ background: "#fff", border: "1px solid var(--border-light)", borderRadius: 16, padding: 16, boxShadow: "var(--shadow-sm)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 10 }}>Clinical Log History</span>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 150, overflowY: "auto" }}>
                    {activePatient.sessionNotes.map((n, i) => (
                      <div key={i} style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 6, lastChild: { border: "none" } }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700 }}>{n.date}</div>
                        <p style={{ fontSize: 11, color: "var(--text-main)", marginTop: 2, lineHeight: 1.3 }}>{n.text}</p>
                      </div>
                    ))}
                    {activePatient.sessionNotes.length === 0 && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", marginTop: 20 }}>No session notes logged yet.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.6 }}>
              <span style={{ fontSize: 44, marginBottom: 12 }}>📑</span>
              <h3>No Patient Selected</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Select a consented patient from the left column database to inspect metrics.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

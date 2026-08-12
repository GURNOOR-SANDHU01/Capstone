import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle
} from 'lucide-react';
import { getRiskAlerts, markAlertResolved } from '../../services/riskWorkflowService';
import { RISK_LEVELS } from '../../services/screeningService';
import { MeetingButton } from '../appointments/MeetingButton';

export default function DoctorSafetyCenterView({ onNotification }) {
  const [alerts, setAlerts] = useState(() => getRiskAlerts());
  const [filterCategory, setFilterCategory] = useState("all");

  const handleResolve = (id, patientName) => {
    const updated = markAlertResolved(id);
    setAlerts(updated);
    onNotification("Alert Reviewed", `Safety status updated for ${patientName}`);
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterCategory === "all") return true;
    if (filterCategory === "urgent") return a.riskCategory === RISK_LEVELS.HIGH_URGENT;
    if (filterCategory === "moderate") return a.riskCategory === RISK_LEVELS.MODERATE;
    if (filterCategory === "resolved") return a.status.includes("Resolved");
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Doctor Safety Center</h1>
          <span className="badge badge-danger" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ShieldAlert size={13} /> Clinical Risk Triage Queue
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Monitor patient safety flags, urgent triage alerts, and document clinical follow-up interventions.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "urgent", "moderate", "resolved"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`btn btn-sm ${filterCategory === cat ? "btn-primary" : "btn-outline"}`}
              style={{ textTransform: "capitalize" }}
            >
              {cat}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600 }}>
          Showing {filteredAlerts.length} active risk alerts
        </span>
      </div>

      {/* Alerts Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {filteredAlerts.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--color-text-muted)" }}>
            <CheckCircle2 size={36} color="var(--color-primary)" style={{ margin: "0 auto 8px auto" }} />
            <p style={{ fontSize: 14 }}>No safety alerts in this category requiring attention.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isUrgent = alert.riskCategory === RISK_LEVELS.HIGH_URGENT;
            return (
              <div 
                key={alert.id} 
                className="card" 
                style={{ 
                  borderLeft: isUrgent ? "4px solid var(--color-danger)" : "4px solid var(--color-warning)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={`badge ${isUrgent ? "badge-danger" : "badge-warning"}`}>
                        {isUrgent ? "URGENT SAFETY ALERT" : "MODERATE WELLNESS FLAG"}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{alert.timestamp}</span>
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, marginTop: 6, color: "#1A1A2E" }}>
                      Patient: {alert.patientName} ({alert.patientId})
                    </h3>
                  </div>

                  <span className="badge badge-primary">{alert.status}</span>
                </div>

                <p style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.5, background: "var(--color-bg)", padding: 12, borderRadius: 8 }}>
                  <strong>Trigger Details:</strong> {alert.details}
                </p>

                {/* Clinical Actions */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <MeetingButton
                    meetingUrl="https://meet.google.com/demo-sentimed-call"
                    size="sm"
                  />

                  {!alert.status.includes("Resolved") && (
                    <button 
                      onClick={() => handleResolve(alert.id, alert.patientName)}
                      className="btn btn-secondary btn-sm"
                    >
                      <CheckCircle2 size={14} />
                      <span>Mark Reviewed & Documented</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

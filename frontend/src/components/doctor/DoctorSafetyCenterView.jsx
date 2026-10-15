import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { listSafetyAlerts, resolveSafetyAlert } from '../../services/clinicalApi';
import { describeError } from '../../services/apiClient';
import { RISK_LEVELS } from '../../services/screeningService';
import { useAsyncData } from '../../hooks/useAsyncData';
import { LoadState } from '../ui';

/**
 * Safety alert queue with filters and a "resolve with note" action.
 * The server decides which alerts the caller may see and update
 * (doctors: their consenting patients; admins: everything, including unassigned triage alerts).
 */
export function SafetyAlertQueue({ onNotification, showAssignment = false }) {
  const alertsState = useAsyncData(listSafetyAlerts, [], []);
  const alerts = alertsState.data || [];
  const [filterCategory, setFilterCategory] = useState("all");
  const [resolvingId, setResolvingId] = useState(null);
  const [actionNote, setActionNote] = useState("");
  const [busy, setBusy] = useState(false);

  const handleResolve = async (alert) => {
    setBusy(true);
    try {
      const updated = await resolveSafetyAlert(alert.id, actionNote.trim());
      alertsState.setData(updated);
      setResolvingId(null);
      setActionNote("");
      onNotification && onNotification("Alert Reviewed", `Safety status updated for ${alert.patientName}`);
    } catch (err) {
      onNotification && onNotification("Update Failed", describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const isResolved = (a) => a.status.includes("Resolved");
  const filteredAlerts = alerts.filter((a) => {
    if (filterCategory === "all") return !isResolved(a);
    if (filterCategory === "urgent") return a.riskCategory === RISK_LEVELS.HIGH_URGENT && !isResolved(a);
    if (filterCategory === "moderate") return a.riskCategory === RISK_LEVELS.MODERATE && !isResolved(a);
    if (filterCategory === "unassigned") return a.assigned === false && !isResolved(a);
    if (filterCategory === "resolved") return isResolved(a);
    return true;
  });
  const categories = ["all", "urgent", "moderate", ...(showAssignment ? ["unassigned"] : []), "resolved"];

  return (
    <>
      {/* Filter Tabs */}
      <div className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`btn btn-sm ${filterCategory === cat ? "btn-primary" : "btn-outline"}`}
              style={{ textTransform: "capitalize" }}
            >
              {cat === "all" ? "open" : cat}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 600 }}>
          Showing {filteredAlerts.length} alert{filteredAlerts.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Alerts Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <LoadState loading={alertsState.loading} error={alertsState.error} onRetry={alertsState.reload} label="Loading safety alerts..." />
        {!alertsState.loading && !alertsState.error && filteredAlerts.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--color-text-muted)" }}>
            <CheckCircle2 size={36} color="var(--color-primary)" style={{ margin: "0 auto 8px auto" }} />
            <p style={{ fontSize: 14 }}>No safety alerts in this category requiring attention.</p>
          </div>
        )}
        {filteredAlerts.map((alert) => {
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className={`badge ${isUrgent ? "badge-danger" : "badge-warning"}`}>
                      {isUrgent ? "URGENT SAFETY ALERT" : "MODERATE WELLNESS FLAG"}
                    </span>
                    {showAssignment && alert.assigned === false && <span className="badge badge-muted">Unassigned — admin triage</span>}
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{alert.timestamp}</span>
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, marginTop: 6, color: "#1A1A2E" }}>
                    Patient: {alert.patientName}
                  </h3>
                </div>

                <span className="badge badge-primary">{alert.status}</span>
              </div>

              <p style={{ fontSize: 13, color: "var(--color-text)", lineHeight: 1.5, background: "var(--color-bg)", padding: 12, borderRadius: 8 }}>
                <strong>Trigger Details:</strong> {alert.details}
                {alert.actionTaken && <><br /><strong>Action Taken:</strong> {alert.actionTaken}</>}
              </p>

              {/* Clinical Actions */}
              {!isResolved(alert) && (
                resolvingId === alert.id ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      className="input-field"
                      style={{ flex: 1, minWidth: 220 }}
                      placeholder="Document the follow-up action taken (optional)"
                      value={actionNote}
                      maxLength={1000}
                      onChange={(e) => setActionNote(e.target.value)}
                    />
                    <button onClick={() => setResolvingId(null)} className="btn btn-outline btn-sm" disabled={busy}>Cancel</button>
                    <button onClick={() => handleResolve(alert)} className="btn btn-secondary btn-sm" disabled={busy}>
                      <CheckCircle2 size={14} />
                      <span>{busy ? "Saving..." : "Confirm Reviewed"}</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => setResolvingId(alert.id)} className="btn btn-secondary btn-sm">
                      <CheckCircle2 size={14} />
                      <span>Mark Reviewed & Documented</span>
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function DoctorSafetyCenterView({ onNotification }) {
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
          Safety flags for patients who share red-flag alerts with you. Document your follow-up when resolving.
        </p>
      </div>

      <SafetyAlertQueue onNotification={onNotification} />
    </div>
  );
}

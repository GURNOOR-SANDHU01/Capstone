import React, { useState } from 'react';
import { Stethoscope, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import {
  listDoctors,
  getConsentStatus,
  grantConsent,
  revokeConsent,
  ACCESS_LEVEL_LABELS
} from '../../services/clinicalApi';
import { describeError } from '../../services/apiClient';
import { isRealFirebaseConfigured } from '../../services/firebase';
import { useAsyncData } from '../../hooks/useAsyncData';
import { LoadState } from '../ui';

/**
 * Patient-controlled doctor access ("consent bridges").
 * A doctor sees nothing until the patient grants access here; journal entries are visible
 * only if also marked "Shared with Doctor", and only to the extent of the chosen access level.
 * Every grant and revoke is recorded in the patient's consent audit log on the server.
 */
export default function CareTeamAccess({ onNotification }) {
  const consent = useAsyncData(getConsentStatus, [], { bridges: [], history: [] });
  const doctors = useAsyncData(listDoctors, [], []);
  const [doctorId, setDoctorId] = useState("");
  const [accessLevel, setAccessLevel] = useState("longitudinal_summary_only");
  const [alerts, setAlerts] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!isRealFirebaseConfigured) {
    return (
      <div className="card" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
        <strong>Care Team Access</strong> — doctor consent management is available in Live mode.
      </div>
    );
  }

  const active = (consent.data?.bridges || []).filter((b) => b.active);
  const available = (doctors.data || []).filter((d) => !active.some((b) => b.doctorId === d.id));
  const selected = doctorId || available[0]?.id || "";

  const run = async (fn, title, message) => {
    setBusy(true);
    try {
      await fn();
      await consent.reload();
      onNotification && onNotification(title, message);
    } catch (err) {
      onNotification && onNotification("Update Failed", describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const doctorName = (id) => (doctors.data || []).find((d) => d.id === id)?.name || "Doctor";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldCheck size={18} color="var(--color-primary-dark)" />
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Care Team Access</h3>
      </div>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        Doctors can only see journal entries you mark "Shared with Doctor", and only at the level you choose. You can revoke access at any time.
      </p>

      <LoadState loading={consent.loading} error={consent.error} onRetry={consent.reload} label="Loading your care team..." />

      {active.map((b) => (
        <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 10, background: "var(--color-bg)", borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Stethoscope size={14} /> {b.doctorName}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {ACCESS_LEVEL_LABELS[b.accessLevel] || b.accessLevel}{b.redFlagAlerts ? " • receives safety alerts" : ""}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy}
            onClick={() => run(() => revokeConsent(b.doctorId), "Access Revoked", `${b.doctorName} can no longer see your data.`)}
          >
            <UserMinus size={14} /> <span>Revoke</span>
          </button>
        </div>
      ))}
      {!consent.loading && !consent.error && active.length === 0 && (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No doctor currently has access to your data.</p>
      )}

      <div style={{ borderTop: "1px solid var(--color-border, #EEE)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)" }}>GRANT ACCESS</label>
        <LoadState loading={doctors.loading} error={doctors.error} onRetry={doctors.reload} label="Loading doctors..." />
        {!doctors.loading && !doctors.error && available.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No other doctors are available.</p>
        ) : (
          <>
            <select className="input-field" value={selected} onChange={(e) => setDoctorId(e.target.value)} aria-label="Doctor">
              {available.map((d) => (
                <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
              ))}
            </select>
            <select className="input-field" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} aria-label="Access level">
              {Object.entries(ACCESS_LEVEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} />
              Send this doctor safety alerts if my entries suggest I may be at risk
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy || !selected}
              onClick={() =>
                run(() => grantConsent(selected, accessLevel, alerts), "Access Granted", `${doctorName(selected)} has been added to your care team.`)
              }
            >
              <UserPlus size={14} /> <span>{busy ? "Saving..." : "Grant Access"}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { getAdminStats } from '../../services/clinicalApi';
import { useAsyncData } from '../../hooks/useAsyncData';
import { SafetyAlertQueue } from '../doctor/DoctorSafetyCenterView';
import { LoadState } from '../ui';

/**
 * Platform-wide safety oversight. Includes alerts that have no consented doctor
 * ("unassigned"), which only admins can triage.
 */
export default function AdminSafetyCenterView({ onNotification }) {
  const statsState = useAsyncData(getAdminStats, [], null);
  const stats = statsState.data || {};
  const metric = (v) => (statsState.loading ? "…" : v ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Admin Safety & Triage Center</h1>
          <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ShieldCheck size={13} /> Operational Governance
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          All platform safety alerts, including those with no consented doctor. Alerts never contain journal text.
        </p>
      </div>

      {/* Overview Metric Cards */}
      <div className="app-grid-3">
        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>OPEN SAFETY ALERTS</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#C0392B", marginTop: 4 }}>{metric(stats.openAlerts)}</div>
          <span className="badge badge-danger" style={{ marginTop: 8 }}>Awaiting Review</span>
        </div>

        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>UNASSIGNED (ADMIN TRIAGE)</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", marginTop: 4 }}>{metric(stats.unassignedAlerts)}</div>
          <span className="badge badge-warning" style={{ marginTop: 8 }}>No Consented Doctor</span>
        </div>

        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>ACTIVE DOCTORS</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#4CAF91", marginTop: 4 }}>{metric(stats.doctors)}</div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>Available for Escalation</span>
        </div>
      </div>
      <LoadState error={statsState.error} onRetry={statsState.reload} />

      <SafetyAlertQueue onNotification={onNotification} showAssignment />
    </div>
  );
}

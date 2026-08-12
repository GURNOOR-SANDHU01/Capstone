import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  CheckCircle2, 
  FileText, 
  Bell, 
  Send 
} from 'lucide-react';
import { getNotificationDeliveryLogs } from '../../services/notificationService';

export default function AdminSafetyCenterView() {
  const deliveryLogs = getNotificationDeliveryLogs();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Admin Safety & Telemetry Center</h1>
          <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ShieldCheck size={13} /> Operational Governance
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Monitor platform emergency escalation status, delivery logs, and system audit health.
        </p>
      </div>

      {/* Overview Metric Cards */}
      <div className="app-grid-3">
        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>DELIVERY SUCCESS RATE</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-primary-dark)", marginTop: 4 }}>100%</div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>0 Notification Failures</span>
        </div>

        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>DISPATCHED SAFETY NOTIFICATIONS</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1A1A2E", marginTop: 4 }}>{deliveryLogs.length}</div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>Total Tracked</span>
        </div>

        <div className="card">
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>ESCALATION PROTOCOL STATUS</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#4CAF91", marginTop: 4 }}>Healthy</div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>Backend Proxy Active</span>
        </div>
      </div>

      {/* Emergency Notification Delivery Audit Feed */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Emergency Notification Delivery Telemetry</h3>
          <span className="badge badge-muted">Least Privilege Logging</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {deliveryLogs.map((log) => (
            <div key={log.id} style={{ padding: 14, background: "var(--color-bg)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {log.recipientType}: {log.recipientName}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                  Channel: {log.channel} • Category: {log.riskCategory}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="badge badge-primary">{log.deliveryStatus}</span>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>{log.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

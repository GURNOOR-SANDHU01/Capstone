import { useState } from "react";
import { 
  Bell, 
  AlertTriangle, 
  Activity, 
  Award, 
  Sliders, 
  ChevronRight 
} from "lucide-react";

export default function NotificationSimulator({ triggerNotification }) {
  const [isOpen, setIsOpen] = useState(false);

  const notifications = [
    {
      id: "reminder",
      label: "Check-in Nudge",
      title: "Journal Check-in Reminder",
      desc: "It has been 24 hours since your last entry. Take 2 minutes to check in on your mood.",
      icon: Bell
    },
    {
      id: "dip",
      label: "Biometric Warning",
      title: "Biometric Dip Forecast",
      desc: "Sleep index is down 18% over 3 days. Elevated anxiety loops predicted mid-week.",
      icon: AlertTriangle
    },
    {
      id: "hrv",
      label: "HRV Calibration",
      title: "Calm State Detected",
      desc: "HRV rose to 52ms. High correlation with low speech stress markers. Keep it up!",
      icon: Activity
    },
    {
      id: "milestone",
      label: "Milestone Unlocked",
      title: "Resilience Milestone!",
      desc: "Completed your 3rd CBT reflection this week. Wellness baseline updated to +6%.",
      icon: Award
    }
  ];

  return (
    <div
      style={{
        background: "rgba(26, 26, 46, 0.95)",
        color: "#fff",
        borderRadius: 16,
        padding: isOpen ? "16px" : "10px 14px",
        boxShadow: "var(--shadow-lg)",
        border: "1px solid rgba(255,255,255,0.1)",
        width: isOpen ? 280 : "auto",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        pointerEvents: "auto",
        backdropFilter: "blur(12px)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sliders size={14} />
          {isOpen && <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Notification Hub</span>}
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 700,
            opacity: 0.7
          }}
        >
          {isOpen ? "Hide" : "Simulation Center"}
        </button>
      </div>

      {isOpen && (
        <div className="fade-in-anim" style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
          <p style={{ fontSize: 11, color: "#8E8E93", lineHeight: 1.4 }}>
            Manually trigger adaptive SentiMed reminders and biometric nudges to test the patient simulator.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {notifications.map(n => {
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => triggerNotification(n.title, n.desc)}
                  className="btn-hover"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon size={14} />
                    <span>{n.label}</span>
                  </div>
                  <ChevronRight size={12} style={{ opacity: 0.5 }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Watch, 
  Shield, 
  Bell, 
  Save, 
  CheckCircle2 
} from 'lucide-react';

export default function ProfileView({ currentUser, wearableConnected, setWearableConnected, onNotification }) {
  const profile = currentUser?.profile || {};
  
  const [name, setName] = useState(profile.name || "Gurnoor Sandhu");
  const [email, setEmail] = useState(currentUser?.email || "demo@example.com");
  const [mobile, setMobile] = useState(profile.mobile || "+1 (555) 234-5678");
  
  const [piiMasking, setPiiMasking] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(true);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    onNotification("Profile Updated", "Account preferences saved successfully to local state.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Profile & Account Settings</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Manage your personal details, privacy preferences, and biometric wearable integration.
        </p>
      </div>

      <div className="app-split-2-1">
        {/* Left Column: Personal Information Form */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div 
              style={{ 
                width: 64, 
                height: 64, 
                borderRadius: "var(--radius-full)", 
                background: "#EAF7F2", 
                color: "#2E7D62",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 800
              }}
            >
              {name.charAt(0)}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{name}</h2>
              <span className="badge badge-primary">{currentUser?.role === "clinician" ? "Clinician Account" : "Patient Account"}</span>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)" }}>
                FULL NAME
              </label>
              <div className="input-group">
                <span className="input-icon-left">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)" }}>
                EMAIL ADDRESS
              </label>
              <div className="input-group">
                <span className="input-icon-left">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)" }}>
                MOBILE NUMBER
              </label>
              <div className="input-group">
                <span className="input-icon-left">
                  <Phone size={18} />
                </span>
                <input
                  type="text"
                  className="input-field"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>
            </div>

            <div style={{ textAlign: "right", marginTop: 8 }}>
              <button type="submit" className="btn btn-primary">
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Wearable Devices & Privacy Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Wearable Sync Card */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Watch size={18} color="var(--color-primary-dark)" />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Biometric Wearable Sync</h3>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Fitbit / Apple Watch Sensor</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {wearableConnected ? "Syncing HRV & Sleep Telemetry" : "Disconnected"}
                </div>
              </div>
              <button
                onClick={() => {
                  setWearableConnected(!wearableConnected);
                  onNotification(
                    wearableConnected ? "Wearable Unpaired" : "Wearable Paired",
                    wearableConnected ? "Device telemetry sync paused." : "Device sensors connected successfully."
                  );
                }}
                className={`btn btn-sm ${wearableConnected ? "btn-outline" : "btn-primary"}`}
              >
                {wearableConnected ? "Disconnect" : "Pair Device"}
              </button>
            </div>
          </div>

          {/* Privacy & Notification Preferences */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={18} color="var(--color-primary-dark)" />
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Privacy & Compliance</h3>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>PII Data Masking</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Anonymize clinical identifiers for research</div>
              </div>
              <input
                type="checkbox"
                checked={piiMasking}
                onChange={(e) => setPiiMasking(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Daily Reflection Reminders</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Receive evening prompt notifications</div>
              </div>
              <input
                type="checkbox"
                checked={dailyReminders}
                onChange={(e) => setDailyReminders(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--color-primary)", cursor: "pointer" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
import { updateMyProfile } from '../../services/profileService';
import { describeError } from '../../services/apiClient';
import { ROLE_LABELS } from '../../constants/roles';
import CareTeamAccess from '../patient/CareTeamAccess';

const PHONE_PATTERN = /^[0-9+()\-.\s]{5,30}$/;

export default function ProfileView({ currentUser, onProfileUpdated, wearableConnected, setWearableConnected, onNotification }) {
  const profile = currentUser?.profile || {};

  const [name, setName] = useState(profile.name || "");
  const email = currentUser?.email || "";
  const [mobile, setMobile] = useState(profile.mobile || "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [piiMasking, setPiiMasking] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(true);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (mobile.trim() && !PHONE_PATTERN.test(mobile.trim())) {
      setFormError("Enter a valid phone number (digits, spaces, + - ( ) only).");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const updated = await updateMyProfile(currentUser, { name: name.trim(), mobile: mobile.trim() });
      onProfileUpdated && onProfileUpdated(updated);
      onNotification("Profile Updated", "Your profile has been saved.");
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setSaving(false);
    }
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
              {(name || email || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{name}</h2>
              <span className="badge badge-primary">{ROLE_LABELS[currentUser?.role] || "Patient"} Account</span>
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
                  readOnly
                  disabled
                  title="Your sign-in email cannot be changed here"
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

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 8 }}>
              {formError && <span role="alert" style={{ color: "#C0392B", fontSize: 12, flex: 1 }}>{formError}</span>}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={16} />
                <span>{saving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Care team, Wearable Devices & Privacy Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {currentUser?.role === "patient" && <CareTeamAccess onNotification={onNotification} />}
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

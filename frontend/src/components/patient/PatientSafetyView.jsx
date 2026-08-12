import React from 'react';
import { 
  ShieldAlert, 
  PhoneCall, 
  Phone,
  ArrowRight
} from 'lucide-react';
import { MeetingButton } from '../appointments/MeetingButton';

export default function PatientSafetyView({ onDismiss }) {
  return (
    <div 
      style={{ 
        position: "fixed", 
        inset: 0, 
        backgroundColor: "rgba(26,26,46,0.85)", 
        backdropFilter: "blur(8px)", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        zIndex: 10000, 
        padding: 24 
      }}
    >
      <div 
        className="card" 
        style={{ 
          maxWidth: 520, 
          width: "100%", 
          padding: 36, 
          display: "flex", 
          flexDirection: "column", 
          gap: 20,
          borderRadius: 24,
          boxShadow: "var(--shadow-lg)"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", backgroundColor: "var(--color-danger-soft)", color: "var(--color-danger)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldAlert size={36} />
          </div>

          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "#1A1A2E" }}>
              Your Safety & Well-being Matter
            </h1>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: 6, lineHeight: 1.5 }}>
              We noticed your responses indicated high stress or distress right now. Please know that support is available immediately.
            </p>
          </div>
        </div>

        {/* Crisis Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MeetingButton
            meetingUrl="https://meet.google.com/demo-sentimed-call"
            size="lg"
            style={{ width: "100%", justifyContent: "center" }}
          />

          <a
            href="tel:988"
            className="btn btn-secondary btn-lg"
            style={{ width: "100%", justifyContent: "space-between", textDecoration: "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Phone size={18} color="#2E7D62" />
              <span>Call 988 Suicide & Crisis Lifeline (Free & 24/7)</span>
            </div>
            <ArrowRight size={16} />
          </a>

          <a
            href="tel:911"
            className="btn btn-outline btn-lg"
            style={{ width: "100%", justifyContent: "space-between", textDecoration: "none", color: "var(--color-danger)", borderColor: "rgba(224,92,92,0.3)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PhoneCall size={18} />
              <span>Call 911 Emergency Services</span>
            </div>
            <ArrowRight size={16} />
          </a>
        </div>

        {/* Disclaimer & Dismiss */}
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            SentiMed AI is not a substitute for human crisis intervention.
          </span>
          <button onClick={onDismiss} className="btn btn-ghost btn-sm">
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Eye, 
  Lock, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';
import { maskPiiText } from '../../services/privacy/maskingService';
import { detectPii } from '../../services/privacy/piiDetector';

export default function PiiMaskingView() {
  const [inputText, setInputText] = useState(
    "Contact me at sarah@example.com or call 415-555-0199. I live at 742 Evergreen Terrace, Springfield."
  );

  const maskedOutput = maskPiiText(inputText);
  const detectedPiiItems = detectPii(inputText);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Privacy & Data Masking Engine</h1>
          <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <ShieldCheck size={13} /> Active Client Redaction
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Automated personally identifiable information (PII) detection and redaction layer before analytics transmission.
        </p>
      </div>

      {/* Main Grid */}
      <div className="app-split-2-1">
        {/* Left Column: Interactive Live Preview */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Interactive Masking Playground</h2>
          
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 6 }}>
              ORIGINAL UNMASKED INPUT TEXT
            </label>
            <textarea
              className="input-field"
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type anything containing emails, phone numbers, or addresses..."
              style={{ resize: "vertical", height: "auto" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-dark)", display: "block", marginBottom: 6 }}>
              AUTOMATICALLY REDACTED OUTPUT (SENT TO AI & ANALYTICS)
            </label>
            <div 
              style={{ 
                background: "var(--color-bg)", 
                border: "1px solid var(--color-border)", 
                borderRadius: "var(--radius-sm)", 
                padding: 16,
                fontSize: 14,
                lineHeight: 1.6,
                minHeight: 100,
                color: "var(--color-text)"
              }}
            >
              {maskedOutput || <span style={{ color: "var(--color-text-muted)" }}>Redacted preview will appear here...</span>}
            </div>
          </div>

          {/* Detections Breakdown */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-muted)", marginBottom: 8 }}>
              DETECTED SENSITIVE ENTITIES ({detectedPiiItems.length})
            </h3>
            {detectedPiiItems.length === 0 ? (
              <div className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <CheckCircle2 size={12} /> No PII entities detected in current sample text.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {detectedPiiItems.map((item, idx) => (
                  <span key={idx} className="badge badge-danger">
                    {item.category}: {item.value}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Protected Categories & Architecture Overview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Protected PII Categories</h3>

            {[
              { title: "Phone Numbers", desc: "US & international phone patterns", pattern: "[PHONE REDACTED]" },
              { title: "Email Addresses", desc: "Standard email format detection", pattern: "[EMAIL REDACTED]" },
              { title: "Physical Addresses", desc: "Street names, avenues & zip codes", pattern: "[ADDRESS REDACTED]" },
              { title: "Government IDs & SSNs", desc: "Numeric identification patterns", pattern: "[SSN/ID REDACTED]" },
              { title: "Dates of Birth", desc: "Calendar DOB format strings", pattern: "[DOB REDACTED]" }
            ].map((cat, idx) => (
              <div key={idx} style={{ background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{cat.title}</span>
                  <span className="badge badge-muted" style={{ fontSize: 10 }}>{cat.pattern}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{cat.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--color-bg)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)", fontSize: 12, color: "var(--color-text-muted)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>
              <AlertCircle size={14} /> Compliance Disclaimer
            </div>
            Automated client-side masking reduces PII exposure before sending data to external AI models or telemetry backends. Automated detectors may not catch every custom sensitivity pattern.
          </div>
        </div>
      </div>
    </div>
  );
}

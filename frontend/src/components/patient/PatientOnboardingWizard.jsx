import React, { useState } from 'react';
import { 
  HeartPulse, 
  ShieldCheck, 
  User, 
  Phone, 
  Activity, 
  ArrowRight, 
  ChevronLeft
} from 'lucide-react';
import { saveScreeningResult, RISK_LEVELS } from '../../services/screeningService';
import { createRiskAlert } from '../../services/riskWorkflowService';
import { dispatchSafetyNotification } from '../../services/notificationService';
import { Button } from '../ui';

export default function PatientOnboardingWizard({ currentUser, initialStep = 1, onComplete, onTriggerUrgentSafety }) {
  const [step, setStep] = useState(initialStep);
  const totalSteps = 5;

  // Basic Info
  const [fullName, setFullName] = useState(currentUser?.profile?.name || "Gurnoor Sandhu");
  const [language, setLanguage] = useState("English");
  const [phone, setPhone] = useState(currentUser?.profile?.mobile || "+1 (555) 234-5678");

  // Emergency Contact
  const [contactName, setContactName] = useState(currentUser?.profile?.emergencyContact?.name || "");
  const [contactRelation, setContactRelation] = useState(currentUser?.profile?.emergencyContact?.relation || "Spouse / Partner");
  const [contactPhone, setContactPhone] = useState(currentUser?.profile?.emergencyContact?.phone || "");
  const [contactConsent, setContactConsent] = useState(Boolean(currentUser?.profile?.emergencyContact?.phone));

  // Wellness Screening Answers
  const [moodState, setMoodState] = useState("stable");
  const [anxietyState, setAnxietyState] = useState("mild");
  const [sleepState, setSleepState] = useState("moderate");
  const [energyState, setEnergyState] = useState("normal");

  // Safety Screening Answers
  const [crisisThoughts, setCrisisThoughts] = useState("none");
  const [immediateRisk, setImmediateRisk] = useState("no");

  // Privacy Consent
  const [privacyConsent, setPrivacyConsent] = useState(true);

  const handleNext = () => {
    if (step === 2 && (!fullName.trim() || !phone.trim())) {
      alert("Please fill in your basic contact details.");
      return;
    }
    if (step === 3 && (!contactName.trim() || !contactPhone.trim() || !contactConsent)) {
      alert("Please provide emergency contact details and confirm consent.");
      return;
    }
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmitOnboarding();
    }
  };

  const handleBack = () => {
    if (step > initialStep) setStep(step - 1);
  };

  const handleSubmitOnboarding = async () => {
    const onboardingData = {
      basicInfo: { fullName, language, phone },
      emergencyContact: { name: contactName, relation: contactRelation, phone: contactPhone },
      wellnessAnswers: { mood: moodState, anxiety: anxietyState, sleep: sleepState, energy: energyState },
      safetyAnswers: { crisisThoughts, immediateRisk }
    };

    const record = saveScreeningResult(currentUser, onboardingData);

    if (record.riskCategory !== RISK_LEVELS.LOW) {
      createRiskAlert(record);
      await dispatchSafetyNotification({
        recipientType: "DOCTOR",
        recipientName: "Dr. Sarah Jenkins",
        riskCategory: record.riskCategory,
        alertType: record.riskCategory === RISK_LEVELS.HIGH_URGENT ? "URGENT_SAFETY_SCREENING" : "MODERATE_WELLNESS_FLAG"
      });

      if (record.riskCategory === RISK_LEVELS.HIGH_URGENT) {
        onTriggerUrgentSafety(record);
        return;
      }
    }

    onComplete(record);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>
      {/* Header & Progress Indicator */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>
          Senti<span style={{ color: "var(--color-primary)" }}>Med</span> Wellness Intake
        </div>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
          {initialStep > 1 ? `Completing Missing Section (${step} of ${totalSteps})` : `Step ${step} of ${totalSteps}`}
        </div>

        {/* Progress Bar */}
        <div style={{ width: "100%", height: 6, background: "#E8EAE8", borderRadius: 6, marginTop: 12, overflow: "hidden" }}>
          <div 
            style={{ 
              width: `${(step / totalSteps) * 100}%`, 
              height: "100%", 
              background: "var(--color-primary)", 
              borderRadius: 6,
              transition: "width 0.3s ease" 
            }} 
          />
        </div>
      </div>

      {/* Main Step Card */}
      <div className="card" style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#EAF7F2", color: "#2E7D62", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HeartPulse size={32} />
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800 }}>
              Welcome to Your Care Space
            </h2>
            <p style={{ fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.6, maxWidth: 480 }}>
              Before exploring SentiMed, let's complete a quick confidential intake. This helps tailor your CBT reflections and enables authorized clinical care coordination.
            </p>
          </div>
        )}

        {/* STEP 2: BASIC INFORMATION */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <User size={20} color="var(--color-primary-dark)" />
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Basic Information</h2>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>FULL NAME</label>
              <input type="text" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>PHONE NUMBER</label>
              <input type="text" className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>PREFERRED LANGUAGE</label>
              <select className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 3: EMERGENCY CONTACT */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Phone size={20} color="var(--color-primary-dark)" />
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Emergency Contact</h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Designate a trusted individual who can be reached according to SentiMed safety policies.
            </p>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>CONTACT NAME</label>
              <input type="text" className="input-field" placeholder="e.g. Jane Sandhu" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>RELATIONSHIP</label>
              <select className="input-field" value={contactRelation} onChange={(e) => setContactRelation(e.target.value)}>
                <option value="Spouse / Partner">Spouse / Partner</option>
                <option value="Parent / Guardian">Parent / Guardian</option>
                <option value="Sibling">Sibling</option>
                <option value="Close Friend">Close Friend</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>CONTACT PHONE</label>
              <input type="text" className="input-field" placeholder="+1 (555) 987-6543" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 6 }}>
              <input 
                type="checkbox" 
                id="emergency-consent"
                checked={contactConsent} 
                onChange={(e) => setContactConsent(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--color-primary)" }}
              />
              <label htmlFor="emergency-consent" style={{ fontSize: 12, color: "var(--color-text)", lineHeight: 1.4 }}>
                I understand that this contact may be reached according to SentiMed's safety and emergency policy in urgent situations.
              </label>
            </div>
          </div>
        )}

        {/* STEP 4: WELLNESS SCREENING */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={20} color="var(--color-primary-dark)" />
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Wellness Baseline Screening</h2>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Rate your recent experiences over the past 14 days. (Non-diagnostic assessment).
            </p>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>How has your sleep quality been recently?</label>
              <select className="input-field" value={sleepState} onChange={(e) => setSleepState(e.target.value)}>
                <option value="normal">Restful & Regular (7+ hours)</option>
                <option value="moderate">Occasional Sleep Disruption</option>
                <option value="severe">Severe Insomnia / Restlessness</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Have you experienced elevated anxiety or muscle tension?</label>
              <select className="input-field" value={anxietyState} onChange={(e) => setAnxietyState(e.target.value)}>
                <option value="low">Minimal / Rare</option>
                <option value="mild">Mild Work or Life Stress</option>
                <option value="severe">Frequent / Prolonged Anxiety</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 5: SAFETY SCREENING & PRIVACY CONSENT */}
        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={20} color="var(--color-primary-dark)" />
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Safety Screening & Privacy</h2>
            </div>

            <div style={{ background: "var(--color-bg)", padding: 14, borderRadius: 10, border: "1px solid var(--color-border)" }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Over the past 2 weeks, have you had thoughts of self-harm or feeling overwhelmed?
              </label>
              <select className="input-field" value={crisisThoughts} onChange={(e) => setCrisisThoughts(e.target.value)}>
                <option value="none">No, not at all</option>
                <option value="occasional">Occasional passing thoughts</option>
                <option value="frequent">Frequent or intense thoughts</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 8 }}>
              <input 
                type="checkbox" 
                id="privacy-policy"
                checked={privacyConsent} 
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--color-primary)" }}
              />
              <label htmlFor="privacy-policy" style={{ fontSize: 12, color: "var(--color-text)", lineHeight: 1.4 }}>
                I consent to automated PII data masking and encrypted clinical telemetry transmission as described in the SentiMed Privacy Policy.
              </label>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--color-border)", paddingTop: 16, marginTop: 8 }}>
          {step > initialStep ? (
            <Button variant="outline" icon={ChevronLeft} onClick={handleBack}>
              Back
            </Button>
          ) : <div />}

          <Button variant="primary" icon={ArrowRight} onClick={handleNext}>
            {step === totalSteps ? "Complete Onboarding" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

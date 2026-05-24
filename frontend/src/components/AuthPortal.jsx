import { useState } from "react";
import { loginUser, signUpPatient, loginWithGoogle, isRealFirebaseConfigured, setForceSandbox } from "../services/firebase";

export default function AuthPortal({ onAuthSuccess, onNotification }) {
  const [authView, setAuthView] = useState("patient-login"); // patient-login, clinician-login, patient-register
  const [registerStep, setRegisterStep] = useState(1); // 1 to 4
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Login credentials
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Patient Registration Details
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  
  // Emergency Contacts
  const [emergencyContact1, setEmergencyContact1] = useState({ name: "", phone: "" });
  const [emergencyContact2, setEmergencyContact2] = useState({ name: "", phone: "" });
  const [emergencyEmail, setEmergencyEmail] = useState("");

  // Medical History
  const [hasMedicalIssue, setHasMedicalIssue] = useState(false);
  const [medicalIssueText, setMedicalIssueText] = useState("");
  const [isUnderTreatment, setIsUnderTreatment] = useState(false);
  const [treatmentText, setTreatmentText] = useState("");

  // Google Login handling
  const handleGoogleLogin = async (role) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const user = await loginWithGoogle(role);
      onNotification("🔑 Google Sign-in Success", `Signed in securely as ${user.email}`);
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(err.message || "Failed to sign in via Google.");
    } finally {
      setIsLoading(false);
    }
  };

  // Standard login handling
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMsg("Please fill in all email and password parameters.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    const role = authView === "patient-login" ? "patient" : "clinician";
    try {
      const user = await loginUser(loginEmail, loginPassword, role);
      onNotification("🔑 Sign-in Success", `Access granted. Role: ${role.toUpperCase()}`);
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(err.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // Patient registration submit
  const handleRegisterSubmit = async () => {
    if (!regEmail.trim() || !regPassword.trim() || !regName.trim() || !regMobile.trim()) {
      setErrorMsg("Please ensure all core profile fields are filled.");
      return;
    }
    
    setIsLoading(true);
    setErrorMsg("");

    const profileData = {
      name: regName.trim(),
      mobile: regMobile.trim(),
      emergencyContacts: [
        { name: emergencyContact1.name.trim(), phone: emergencyContact1.phone.trim() },
        { name: emergencyContact2.name.trim(), phone: emergencyContact2.phone.trim() }
      ],
      emergencyEmail: emergencyEmail.trim(),
      medicalIssue: hasMedicalIssue,
      medicalIssueText: hasMedicalIssue ? medicalIssueText.trim() : "",
      ongoingTreatment: isUnderTreatment,
      ongoingTreatmentText: isUnderTreatment ? treatmentText.trim() : ""
    };

    try {
      const newUser = await signUpPatient(regEmail, regPassword, profileData);
      onNotification("🏆 Account Registered", "Medical intake profile compiled and secured.");
      onAuthSuccess(newUser);
    } catch (err) {
      setErrorMsg(err.message || "Failed to complete account registration.");
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    setErrorMsg("");
    if (registerStep === 1) {
      if (!regEmail.trim() || !regPassword.trim()) {
        setErrorMsg("Email and password credentials are required.");
        return;
      }
      if (regPassword.length < 6) {
        setErrorMsg("Password must be at least 6 characters.");
        return;
      }
    }
    if (registerStep === 2) {
      if (!regName.trim() || !regMobile.trim()) {
        setErrorMsg("Name and mobile number parameters are required.");
        return;
      }
    }
    if (registerStep === 3) {
      if (!emergencyContact1.name.trim() || !emergencyContact1.phone.trim() || !emergencyContact2.name.trim() || !emergencyContact2.phone.trim()) {
        setErrorMsg("Please specify details for both emergency contacts.");
        return;
      }
      if (!emergencyEmail.trim()) {
        setErrorMsg("An emergency contact email address is required.");
        return;
      }
    }
    setRegisterStep(prev => prev + 1);
  };

  const prevStep = () => {
    setErrorMsg("");
    setRegisterStep(prev => prev - 1);
  };

  return (
    <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "85vh", padding: 20 }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: authView === "patient-register" ? 640 : 440, padding: 32, boxShadow: "var(--shadow-lg)", transition: "max-width 0.3s ease" }}>
        
        {/* Mode Toggle Badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 10, borderBottom: "1px dashed var(--border-light)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isRealFirebaseConfigured ? "var(--teal-primary)" : "var(--amber-primary)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Mode: {isRealFirebaseConfigured ? "Live Firebase" : "Local Sandbox"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setForceSandbox(isRealFirebaseConfigured)}
            style={{
              background: "none",
              border: "none",
              color: "var(--teal-dark)",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0
            }}
          >
            {isRealFirebaseConfigured ? "Switch to Sandbox Mode" : "Switch to Live Firebase"}
          </button>
        </div>
        
        {/* Toggle switch between views */}
        {authView !== "patient-register" && (
          <div style={{ display: "flex", background: "var(--indigo-light)", padding: 4, borderRadius: 10, marginBottom: 24, gap: 4 }}>
            <button
              onClick={() => {
                setAuthView("patient-login");
                setErrorMsg("");
              }}
              style={{
                flex: 1,
                border: "none",
                background: authView === "patient-login" ? "#fff" : "none",
                color: authView === "patient-login" ? "var(--text-dark)" : "var(--text-muted)",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Patient Sign-in
            </button>
            <button
              onClick={() => {
                setAuthView("clinician-login");
                setErrorMsg("");
              }}
              style={{
                flex: 1,
                border: "none",
                background: authView === "clinician-login" ? "#fff" : "none",
                color: authView === "clinician-login" ? "var(--text-dark)" : "var(--text-muted)",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Clinician Portal
            </button>
          </div>
        )}

        {/* LOG IN VIEWS */}
        {authView !== "patient-register" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 32 }}>{authView === "patient-login" ? "🍃" : "🩺"}</span>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--indigo-primary)", marginTop: 6 }}>
                {authView === "patient-login" ? "SentiMed Patient Access" : "Clinician Medical Hub"}
              </h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Enter credentials or connect using Google credentials.
              </p>
            </div>

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email Address</label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1.5px solid var(--border-light)",
                    fontSize: 13,
                    outline: "none",
                    background: "#FAF9F5"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Security Password</label>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1.5px solid var(--border-light)",
                    fontSize: 13,
                    outline: "none",
                    background: "#FAF9F5"
                  }}
                />
              </div>

              {errorMsg && (
                <div style={{ background: "rgba(224, 92, 92, 0.08)", border: "1.5px solid var(--rose-primary)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                  <div style={{ color: "var(--rose-dark)", fontSize: 12, fontWeight: 700 }}>
                    {errorMsg}
                  </div>
                  {errorMsg.includes("configuration-not-found") && (
                    <div style={{ fontSize: 11, color: "var(--text-main)", marginTop: 8, lineHeight: 1.4 }}>
                      💡 <strong>Firebase Setup Required:</strong> You need to enable <strong>Email/Password</strong> sign-in method in your Firebase Authentication Console {"(Sign-in method -> Add provider -> Email/Password)"}.
                      <div style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={() => setForceSandbox(true)}
                          style={{
                            background: "var(--teal-primary)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Switch to Offline Sandbox Mode
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-hover"
                style={{
                  background: "var(--indigo-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: 12,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  marginTop: 6
                }}
              >
                {isLoading ? "Authenticating..." : "Sign In with Password"}
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
            </div>

            {/* Google OAuth Button */}
            <button
              onClick={() => handleGoogleLogin(authView === "patient-login" ? "patient" : "clinician")}
              disabled={isLoading}
              className="btn-hover"
              style={{
                width: "100%",
                background: "#fff",
                border: "1.5px solid var(--border-light)",
                borderRadius: 12,
                padding: 11,
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-dark)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285f4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34a853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#fbbc05"/>
                <path d="M9 3.58c1.32 0 2.505.453 3.44 1.346l2.582-2.58C13.463.896 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#ea4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            {authView === "patient-login" && (
              <div style={{ marginTop: 24, textAlign: "center", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>New to SentiMed? </span>
                <button
                  onClick={() => {
                    setAuthView("patient-register");
                    setRegisterStep(1);
                    setErrorMsg("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--teal-primary)",
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  Register Patient Account
                </button>
              </div>
            )}
          </div>
        )}

        {/* PATIENT REGISTRATION/INTAKE WIZARD */}
        {authView === "patient-register" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            
            {/* Header progress details */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid var(--border-light)", paddingBottom: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--indigo-primary)" }}>Patient Intake Registration</h2>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Provide demographics, emergency circles, and medical parameters.</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--teal-dark)", background: "var(--teal-light)", padding: "4px 10px", borderRadius: 12 }}>
                Step {registerStep} of 4
              </span>
            </div>

            {/* STEP 1: ACCOUNT CREDENTIALS */}
            {registerStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>Step 1: Account Login Parameters</h3>
                
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email Address (Patient Email)</label>
                  <input
                    type="email"
                    placeholder="example@patient.com"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid var(--border-light)",
                      fontSize: 13,
                      outline: "none",
                      background: "#FAF9F5"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password (Min. 6 characters)</label>
                  <input
                    type="password"
                    placeholder="Create secure password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid var(--border-light)",
                      fontSize: 13,
                      outline: "none",
                      background: "#FAF9F5"
                    }}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: PROFILE DETAILS */}
            {registerStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>Step 2: Demographics & Profiles</h3>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Patient Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter name"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid var(--border-light)",
                      fontSize: 13,
                      outline: "none",
                      background: "#FAF9F5"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Patient Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="Enter mobile number"
                    value={regMobile}
                    onChange={e => setRegMobile(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid var(--border-light)",
                      fontSize: 13,
                      outline: "none",
                      background: "#FAF9F5"
                    }}
                  />
                </div>
              </div>
            )}

            {/* STEP 3: EMERGENCY CIRCLE */}
            {registerStep === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>Step 3: Emergency Contacts & Emails</h3>

                {/* Contact 1 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "var(--indigo-light)", padding: 12, borderRadius: 10 }}>
                  <div style={{ gridColumn: "span 2", fontSize: 11, fontWeight: 700, color: "var(--indigo-primary)", textTransform: "uppercase" }}>Primary Emergency Contact</div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Contact Name</label>
                    <input
                      type="text"
                      placeholder="Name"
                      value={emergencyContact1.name}
                      onChange={e => setEmergencyContact1({ ...emergencyContact1, name: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1.5px solid var(--border-light)",
                        fontSize: 12,
                        outline: "none",
                        background: "#fff"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={emergencyContact1.phone}
                      onChange={e => setEmergencyContact1({ ...emergencyContact1, phone: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1.5px solid var(--border-light)",
                        fontSize: 12,
                        outline: "none",
                        background: "#fff"
                      }}
                    />
                  </div>
                </div>

                {/* Contact 2 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "var(--indigo-light)", padding: 12, borderRadius: 10 }}>
                  <div style={{ gridColumn: "span 2", fontSize: 11, fontWeight: 700, color: "var(--indigo-primary)", textTransform: "uppercase" }}>Secondary Emergency Contact</div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Contact Name</label>
                    <input
                      type="text"
                      placeholder="Name"
                      value={emergencyContact2.name}
                      onChange={e => setEmergencyContact2({ ...emergencyContact2, name: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1.5px solid var(--border-light)",
                        fontSize: 12,
                        outline: "none",
                        background: "#fff"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={emergencyContact2.phone}
                      onChange={e => setEmergencyContact2({ ...emergencyContact2, phone: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1.5px solid var(--border-light)",
                        fontSize: 12,
                        outline: "none",
                        background: "#fff"
                      }}
                    />
                  </div>
                </div>

                {/* Emergency Email */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Emergency Email (Notification Dispatch Target)</label>
                  <input
                    type="email"
                    placeholder="emergency-notifications@contact.com"
                    value={emergencyEmail}
                    onChange={e => setEmergencyEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1.5px solid var(--border-light)",
                      fontSize: 13,
                      outline: "none",
                      background: "#FAF9F5"
                    }}
                  />
                </div>
              </div>
            )}

            {/* STEP 4: MEDICAL BACKGROUND */}
            {registerStep === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>Step 4: Clinical History & Active Treatment</h3>

                {/* Medical issue selection */}
                <div style={{ border: "1.5px solid var(--border-light)", borderRadius: 12, padding: 14, background: hasMedicalIssue ? "var(--amber-light)" : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)" }}>
                      Are you currently suffering from any medical issues?
                    </label>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => setHasMedicalIssue(true)}
                        style={{
                          flex: 1,
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1.5px solid " + (hasMedicalIssue ? "var(--teal-primary)" : "var(--border-light)"),
                          background: hasMedicalIssue ? "var(--teal-light)" : "#fff",
                          color: hasMedicalIssue ? "var(--teal-dark)" : "var(--text-muted)",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 13,
                          transition: "all 0.2s"
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHasMedicalIssue(false);
                          setMedicalIssueText("");
                        }}
                        style={{
                          flex: 1,
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1.5px solid " + (!hasMedicalIssue ? "var(--rose-primary)" : "var(--border-light)"),
                          background: !hasMedicalIssue ? "var(--rose-light)" : "#fff",
                          color: !hasMedicalIssue ? "var(--rose-dark)" : "var(--text-muted)",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 13,
                          transition: "all 0.2s"
                        }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  {hasMedicalIssue && (
                    <textarea
                      placeholder="Please describe medical issues (e.g. chronic pain, physical ailments, clinical diagnoses)..."
                      value={medicalIssueText}
                      onChange={e => setMedicalIssueText(e.target.value)}
                      style={{
                        width: "100%",
                        height: 60,
                        border: "1px solid var(--border-light)",
                        borderRadius: 8,
                        padding: 8,
                        fontSize: 12,
                        outline: "none",
                        resize: "none",
                        marginTop: 10,
                        background: "#fff",
                        fontFamily: "var(--font-sans)"
                      }}
                    />
                  )}
                </div>

                {/* Ongoing treatment selection */}
                <div style={{ border: "1.5px solid var(--border-light)", borderRadius: 12, padding: 14, background: isUnderTreatment ? "var(--teal-light)" : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)" }}>
                      Is any active medical treatment or therapy going on?
                    </label>
                    <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => setIsUnderTreatment(true)}
                        style={{
                          flex: 1,
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1.5px solid " + (isUnderTreatment ? "var(--teal-primary)" : "var(--border-light)"),
                          background: isUnderTreatment ? "var(--teal-light)" : "#fff",
                          color: isUnderTreatment ? "var(--teal-dark)" : "var(--text-muted)",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 13,
                          transition: "all 0.2s"
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUnderTreatment(false);
                          setTreatmentText("");
                        }}
                        style={{
                          flex: 1,
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1.5px solid " + (!isUnderTreatment ? "var(--rose-primary)" : "var(--border-light)"),
                          background: !isUnderTreatment ? "var(--rose-light)" : "#fff",
                          color: !isUnderTreatment ? "var(--rose-dark)" : "var(--text-muted)",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: 13,
                          transition: "all 0.2s"
                        }}
                      >
                        No
                      </button>
                    </div>
                  </div>
                  {isUnderTreatment && (
                    <textarea
                      placeholder="Describe ongoing treatment, active therapy, or registered medications..."
                      value={treatmentText}
                      onChange={e => setTreatmentText(e.target.value)}
                      style={{
                        width: "100%",
                        height: 60,
                        border: "1px solid var(--border-light)",
                        borderRadius: 8,
                        padding: 8,
                        fontSize: 12,
                        outline: "none",
                        resize: "none",
                        marginTop: 10,
                        background: "#fff",
                        fontFamily: "var(--font-sans)"
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Error notifications */}
            {errorMsg && (
              <div style={{ background: "rgba(224, 92, 92, 0.08)", border: "1.5px solid var(--rose-primary)", borderRadius: 12, padding: 14, marginTop: 14, textAlign: "center" }}>
                <div style={{ color: "var(--rose-dark)", fontSize: 12, fontWeight: 700 }}>
                  {errorMsg}
                </div>
                {errorMsg.includes("configuration-not-found") && (
                  <div style={{ fontSize: 11, color: "var(--text-main)", marginTop: 8, lineHeight: 1.4 }}>
                    💡 <strong>Firebase Setup Required:</strong> You need to enable <strong>Email/Password</strong> sign-in method in your Firebase Authentication Console {"(Sign-in method -> Add provider -> Email/Password)"}.
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => setForceSandbox(true)}
                        style={{
                          background: "var(--teal-primary)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Switch to Offline Sandbox Mode
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step navigation buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, borderTop: "1px solid var(--border-light)", paddingTop: 18 }}>
              {registerStep > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  style={{ background: "none", border: "1.5px solid var(--border-light)", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--text-dark)" }}
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthView("patient-login");
                    setErrorMsg("");
                  }}
                  style={{ background: "none", border: "1.5px solid var(--border-light)", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--text-dark)" }}
                >
                  Cancel
                </button>
              )}

              {registerStep < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  style={{ background: "var(--indigo-primary)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRegisterSubmit}
                  disabled={isLoading}
                  style={{ background: "var(--teal-primary)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {isLoading ? "Saving Intake Profile..." : "Register Profile"}
                </button>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

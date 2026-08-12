import { useState } from "react";
import { 
  Leaf, 
  Stethoscope, 
  ShieldCheck, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle,
  Building2
} from "lucide-react";

import { 
  loginUser, 
  signUpPatient, 
  loginWithGoogle, 
  isRealFirebaseConfigured, 
  setForceSandbox 
} from "../services/firebase";

export default function AuthPortal({ onAuthSuccess, onNotification }) {
  const [authView, setAuthView] = useState("patient-login"); // patient-login, doctor-login, admin-login, patient-register
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Login credentials
  const [loginEmail, setLoginEmail] = useState("demo@example.com");
  const [loginPassword, setLoginPassword] = useState("password123");

  // Registration credentials
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regMobile, setRegMobile] = useState("");

  const activeRole = authView === "doctor-login" ? "doctor" : authView === "admin-login" ? "admin" : "patient";
  const isRegister = authView === "patient-register";

  // Google Sign-in
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const user = await loginWithGoogle(activeRole);
      onNotification("Sign-in Success", `Signed in as ${user.email} (${activeRole.toUpperCase()})`);
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(err.message || "Failed to sign in via Google.");
    } finally {
      setIsLoading(false);
    }
  };

  // Standard Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMsg("Please provide your email and password.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");

    try {
      const user = await loginUser(loginEmail, loginPassword, activeRole);
      onNotification("Sign-in Success", `Access granted to ${activeRole.toUpperCase()} Portal.`);
      onAuthSuccess(user);
    } catch (err) {
      setErrorMsg(err.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regEmail.trim() || !regPassword.trim() || !regName.trim()) {
      setErrorMsg("Please complete all required registration fields.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");

    const profileData = {
      name: regName.trim(),
      mobile: regMobile.trim() || "+1 (555) 000-0000"
    };

    try {
      const newUser = await signUpPatient(regEmail, regPassword, profileData);
      onNotification("Account Created", "Your SentiMed wellness account has been registered.");
      onAuthSuccess(newUser);
    } catch (err) {
      setErrorMsg(err.message || "Failed to complete account registration.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "24px 16px" }}>
      
      {/* Environment Control Header */}
      <div 
        style={{ 
          width: "100%", 
          maxWidth: 520, 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center" 
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>
            Senti<span style={{ color: "var(--color-primary)" }}>Med</span>
          </div>
          <span 
            style={{ 
              backgroundColor: "#EAF7F2", 
              color: "#2E7D62", 
              border: "1px solid #D4EDE4", 
              borderRadius: "9999px", 
              fontSize: 12, 
              fontWeight: 600, 
              padding: "3px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <ShieldCheck size={13} />
            Sandbox Portal
          </span>
        </div>

        {/* Environment Toggle Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span 
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: 6, 
              fontSize: 12, 
              color: isRealFirebaseConfigured ? "#2E7D62" : "#B8690A", 
              fontWeight: 600,
              backgroundColor: isRealFirebaseConfigured ? "#EAF7F2" : "#FFF8EC",
              padding: "4px 8px",
              borderRadius: "6px"
            }}
          >
            <span 
              style={{ 
                width: 6, 
                height: 6, 
                borderRadius: "50%", 
                backgroundColor: isRealFirebaseConfigured ? "#4CAF91" : "#F5A623" 
              }} 
            />
            {isRealFirebaseConfigured ? "Live Firebase" : "Sandbox Mode"}
          </span>

          <button
            type="button"
            onClick={() => setForceSandbox(!isRealFirebaseConfigured)}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 8px" }}
          >
            Switch Mode
          </button>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 500,
          padding: "36px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          borderRadius: 20
        }}
      >
        {/* Unified Role Segmented Control Tabs */}
        {!isRegister && (
          <div className="segmented-control">
            <button
              type="button"
              onClick={() => { setAuthView("patient-login"); setErrorMsg(""); }}
              className={`segmented-tab ${activeRole === "patient" ? "active" : ""}`}
            >
              <Leaf size={15} />
              <span>Patient</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthView("doctor-login"); setErrorMsg(""); }}
              className={`segmented-tab ${activeRole === "doctor" ? "active" : ""}`}
            >
              <Stethoscope size={15} />
              <span>Doctor</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthView("admin-login"); setErrorMsg(""); }}
              className={`segmented-tab ${activeRole === "admin" ? "active" : ""}`}
            >
              <ShieldCheck size={15} />
              <span>Admin</span>
            </button>
          </div>
        )}

        {/* Circular Soft Icon */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              backgroundColor: "#EAF7F2",
              color: "#2E7D62",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {activeRole === "doctor" ? <Stethoscope size={28} /> : activeRole === "admin" ? <ShieldCheck size={28} /> : <Leaf size={28} />}
          </div>

          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "#1A1A2E" }}>
              {isRegister 
                ? "Create SentiMed Account" 
                : activeRole === "doctor"
                  ? "Doctor Care Access" 
                  : activeRole === "admin"
                    ? "Administrator Control Access"
                    : "SentiMed Patient Access"}
            </h1>
            <p style={{ fontSize: 13, color: "#6F7280", marginTop: 4 }}>
              {isRegister
                ? "Begin tracking your cognitive wellness with confidential AI reflection."
                : "Securely access your SentiMed workspace."}
            </p>
          </div>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div
            style={{
              backgroundColor: "var(--color-danger-soft)",
              color: "#A83C3C",
              border: "1px solid rgba(224, 92, 92, 0.2)",
              padding: "12px 16px",
              borderRadius: 10,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Standard Login Form */}
        {!isRegister ? (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Email Field */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="auth-email" style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>
                Email address
              </label>
              <div className="input-group">
                <span className="input-icon-left">
                  <Mail size={18} />
                </span>
                <input
                  id="auth-email"
                  type="email"
                  className="input-field"
                  placeholder="demo@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="auth-password" style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>
                Password
              </label>
              <div className="input-group">
                <span className="input-icon-left">
                  <Lock size={18} />
                </span>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  className="input-field has-right-icon"
                  placeholder="••••••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="input-icon-right"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isLoading}
              style={{ marginTop: 6 }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="spin-anim" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In as {activeRole.toUpperCase()}</span>
              )}
            </button>
          </form>
        ) : (
          /* Registration Form */
          <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>Full Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Alex Morgan"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>Email address</label>
              <input
                type="email"
                className="input-field"
                placeholder="alex@example.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#1A1A2E" }}>Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Create a strong password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={isLoading} style={{ marginTop: 8 }}>
              {isLoading ? <Loader2 size={18} className="spin-anim" /> : "Complete Registration"}
            </button>
          </form>
        )}

        {/* Google OAuth Section */}
        {!isRegister && (
          <>
            <div className="or-divider">
              <span>OR</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn btn-secondary btn-lg"
              disabled={isLoading}
              style={{ width: "100%" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </>
        )}

        {/* Footer Registration Toggle */}
        <div style={{ textAlign: "center", fontSize: 13, color: "#6F7280", marginTop: 4 }}>
          {isRegister ? (
            <span>
              Already registered?{" "}
              <button
                type="button"
                onClick={() => setAuthView("patient-login")}
                style={{ background: "none", border: "none", color: "#2E7D62", fontWeight: 600, cursor: "pointer" }}
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              New to SentiMed?{" "}
              <button
                type="button"
                onClick={() => setAuthView("patient-register")}
                style={{ background: "none", border: "none", color: "#2E7D62", fontWeight: 600, cursor: "pointer" }}
              >
                Create an account
              </button>
            </span>
          )}
        </div>

      </div>

      <div style={{ fontSize: 12, color: "#6F7280", textAlign: "center" }}>
        Protected by SentiMed HIPAA-compliant sandbox encryption standards.
      </div>

    </div>
  );
}

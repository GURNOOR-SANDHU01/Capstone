import { useState, useEffect } from "react";
import PatientPortal from "./components/PatientPortal";
import ClinicianPortal from "./components/ClinicianPortal";
import NotificationSimulator from "./components/NotificationSimulator";
import AuthPortal from "./components/AuthPortal";
import { onAuthStateChange, logoutUser } from "./services/firebase";
import "./App.css";

// Shared initial state
const INITIAL_ENTRIES = [
  {
    id: 1,
    date: "Today, 9:41 AM",
    mood: "Calm",
    moodEmoji: "😌",
    text: "Woke up feeling surprisingly clear-headed despite the rough week. Did a short walk and noticed how the morning light filtered through the trees. It helped quiet my thoughts.",
    tags: ["morning", "nature"],
    sentiment: 72,
    multimodal: { text: 72, voice: 68, video: 75 },
    reflection: "Focusing on physical sensations in the morning helped prevent my mind from racing about the day's to-do list."
  },
  {
    id: 2,
    date: "Yesterday, 11:20 PM",
    mood: "Anxious",
    moodEmoji: "😰",
    text: "Can't stop thinking about the clinician presentation tomorrow. My chest feels tight. I keep running the worst-case scenarios in my head, worrying I will stumble over my words.",
    tags: ["work", "stress"],
    sentiment: 28,
    multimodal: { text: 25, voice: 30, video: 30 },
    reflection: "I recognized that my thoughts are running worst-case scenarios. Realistically, I am prepared and a few stumbles are normal."
  },
  {
    id: 3,
    date: "May 21, 8:05 PM",
    mood: "Joyful",
    moodEmoji: "😄",
    text: "Had dinner with the whole family. Laughed more than I have in months. These are the moments I want to hold on to. Grateful for their support.",
    tags: ["family", "connection"],
    sentiment: 91,
    multimodal: { text: 92, voice: 88, video: 94 },
    reflection: "Making intentional time for family dinners directly boosts my sense of connection and grounding."
  }
];

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [currentView, setCurrentView] = useState("patient"); // patient, clinician
  const [entries, setEntries] = useState(INITIAL_ENTRIES);
  const [wearableConnected, setWearableConnected] = useState(true);
  
  // Slide-down notifications state
  const [activeAlert, setActiveAlert] = useState(null);

  // Subscribe to Firebase / Sandbox Auth updates
  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setCurrentUser(user);
      if (user) {
        // Enforce role-based routing
        setCurrentView(user.role || "patient");
      }
      setAuthInitialized(true);
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  // Close alert after delay
  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  const handleTriggerNotification = (title, message) => {
    const newAlert = { id: Date.now(), title, message };
    setActiveAlert(newAlert);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      handleTriggerNotification("🔒 Session Terminated", "Signed out securely from clinical workspace.");
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  if (!authInitialized) {
    return (
      <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#1A1A2E", color: "#fff" }}>
        <div style={{ fontSize: 44, animation: "pulse 1.2s infinite" }}>🍃</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, marginTop: 12, fontSize: 20 }}>SentiMed Secure Core</h2>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>Calibrating HIPAA compliance credentials...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="hub-container" style={{ background: "radial-gradient(circle at 10% 20%, rgba(26,26,46,0.06) 0%, rgba(76,175,145,0.03) 90.1%), #FAF9F6" }}>
        <header style={{
          background: "var(--indigo-primary)",
          color: "#fff",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: 58,
          zIndex: 100
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
              Senti<span style={{ color: "var(--teal-primary)" }}>Med</span>
            </div>
            <span style={{ fontSize: 10, background: "rgba(255, 255, 255, 0.1)", padding: "2px 8px", borderRadius: 12, color: "var(--teal-primary)", fontWeight: 700 }}>
              COMPLIANT SANDBOX
            </span>
          </div>
        </header>
        <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <AuthPortal 
            onAuthSuccess={(user) => {
              setCurrentUser(user);
              setCurrentView(user.role || "patient");
            }}
            onNotification={handleTriggerNotification}
          />
        </main>
        <footer style={{ background: "#fff", borderTop: "1px solid var(--border-light)", padding: "12px 24px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          SentiMed Sandbox Authentication Portal. HIPAA standards active.
        </footer>
      </div>
    );
  }

  return (
    <div className="hub-container">
      
      {/* Top Main Hub Switcher Navigation */}
      <header style={{
        background: "var(--indigo-primary)",
        color: "#fff",
        padding: "14px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "var(--shadow-md)",
        height: 58,
        zIndex: 100,
        flexShrink: 0
      }}>
        {/* Logo and compliance tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
            Senti<span style={{ color: "var(--teal-primary)" }}>Med</span>
          </div>
          <span style={{
            fontSize: 10,
            background: "rgba(255, 255, 255, 0.1)",
            padding: "2px 8px",
            borderRadius: 12,
            color: "var(--teal-primary)",
            fontWeight: 700,
            letterSpacing: "0.5px"
          }}>
            SECURED PORTAL
          </span>
        </div>

        {/* Swaps between Patient and Clinician View */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          
          {/* Dashboard Title */}
          <span style={{ fontSize: 12, color: "var(--teal-primary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {currentUser.role === "clinician" ? "🩺 Care Coordinator Workspace" : "👤 Personal Care Dashboard"}
          </span>

          <button
            onClick={handleLogout}
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              background: "none",
              color: "#fff",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            className="btn-hover"
          >
            Sign Out
          </button>
        </div>

        {/* Right side helper info */}
        <div style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.6)", fontWeight: 500 }}>
          User: <strong>{currentUser.profile?.name || currentUser.email}</strong>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        
        {currentView === "patient" ? (
          <PatientPortal
            entries={entries}
            setEntries={setEntries}
            onNotification={handleTriggerNotification}
            wearableConnected={wearableConnected}
            setWearableConnected={setWearableConnected}
            currentUser={currentUser}
          />
        ) : (
          <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
            <ClinicianPortal
              patientEntries={entries}
              onNotification={handleTriggerNotification}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* Floating macOS-Style Desktop Notification Toast (Top Right) */}
        {activeAlert && (
          <div
            className="slide-up-anim"
            style={{
              position: "fixed",
              top: 74,
              right: 24,
              width: 340,
              background: "rgba(28, 28, 30, 0.95)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: "16px",
              color: "#fff",
              boxShadow: "var(--shadow-lg)",
              zIndex: 9999,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, opacity: 0.7, fontWeight: 700, textTransform: "uppercase" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>🍃</span>
                <span>SentiMed System</span>
              </div>
              <span>just now</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{activeAlert.title}</div>
            <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>{activeAlert.message}</div>
          </div>
        )}

        {/* Floating Simulation Center (Bottom Right) */}
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9998,
          pointerEvents: "none"
        }}>
          <NotificationSimulator triggerNotification={handleTriggerNotification} />
        </div>

      </div>
    </div>
  );
}

export default App;

import { useState, useEffect } from "react";
import AppShell from "./components/AppShell";
import SentiMedLoader from "./components/SentiMedLoader";
import DashboardView from "./components/views/DashboardView";
import JournalView from "./components/views/JournalView";
import InsightsView from "./components/views/InsightsView";
import CompanionView from "./components/views/CompanionView";
import ProfileView from "./components/views/ProfileView";
import AuthPortal from "./components/AuthPortal";

import PiiMaskingView from "./components/privacy/PiiMaskingView";

import PatientOnboardingWizard from "./components/patient/PatientOnboardingWizard";
import PatientSafetyView from "./components/patient/PatientSafetyView";
import DoctorSafetyCenterView from "./components/doctor/DoctorSafetyCenterView";
import AdminSafetyCenterView from "./components/admin/AdminSafetyCenterView";

import { 
  PatientAppointmentsView, 
  PatientConsultationsView,
  PatientRemindersView, 
  PatientHistoryView 
} from "./components/patient/PatientPortalViews";

import { 
  DoctorDashboardView, 
  DoctorSharedJournalsView, 
  DoctorRemindersView, 
  DoctorMessagingView,
  DoctorAppointmentsView,
  DoctorConsultationsView
} from "./components/doctor/DoctorPortalViews";

import { 
  AdminDashboardView, 
  AdminDoctorMgmtView, 
  AdminClinicMgmtView, 
  AdminAuditLogsView 
} from "./components/admin/AdminPortalViews";

import { ROLES } from "./constants/roles";
import { getJournalEntries } from "./services/journalService";
import { useAuth } from "./hooks/useAuth";
import { useProfileCompletion } from "./hooks/useProfileCompletion";
import "./App.css";

function App() {
  const { currentUser, setCurrentUser, authInitialized, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Safety Alert State
  const [urgentSafetyAlert, setUrgentSafetyAlert] = useState(null);

  const [entries, setEntries] = useState(() => getJournalEntries());
  const [wearableConnected, setWearableConnected] = useState(true);
  const [activeAlert, setActiveAlert] = useState(null);

  // Authoritative Profile Completion evaluation
  const { isComplete, firstMissingStep } = useProfileCompletion(currentUser);

  // Set default tab on user authentication
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === ROLES.ADMIN) {
        setActiveTab("admin-dashboard");
      } else if (currentUser.role === ROLES.DOCTOR) {
        setActiveTab("doctor-dashboard");
      } else {
        setActiveTab("dashboard");
      }
    }
  }, [currentUser]);

  // Dismiss notification toast after delay
  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => {
        setActiveAlert(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  const handleTriggerNotification = (title, message) => {
    setActiveAlert({ id: Date.now(), title, message });
  };

  const handleLogout = async () => {
    try {
      await logout();
      handleTriggerNotification("Signed Out", "You have signed out from SentiMed.");
    } catch (e) {
      console.error("Sign out error:", e);
    }
  };

  // Engaging Initial Welcome Loading Experience
  if (!authInitialized) {
    return <SentiMedLoader variant="initial" />;
  }

  // Not logged in -> Show AuthPortal
  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column" }}>
        <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <AuthPortal
            onAuthSuccess={(user) => {
              setCurrentUser(user);
              if (user.role === ROLES.ADMIN) {
                setActiveTab("admin-dashboard");
              } else if (user.role === ROLES.DOCTOR) {
                setActiveTab("doctor-dashboard");
              } else {
                setActiveTab("dashboard");
              }
            }}
            onNotification={handleTriggerNotification}
          />
        </main>
      </div>
    );
  }

  const userRole = currentUser?.role || ROLES.PATIENT;

  // Render First-Time Patient Onboarding Wizard ONLY if profile is incomplete
  if (userRole === ROLES.PATIENT && !isComplete) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
        <PatientOnboardingWizard
          currentUser={currentUser}
          initialStep={firstMissingStep}
          onComplete={() => {
            setCurrentUser({ ...currentUser });
            handleTriggerNotification("Profile Completed", "Welcome to your SentiMed dashboard.");
          }}
          onTriggerUrgentSafety={(record) => {
            setCurrentUser({ ...currentUser });
            setUrgentSafetyAlert(record);
          }}
        />
      </div>
    );
  }

  // Logged in & Complete -> Show Role-Aware AppShell
  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={(tab) => {
        setActiveTab(tab);
      }}
      currentUser={currentUser}
      onLogout={handleLogout}
      onNotification={handleTriggerNotification}
    >
      {/* Urgent Safety Screen Modal */}
      {urgentSafetyAlert && (
        <PatientSafetyView
          onDismiss={() => setUrgentSafetyAlert(null)}
        />
      )}

      {/* PATIENT PORTAL ROUTES */}
      {userRole === ROLES.PATIENT && (
        <>
          {activeTab === "dashboard" && (
            <DashboardView
              entries={entries}
              onNavigate={(tab) => setActiveTab(tab)}
              currentUser={currentUser}
            />
          )}
          {activeTab === "companion" && (
            <CompanionView currentUser={currentUser} />
          )}
          {activeTab === "appointments" && (
            <PatientAppointmentsView
              onNotification={handleTriggerNotification}
            />
          )}
          {activeTab === "doctor-consultations" && (
            <PatientConsultationsView />
          )}
          {activeTab === "journal" && (
            <JournalView
              entries={entries}
              setEntries={setEntries}
              onNotification={handleTriggerNotification}
            />
          )}
          {activeTab === "insights" && <InsightsView entries={entries} />}
          {activeTab === "reminders" && <PatientRemindersView />}
          {activeTab === "history" && <PatientHistoryView />}
          {activeTab === "privacy-masking" && <PiiMaskingView />}
        </>
      )}

      {/* DOCTOR PORTAL ROUTES */}
      {userRole === ROLES.DOCTOR && (
        <>
          {(activeTab === "doctor-dashboard" || activeTab === "doctor-patients") && (
            <DoctorDashboardView
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === "doctor-safety" && (
            <DoctorSafetyCenterView
              onNotification={handleTriggerNotification}
            />
          )}
          {activeTab === "doctor-shared-journals" && <DoctorSharedJournalsView />}
          {activeTab === "doctor-appointments" && (
            <DoctorAppointmentsView
              onNotification={handleTriggerNotification}
            />
          )}
          {activeTab === "doctor-consultations" && (
            <DoctorConsultationsView />
          )}
          {activeTab === "doctor-reminders" && (
            <DoctorRemindersView onNotification={handleTriggerNotification} />
          )}
          {activeTab === "doctor-messaging" && <DoctorMessagingView />}
        </>
      )}

      {/* ADMIN PORTAL ROUTES */}
      {userRole === ROLES.ADMIN && (
        <>
          {activeTab === "admin-dashboard" && (
            <AdminDashboardView onNavigate={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === "admin-safety" && <AdminSafetyCenterView />}
          {activeTab === "admin-doctors" && (
            <AdminDoctorMgmtView onNotification={handleTriggerNotification} />
          )}
          {activeTab === "admin-clinics" && (
            <AdminClinicMgmtView onNotification={handleTriggerNotification} />
          )}
          {activeTab === "admin-audit" && <AdminAuditLogsView />}
        </>
      )}

      {/* SHARED ROUTES */}
      {activeTab === "profile" && (
        <ProfileView
          currentUser={currentUser}
          wearableConnected={wearableConnected}
          setWearableConnected={setWearableConnected}
          onNotification={handleTriggerNotification}
        />
      )}

      {/* Toast Notification Alert Banner */}
      {activeAlert && (
        <div
          className="slide-up-anim"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            maxWidth: 360,
            width: "100%",
            background: "#1A1A2E",
            color: "#FFFFFF",
            padding: "16px 20px",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>{activeAlert.title}</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{activeAlert.message}</div>
        </div>
      )}
    </AppShell>
  );
}

export default App;

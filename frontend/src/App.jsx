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
  PatientHistoryView,
  PatientMessagingView
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
import { useAuth } from "./hooks/useAuth";
import { useJournal } from "./hooks/useJournal";
import { useProfileCompletion } from "./hooks/useProfileCompletion";
import "./App.css";

function App() {
  const { currentUser, setCurrentUser, authInitialized, authError, logout } = useAuth();
  // Tab state is remembered per signed-in user; profile updates do not reset navigation
  const [tabState, setTabState] = useState({ uid: null, tab: null });

  // Safety Alert State
  const [urgentSafetyAlert, setUrgentSafetyAlert] = useState(null);

  const journal = useJournal(currentUser);
  const entries = journal.entries;
  const [wearableConnected, setWearableConnected] = useState(true);
  const [activeAlert, setActiveAlert] = useState(null);

  // Authoritative Profile Completion evaluation
  const { isComplete, firstMissingStep } = useProfileCompletion(currentUser);

  const defaultTabFor = (role) =>
    role === ROLES.ADMIN ? "admin-dashboard" : role === ROLES.DOCTOR ? "doctor-dashboard" : "dashboard";
  const activeTab =
    currentUser && tabState.uid === currentUser.uid && tabState.tab ? tabState.tab : defaultTabFor(currentUser?.role);
  const setActiveTab = (tab) => setTabState({ uid: currentUser?.uid ?? null, tab });

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
            key={authError || "auth"}
            initialError={authError}
            onAuthSuccess={(user) => {
              setCurrentUser(user);
              setTabState({ uid: user.uid, tab: defaultTabFor(user.role) });
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
          onComplete={(record) => {
            setCurrentUser(record?.user || { ...currentUser });
            handleTriggerNotification("Profile Completed", "Welcome to your SentiMed dashboard.");
          }}
          onTriggerUrgentSafety={(record) => {
            setCurrentUser(record?.user || { ...currentUser });
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
              loading={journal.loading}
              error={journal.error}
              onReload={journal.reload}
              onAdd={journal.addEntry}
              onDelete={journal.removeEntry}
              onSetVisibility={journal.setVisibility}
              onEdit={journal.editEntry}
              onNotification={handleTriggerNotification}
            />
          )}
          {activeTab === "insights" && <InsightsView entries={entries} onNotification={handleTriggerNotification} />}
          {activeTab === "reminders" && <PatientRemindersView />}
          {activeTab === "messages" && <PatientMessagingView onNotification={handleTriggerNotification} />}
          {activeTab === "history" && <PatientHistoryView entries={entries} />}
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
          {activeTab === "doctor-messaging" && <DoctorMessagingView onNotification={handleTriggerNotification} />}
        </>
      )}

      {/* ADMIN PORTAL ROUTES */}
      {userRole === ROLES.ADMIN && (
        <>
          {activeTab === "admin-dashboard" && (
            <AdminDashboardView onNavigate={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === "admin-safety" && <AdminSafetyCenterView onNotification={handleTriggerNotification} />}
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
          onProfileUpdated={setCurrentUser}
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

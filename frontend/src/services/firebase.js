import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateAuthProfile,
  signOut,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { api } from "./apiClient";
import { clearDrafts } from "../hooks/useDraftState";

// Read Firebase configuration from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Optional: point Firebase Auth at the local emulator (e.g. "127.0.0.1:9099") for end-to-end tests
const authEmulatorHost = import.meta.env?.VITE_FIREBASE_AUTH_EMULATOR_HOST || "";

// Real Firebase is active ONLY if explicit VITE_FIREBASE_API_KEY is provided and forceSandbox is false
const isRealConfigured =
  Boolean(firebaseConfig.apiKey) &&
  firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
  firebaseConfig.apiKey.trim() !== "";

let forceSandbox = false;
try {
  forceSandbox = localStorage.getItem("sentimed_force_sandbox") === "true";
} catch (err) {
  console.warn("Sandbox state not readable:", err);
}

/**
 * Live mode: Firebase Authentication in the browser + all data through the Express API.
 * Sandbox mode: offline demo with localStorage-only data (no backend, no Firebase).
 */
export const isRealFirebaseConfigured = isRealConfigured && !forceSandbox;

export const setForceSandbox = (val) => {
  try {
    localStorage.setItem("sentimed_force_sandbox", val ? "true" : "false");
  } catch (err) {
    console.warn("Sandbox state not writable:", err);
  }
  window.location.reload();
};

export let app = null;
export let auth = null;
export let googleProvider = null;

if (isRealFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    if (authEmulatorHost) {
      connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
    }
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.warn("Firebase initialization failed; falling back to Sandbox mode:", error);
  }
}

// Lazy Analytics Initialization (Non-blocking, never against the emulator)
export const initAnalyticsLazy = () => {
  if (isRealFirebaseConfigured && app && !authEmulatorHost && firebaseConfig.measurementId && typeof window !== "undefined") {
    try {
      getAnalytics(app);
    } catch (err) {
      console.debug("Analytics unavailable:", err?.message);
    }
  }
};

/* ------------------------------------------------------------------ */
/* Live mode: profile + role come from the backend, never from the UI */
/* ------------------------------------------------------------------ */

const ONBOARDING_SECTION_MAP = {
  basic_info: "basicInfo",
  emergency_contact: "emergencyContact",
  wellness_screening: "wellnessScreening",
  safety_screening: "safetyScreening",
  privacy_consent: "privacyConsent"
};

/**
 * Converts the backend profile (GET /api/users/me) into the user object the UI already uses:
 * { uid, email, role, profile: { name, mobile, emergencyContact, completionState, ... } }.
 * `role` is the verified custom claim returned by the backend.
 */
export const toAppUser = (firebaseUser, backendProfile) => {
  const p = backendProfile || {};
  const onboarding = p.onboarding || {};
  const sections = {};
  Object.entries(ONBOARDING_SECTION_MAP).forEach(([snake, camel]) => {
    sections[camel] = Boolean(onboarding.sections?.[snake]);
  });
  if (!onboarding.sections) {
    // Profiles created before onboarding existed: infer what is already present
    sections.basicInfo = Boolean(p.full_name && p.phone);
    sections.emergencyContact = Boolean(p.emergency_contact?.name && p.emergency_contact?.phone);
  }

  return {
    uid: firebaseUser?.uid || p.id,
    email: firebaseUser?.email || p.email || "",
    role: p.role || "patient",
    profile: {
      ...p,
      name: p.full_name || firebaseUser?.displayName || "",
      mobile: p.phone || "",
      emergencyContact: p.emergency_contact || null,
      completionState: {
        profileCompleted: Boolean(onboarding.completed),
        sections
      }
    }
  };
};

/**
 * Explicit sign-in / sign-up flows are authoritative. Creating an account fires the auth
 * listener immediately, and its profile fetch can finish after the sign-up flow has saved the
 * name and phone; without this guard that older snapshot would overwrite the newer user.
 * Every flow bumps `authSequence`; listener results from an older sequence are dropped.
 */
let authSequence = 0;
let explicitFlows = 0;

async function explicitAuthFlow(run) {
  authSequence += 1;
  explicitFlows += 1;
  try {
    return await run();
  } finally {
    explicitFlows -= 1;
  }
}

export const fetchAppUser = async (firebaseUser = auth?.currentUser) => {
  const { data } = await api.get("/users/me");
  return toAppUser(firebaseUser, data);
};

// Mock Database & Auth State
const listeners = new Set();
let currentUserInstance = (() => {
  try {
    const saved = localStorage.getItem("sentimed_current_user");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
})();

const notifyListeners = (user) => {
  listeners.forEach(cb => cb(user));
};

const getMockUsers = () => {
  try {
    const users = localStorage.getItem("sentimed_mock_users");
    return users ? JSON.parse(users) : {};
  } catch {
    return {};
  }
};

const saveMockUser = (email, userData) => {
  const users = getMockUsers();
  users[email.toLowerCase()] = userData;
  try {
    localStorage.setItem("sentimed_mock_users", JSON.stringify(users));
  } catch (err) {
    console.warn("Mock user not persisted:", err);
  }
};

/** Sandbox only: persists the in-memory demo user after local profile changes. */
export const saveSandboxUser = (user) => {
  currentUserInstance = user;
  try {
    localStorage.setItem("sentimed_current_user", JSON.stringify(user));
  } catch (err) {
    console.warn("Sandbox user not persisted:", err);
  }
};

/**
 * Register auth state listener.
 * Live mode reports { user } on success, or { error } when the backend profile cannot be loaded.
 */
export const onAuthStateChange = (callback, onError = () => {}) => {
  if (isRealFirebaseConfigured && auth) {
    return auth.onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        callback(null);
        return;
      }
      if (explicitFlows > 0) return; // the sign-in/sign-up flow reports the user itself
      const sequence = authSequence;
      try {
        const user = await fetchAppUser(firebaseUser);
        if (sequence !== authSequence || explicitFlows > 0) return; // superseded by a newer flow
        callback(user);
        initAnalyticsLazy();
      } catch (e) {
        if (sequence !== authSequence) return;
        console.warn("Signed in, but the backend profile could not be loaded:", e);
        onError(e);
        callback(null);
      }
    });
  }

  // Sandbox Mode: Immediately register listener and notify state without delay
  listeners.add(callback);
  Promise.resolve().then(() => {
    callback(currentUserInstance);
  });
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Sign In User. In live mode the portal tab the user chose (expectedRole) is only a hint;
 * the role always comes from the backend.
 */
export const loginUser = async (email, password, expectedRole = "patient") => {
  if (isRealFirebaseConfigured && auth) {
    return explicitAuthFlow(async () => {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return fetchAppUser(userCredential.user);
    });
  } else {
    // Sandbox Mode with realistic mock completion profiles
    return new Promise((resolve) => {
      setTimeout(() => {
        const users = getMockUsers();
        const existing = users[email.toLowerCase()];

        if (existing && existing.password === password) {
          currentUserInstance = { ...existing.profile, role: expectedRole };
          localStorage.setItem("sentimed_current_user", JSON.stringify(currentUserInstance));
          notifyListeners(currentUserInstance);
          resolve(currentUserInstance);
          return;
        }

        // Demo profile setup:
        // 'demo@example.com' -> Complete profile (Bypasses onboarding)
        // 'new.patient@example.com' -> Incomplete profile (Full onboarding)
        // 'partial.patient@example.com' -> Partially incomplete profile (Missing emergency contact)
        const isNewPatientDemo = email.toLowerCase().includes("new");
        const isPartialDemo = email.toLowerCase().includes("partial");

        const completionState = (expectedRole === "patient" && (isNewPatientDemo || isPartialDemo))
          ? {
              profileCompleted: false,
              sections: {
                basicInfo: !isNewPatientDemo,
                emergencyContact: false,
                wellnessScreening: !isNewPatientDemo,
                safetyScreening: !isNewPatientDemo,
                privacyConsent: !isNewPatientDemo
              }
            }
          : {
              profileCompleted: true,
              sections: {
                basicInfo: true,
                emergencyContact: true,
                wellnessScreening: true,
                safetyScreening: true,
                privacyConsent: true
              }
            };

        const demoUser = {
          uid: "demo-user-" + Date.now(),
          email,
          role: expectedRole,
          profile: {
            name: email.split("@")[0] || "Demo User",
            mobile: "+1 (555) 234-5678",
            emergencyContact: isPartialDemo || isNewPatientDemo ? null : { name: "Jane Sandhu", phone: "+1 (555) 987-6543" },
            completionState
          }
        };

        currentUserInstance = demoUser;
        localStorage.setItem("sentimed_current_user", JSON.stringify(demoUser));
        notifyListeners(demoUser);
        resolve(demoUser);
      }, 200);
    });
  }
};

/**
 * Sign Up Patient (Starts with incomplete profile).
 * Live mode: creates the Firebase Auth account, then the backend creates the profile
 * (role is always patient; privileged roles are granted only by an admin).
 */
export const signUpPatient = async (email, password, profileDetails) => {
  const initialCompletion = {
    profileCompleted: false,
    sections: {
      basicInfo: true,
      emergencyContact: false,
      wellnessScreening: false,
      safetyScreening: false,
      privacyConsent: false
    }
  };

  if (isRealFirebaseConfigured && auth) {
    return explicitAuthFlow(async () => {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (profileDetails?.name) {
        await updateAuthProfile(userCredential.user, { displayName: profileDetails.name });
      }
      await api.get("/users/me"); // initializes the profile on the backend
      const updates = {};
      if (profileDetails?.name) updates.full_name = profileDetails.name;
      if (profileDetails?.mobile) updates.phone = profileDetails.mobile;
      const { data } = Object.keys(updates).length ? await api.patch("/users/me", updates) : await api.get("/users/me");
      return toAppUser(userCredential.user, data);
    });
  } else {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockUid = "mock-uid-" + Date.now();
        const profile = {
          uid: mockUid,
          email,
          role: "patient",
          profile: {
            ...profileDetails,
            completionState: initialCompletion
          }
        };

        saveMockUser(email, { password, profile });
        currentUserInstance = profile;
        localStorage.setItem("sentimed_current_user", JSON.stringify(profile));
        notifyListeners(profile);
        resolve(profile);
      }, 200);
    });
  }
};

/**
 * Google Sign In
 */
export const loginWithGoogle = async (role = "patient") => {
  if (isRealFirebaseConfigured && auth && googleProvider) {
    return explicitAuthFlow(async () => {
      const result = await signInWithPopup(auth, googleProvider);
      return fetchAppUser(result.user);
    });
  } else {
    return new Promise((resolve) => {
      setTimeout(() => {
        const googleUser = {
          uid: "google-mock-" + Date.now(),
          email: "google.user@example.com",
          role,
          profile: {
            name: "Google Demo User",
            completionState: {
              profileCompleted: true,
              sections: { basicInfo: true, emergencyContact: true, wellnessScreening: true, safetyScreening: true, privacyConsent: true }
            }
          }
        };
        currentUserInstance = googleUser;
        localStorage.setItem("sentimed_current_user", JSON.stringify(googleUser));
        notifyListeners(googleUser);
        resolve(googleUser);
      }, 200);
    });
  }
};

/**
 * Sign Out User
 */
export const logoutUser = async () => {
  clearDrafts(); // unsaved journal/companion text must not be visible to the next user
  if (isRealFirebaseConfigured && auth) {
    await signOut(auth);
  }
  currentUserInstance = null;
  localStorage.removeItem("sentimed_current_user");
  notifyListeners(null);
};

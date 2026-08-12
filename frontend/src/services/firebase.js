import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from "firebase/firestore";

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
export let db = null;
export let googleProvider = null;

if (isRealFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.warn("Firebase initialization failed; falling back to Sandbox mode:", error);
  }
}

// Lazy Analytics Initialization (Non-blocking)
export const initAnalyticsLazy = () => {
  if (isRealFirebaseConfigured && app && typeof window !== "undefined") {
    try {
      getAnalytics(app);
    } catch {}
  }
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
  } catch {}
};

/**
 * Register auth state listener with non-blocking execution.
 */
export const onAuthStateChange = (callback) => {
  if (isRealFirebaseConfigured && auth) {
    try {
      return auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const docRef = doc(db, "users", firebaseUser.uid);
            const docSnap = await Promise.race([
              getDoc(docRef),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore timeout")), 2500))
            ]);

            if (docSnap && docSnap.exists()) {
              callback({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: docSnap.data().role || "patient",
                profile: docSnap.data()
              });
              initAnalyticsLazy();
              return;
            }
          } catch (e) {
            console.warn("Firestore profile fetch timed out or failed, using Auth defaults:", e);
          }

          callback({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: "patient",
            profile: { name: firebaseUser.displayName || "Patient User" }
          });
          initAnalyticsLazy();
        } else {
          callback(null);
        }
      });
    } catch (err) {
      console.error("Firebase auth listener error, falling back to Sandbox:", err);
      callback(currentUserInstance);
      return () => {};
    }
  } else {
    // Sandbox Mode: Immediately register listener and notify state without delay
    listeners.add(callback);
    Promise.resolve().then(() => {
      callback(currentUserInstance);
    });
    return () => {
      listeners.delete(callback);
    };
  }
};

/**
 * Sign In User with structured profile completion states
 */
export const loginUser = async (email, password, expectedRole = "patient") => {
  if (isRealFirebaseConfigured && auth) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    let role = expectedRole;
    let profile = { name: user.displayName || email.split("@")[0] };

    try {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        role = docSnap.data().role || expectedRole;
        profile = docSnap.data();
      }
    } catch (e) {
      console.warn("Firestore profile fetch failed during login:", e);
    }

    return { uid: user.uid, email: user.email, role, profile };
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
 * Sign Up Patient (Starts with incomplete profile)
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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const docData = {
      uid: user.uid,
      email: user.email,
      role: "patient",
      createdAt: new Date().toISOString(),
      completionState: initialCompletion,
      ...profileDetails
    };
    try {
      await setDoc(doc(db, "users", user.uid), docData);
    } catch (e) {
      console.warn("Failed to write Firestore profile doc:", e);
    }
    return { uid: user.uid, email: user.email, role: "patient", profile: docData };
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
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return { uid: user.uid, email: user.email, role, profile: { name: user.displayName } };
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
  if (isRealFirebaseConfigured && auth) {
    await signOut(auth);
  }
  currentUserInstance = null;
  localStorage.removeItem("sentimed_current_user");
  notifyListeners(null);
};

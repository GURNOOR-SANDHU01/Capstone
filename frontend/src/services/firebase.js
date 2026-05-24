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

// Read Firebase keys with user provided fallbacks
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyBsip2kJaV2tk3C8RQET706Gvi7axx8c18",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "sentimed-febc4.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "sentimed-febc4",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "sentimed-febc4.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "551957745505",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:551957745505:web:2284fd3975f97300677f20",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-F9R15BQX2Z"
};

const isRealConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY" &&
  firebaseConfig.apiKey.trim() !== "";

let forceSandbox = false;
try {
  forceSandbox = localStorage.getItem("sentimed_force_sandbox") === "true";
} catch (err) {
  console.log("Sandbox state not readable:", err);
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
export let analytics = null;

if (isRealFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    if (typeof window !== "undefined") {
      analytics = getAnalytics(app);
    }
  } catch (error) {
    console.warn("Firebase initialization failed, falling back to Sandbox simulation:", error);
  }
}

// =========================================================
// MOCK DATABASE & AUTH IMPLEMENTATION (LOCAL STORAGE)
// =========================================================
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

// Helper for local mock users DB
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
  localStorage.setItem("sentimed_mock_users", JSON.stringify(users));
};

// =========================================================
// PUBLIC API EXPORTS (SUPPORTING BOTH REAL FIREBASE & MOCK)
// =========================================================

/**
 * Register auth state listener
 */
export const onAuthStateChange = (callback) => {
  if (isRealFirebaseConfigured && auth) {
    // Wrap real firebase subscription
    return auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch additional details from firestore
        try {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            callback({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: docSnap.data().role || "patient",
              profile: docSnap.data()
            });
            return;
          }
        } catch (e) {
          console.error("Error loading Firestore profile:", e);
        }
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: "patient",
          profile: { name: firebaseUser.displayName || "Patient User" }
        });
      } else {
        callback(null);
      }
    });
  } else {
    // Sandbox Simulation
    listeners.add(callback);
    callback(currentUserInstance);
    return () => {
      listeners.delete(callback);
    };
  }
};

/**
 * Sign Up Patient with details
 */
export const signUpPatient = async (email, password, profileDetails) => {
  if (isRealFirebaseConfigured && auth) {
    // Real Firebase implementation
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Save details in firestore
    const docData = {
      uid: user.uid,
      email: user.email,
      role: "patient",
      createdAt: new Date().toISOString(),
      ...profileDetails
    };
    await setDoc(doc(db, "users", user.uid), docData);
    return { uid: user.uid, email: user.email, role: "patient", profile: docData };
  } else {
    // Sandbox Simulation
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = getMockUsers();
        if (users[email.toLowerCase()]) {
          reject(new Error("This email is already registered in SentiMed."));
          return;
        }

        const mockUid = "mock-uid-" + Date.now();
        const profile = {
          uid: mockUid,
          email,
          role: "patient",
          ...profileDetails
        };

        saveMockUser(email, { password, profile });
        
        currentUserInstance = profile;
        localStorage.setItem("sentimed_current_user", JSON.stringify(profile));
        notifyListeners(profile);
        
        resolve(profile);
      }, 1000);
    });
  }
};

/**
 * Sign In User (Email / Password)
 */
export const loginUser = async (email, password, role = "patient") => {
  if (isRealFirebaseConfigured && auth) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Load profile
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.role !== role) {
        await signOut(auth);
        throw new Error(`Role mismatch. Selected role is ${role}, but user is registered as ${data.role || "patient"}.`);
      }
      return { uid: user.uid, email: user.email, role: data.role, profile: data };
    }
    return { uid: user.uid, email: user.email, role: "patient", profile: { name: user.displayName || "User" } };
  } else {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = getMockUsers();
        const foundUser = users[email.toLowerCase()];
        
        // Clinician fallback validation
        if (role === "clinician" && email === "clinician@sentimed.com" && password === "1234") {
          const profile = {
            uid: "mock-clinician-id",
            email: "clinician@sentimed.com",
            role: "clinician",
            name: "Dr. Sandhu",
            license: "PSY-9829"
          };
          currentUserInstance = profile;
          localStorage.setItem("sentimed_current_user", JSON.stringify(profile));
          notifyListeners(profile);
          resolve(profile);
          return;
        }

        if (!foundUser) {
          reject(new Error("Email not found. Register a new account first."));
          return;
        }

        if (foundUser.password !== password) {
          reject(new Error("Incorrect password details."));
          return;
        }

        if (foundUser.profile.role !== role) {
          reject(new Error(`Role mismatch. Account is registered as ${foundUser.profile.role}.`));
          return;
        }

        const profile = foundUser.profile;
        currentUserInstance = profile;
        localStorage.setItem("sentimed_current_user", JSON.stringify(profile));
        notifyListeners(profile);
        resolve(profile);
      }, 1000);
    });
  }
};

/**
 * Login with Google
 */
export const loginWithGoogle = async (role = "patient") => {
  if (isRealFirebaseConfigured && auth && googleProvider) {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user document exists in firestore
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { uid: user.uid, email: user.email, role: data.role || "patient", profile: data };
    } else {
      // First-time signup via Google -> create default profile (requires redirecting to intake form or saving base data)
      const defaultProfile = {
        uid: user.uid,
        email: user.email,
        role,
        name: user.displayName || "Google User",
        mobile: "",
        emergencyContacts: [
          { name: "", phone: "" },
          { name: "", phone: "" }
        ],
        emergencyEmail: "",
        medicalIssue: false,
        medicalIssueText: "",
        ongoingTreatment: false,
        ongoingTreatmentText: ""
      };
      await setDoc(docRef, defaultProfile);
      return { uid: user.uid, email: user.email, role, profile: defaultProfile };
    }
  } else {
    // Sandbox Google Login simulator
    return new Promise((resolve) => {
      // Create a popup window simulation
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        "",
        "Google Authentication Sandbox",
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      if (popup) {
        popup.document.write(`
          <html>
            <head>
              <title>Sign in - Google Accounts</title>
              <style>
                body { font-family: -apple-system, sans-serif; background: #fff; margin: 0; padding: 40px 24px; text-align: center; }
                .logo { font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #4285f4; }
                .title { font-size: 20px; font-weight: 500; margin-bottom: 24px; }
                .account-box { border: 1px solid #dadce0; border-radius: 8px; padding: 16px; margin: 8px 0; cursor: pointer; text-align: left; transition: background 0.15s; }
                .account-box:hover { background: #f8f9fa; }
                .name { font-weight: 600; font-size: 14px; color: #3c4043; }
                .email { font-size: 12px; color: #5f6368; }
                .footer { font-size: 11px; color: #5f6368; margin-top: 40px; }
              </style>
            </head>
            <body>
              <div class="logo">Google</div>
              <div class="title">Choose an account to continue to SentiMed</div>
              
              <div class="account-box" onclick="selectAccount('Gurnoor Sandhu', 'gurnoor.sandhu@google.com')">
                <div class="name">Gurnoor Sandhu</div>
                <div class="email">gurnoor.sandhu@google.com</div>
              </div>
              
              <div class="account-box" onclick="selectAccount('Dr. Noorsandhu', 'clinician@sentimed.com')">
                <div class="name">Dr. Noorsandhu (Clinician)</div>
                <div class="email">clinician@sentimed.com</div>
              </div>

              <p style="font-size:12px;color:#888;">Select an account to auto-populate credentials in the sandbox.</p>
              
              <div class="footer">
                To continue, Google will share your name, email address, and profile picture with SentiMed.
              </div>

              <script>
                function selectAccount(name, email) {
                  window.opener.postMessage({
                    type: 'GOOGLE_AUTH_SUCCESS',
                    name: name,
                    email: email
                  }, '*');
                  window.close();
                }
              </script>
            </body>
          </html>
        `);
      }

      // Listen for popup message
      const messageListener = (event) => {
        if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          window.removeEventListener('message', messageListener);
          
          const email = event.data.email;
          const name = event.data.name;
          const isClinician = email === "clinician@sentimed.com";

          const profile = {
            uid: isClinician ? "mock-clinician-id" : "mock-google-uid-" + Date.now(),
            email,
            role: isClinician ? "clinician" : role,
            name,
            mobile: isClinician ? "" : "+1 555-019-2834",
            emergencyContacts: isClinician ? [] : [
              { name: "Sarah Sandhu", phone: "555-010-9898" },
              { name: "David Sandhu", phone: "555-010-9899" }
            ],
            emergencyEmail: isClinician ? "" : "emergency@sandhu.org",
            medicalIssue: false,
            medicalIssueText: "",
            ongoingTreatment: false,
            ongoingTreatmentText: "",
            license: isClinician ? "PSY-9829" : undefined
          };

          currentUserInstance = profile;
          localStorage.setItem("sentimed_current_user", JSON.stringify(profile));
          notifyListeners(profile);
          resolve(profile);
        }
      };

      window.addEventListener('message', messageListener);
    });
  }
};

/**
 * Sign Out User
 */
export const logoutUser = async () => {
  if (isRealFirebaseConfigured && auth) {
    await signOut(auth);
  } else {
    currentUserInstance = null;
    localStorage.removeItem("sentimed_current_user");
    notifyListeners(null);
  }
};

/**
 * Google Fit OAuth 2.0 (browser token flow via Google Identity Services).
 *
 * The client ID comes from VITE_GOOGLE_FIT_CLIENT_ID (frontend/.env.local). The access token is
 * kept in memory only and is dropped when the Firebase user signs out or changes.
 */
import { auth } from "../firebase";

export const GOOGLE_FIT_SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read"
];

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const CLIENT_ID = (import.meta.env?.VITE_GOOGLE_FIT_CLIENT_ID || "").trim();
const EXPIRY_MARGIN_MS = 60 * 1000;

let gisLoading = null;
let tokenState = null; // { accessToken, expiresAt, grantedScopes, uid }

export const isGoogleFitConfigured = Boolean(CLIENT_ID);

// Drop the Fit token whenever the signed-in Firebase user changes
if (auth) {
  auth.onAuthStateChanged((user) => {
    if (!user || (tokenState && tokenState.uid !== user.uid)) tokenState = null;
  });
}

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Could not load Google sign-in. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/** Returns the current access token if it is still valid for the signed-in user, else null. */
export function getCachedAccessToken() {
  const uid = auth?.currentUser?.uid;
  if (!tokenState || !uid || tokenState.uid !== uid) return null;
  if (Date.now() >= tokenState.expiresAt - EXPIRY_MARGIN_MS) return null;
  return tokenState;
}

/**
 * Opens the Google consent popup and resolves with { accessToken, expiresAt, grantedScopes }.
 * Must be called from a user gesture (e.g. a "Connect Google Fit" button click) or the
 * browser will block the popup.
 */
export async function connectGoogleFit({ forceConsent = false } = {}) {
  if (!CLIENT_ID) {
    throw new Error("Google Fit is not configured. Set VITE_GOOGLE_FIT_CLIENT_ID in frontend/.env.local.");
  }
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in before connecting Google Fit.");

  const cached = getCachedAccessToken();
  if (cached && !forceConsent) return cached;

  await loadGis();
  const oauth2 = window.google.accounts.oauth2;

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: GOOGLE_FIT_SCOPES.join(" "),
      include_granted_scopes: true,
      login_hint: user.email || undefined,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || `Google authorization failed (${response.error}).`));
          return;
        }
        // With granular consent the user may untick some scopes; keep only what was granted
        const grantedScopes = GOOGLE_FIT_SCOPES.filter((s) => oauth2.hasGrantedAnyScope(response, s));
        if (grantedScopes.length === 0) {
          reject(new Error("No Google Fit permissions were granted."));
          return;
        }
        tokenState = {
          accessToken: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
          grantedScopes,
          uid: user.uid
        };
        resolve(tokenState);
      },
      error_callback: (err) => {
        const message = err?.type === "popup_closed"
          ? "The Google sign-in window was closed before permission was granted."
          : err?.type === "popup_failed_to_open"
            ? "The Google sign-in window was blocked. Allow pop-ups for this site and try again."
            : err?.message || "Google authorization failed.";
        reject(new Error(message));
      }
    });
    client.requestAccessToken({ prompt: forceConsent ? "consent" : "" });
  });
}

/** Forgets the token locally (call disconnectGoogleFit to also revoke it at Google). */
export function clearGoogleFitToken() {
  tokenState = null;
}

/** Revokes the app's Google Fit access for this user. */
export async function disconnectGoogleFit() {
  const token = tokenState?.accessToken;
  tokenState = null;
  if (!token) return;
  await loadGis();
  await new Promise((resolve) => window.google.accounts.oauth2.revoke(token, () => resolve()));
}

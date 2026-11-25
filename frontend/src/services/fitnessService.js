/**
 * Google Fit, server-backed. The browser never sees a Google token: the backend runs the
 * OAuth code flow, stores the refresh token encrypted, and syncs on the user's behalf.
 * (Replaces the old browser-token flow in services/googleFit/, which should be removed.)
 */
import { isRealFirebaseConfigured } from "./firebase";
import { api } from "./apiClient";

export const fitnessLive = () => isRealFirebaseConfigured;

const iso = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/** Inclusive date range of the last `days` days, in the user's local time. */
export function lastDaysRange(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: iso(from), to: iso(to) };
}

export async function getFitnessStatus() {
  if (!fitnessLive()) return { status: "sandbox", configured: false };
  const { data } = await api.get("/google-fit/status");
  return data;
}

/** Sends the browser to Google's consent screen; Google returns to /dashboard/google-fit. */
export async function connectGoogleFit() {
  const { data } = await api.post("/google-fit/connect");
  const url = new URL(data.auth_url);
  if (url.origin !== "https://accounts.google.com") throw new Error("Unexpected authorization URL.");
  window.location.assign(url.toString());
}

export async function syncGoogleFit(days = 30) {
  // getTimezoneOffset is minutes BEHIND UTC (IST = -330); the API wants minutes AHEAD
  const { data } = await api.post(
    "/google-fit/sync",
    { days, tz_offset_minutes: -new Date().getTimezoneOffset() },
    { timeoutMs: 60000 }
  );
  return data;
}

export async function getFitnessMetrics({ from, to }) {
  const { data } = await api.get("/google-fit/metrics", { from, to });
  return data;
}

/** Trends, streaks, mood <-> activity links, wellbeing alerts and plain-language insights. */
export async function getFitnessInsights(days = 14) {
  const { data } = await api.get("/google-fit/insights", { days });
  return data;
}

export async function disconnectGoogleFit({ purge = false } = {}) {
  const { data } = await api.delete(`/google-fit/connection${purge ? "?purge=true" : ""}`);
  return data;
}

/** Doctor: consented patient's wellness summary + intake check-in (audit-logged server-side). */
export async function getPatientWellness(patientId, days = 14) {
  if (!fitnessLive()) return null;
  const { data } = await api.get(`/patients/${encodeURIComponent(patientId)}/wellness-summary`, { days });
  return data;
}

/** Reads and removes ?google_fit=<result> left by the OAuth redirect. */
export function consumeOAuthResult() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get("google_fit");
  if (!result) return null;
  params.delete("google_fit");
  const qs = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  return result;
}

export const OAUTH_RESULT_MESSAGES = {
  connected: ["Google Fit Connected", "Your Google Fit account is linked. Syncing your recent data…"],
  denied: ["Google Fit Not Connected", "You declined access in Google. You can connect any time."],
  no_scopes: ["Google Fit Not Connected", "No Google Fit permissions were granted."],
  no_refresh_token: ["Google Fit Not Connected", "Google did not grant offline access. Please try connecting again."],
  invalid_state: ["Google Fit Not Connected", "The connection link expired or was already used. Please try again."],
  not_configured: ["Google Fit Unavailable", "Google Fit is not configured on the server yet."],
  error: ["Google Fit Not Connected", "Something went wrong while connecting. Please try again."]
};

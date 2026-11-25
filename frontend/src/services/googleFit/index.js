/**
 * Google Fit integration: connect, sync the last 24 hours, and hand the latest values to
 * journal entries.
 *
 * Firestore writes go through the Express API (POST /api/biometrics/sync), because the
 * project's Firestore rules deny all direct browser access. The backend takes `user_id` from
 * the verified Firebase ID token, so it is always auth.currentUser.uid.
 *
 * Usage (from a button click, so the Google popup is allowed):
 *   const result = await syncGoogleFit();           // { status, log, metrics }
 *   const bio = await getLatestBiometrics(user.uid); // for a new journal entry
 *   journalPayload.biometrics = toJournalBiometrics(bio);
 */
import { Timestamp } from "firebase/firestore";
import { auth, isRealFirebaseConfigured } from "../firebase";
import { api } from "../apiClient";
import { connectGoogleFit, getCachedAccessToken, clearGoogleFitToken } from "./googleFitAuth";
import { fetchLast24Hours } from "./fitnessApi";

export { connectGoogleFit, disconnectGoogleFit, isGoogleFitConfigured, GOOGLE_FIT_SCOPES } from "./googleFitAuth";

const PROVIDER = "google_fit";
const DATE_RANGE = "last 24 hours";
const RETRY_BASE_MS = 15 * 60 * 1000;
const RETRY_MAX_MS = 6 * 60 * 60 * 1000;

/**
 * The current backend sync endpoint always stores status "success" and ignores
 * status / error_message / next_retry_at. Sending a failed attempt there would record it as a
 * success, so failed attempts are only kept in memory until the backend accepts them.
 * Flip this to true once POST /api/biometrics/sync accepts those three fields.
 */
const BACKEND_RECORDS_FAILURES = false;

// Per-user, in-memory only: health values are never written to browser storage
const latestByUid = new Map();
const failuresByUid = new Map();
let lastFailureLog = null;

// Forget everything about the previous user on sign-out or account switch
if (auth) {
  auth.onAuthStateChanged((user) => {
    for (const uid of [...latestByUid.keys(), ...failuresByUid.keys()]) {
      if (uid !== user?.uid) {
        latestByUid.delete(uid);
        failuresByUid.delete(uid);
      }
    }
    if (lastFailureLog && lastFailureLog.user_id !== user?.uid) lastFailureLog = null;
  });
}

function requireCurrentUser() {
  if (!isRealFirebaseConfigured || !auth) {
    throw new Error("Google Fit sync needs Live mode (Firebase sign-in); it is not available in the Sandbox demo.");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in before syncing Google Fit.");
  return user;
}

/** Admin SDK timestamps arrive over JSON as { _seconds, _nanoseconds }. */
function toTimestamp(value) {
  if (value instanceof Timestamp) return value;
  const seconds = value?._seconds ?? value?.seconds;
  if (typeof seconds === "number") return new Timestamp(seconds, value._nanoseconds ?? value.nanoseconds ?? 0);
  return Timestamp.now();
}

const countMetrics = (metrics) => Object.values(metrics).filter((v) => v !== null && v !== undefined).length;

const definedOnly = (metrics) =>
  Object.fromEntries(Object.entries(metrics).filter(([, v]) => v !== null && v !== undefined));

function buildFailureLog(uid, error) {
  const failures = (failuresByUid.get(uid) || 0) + 1;
  failuresByUid.set(uid, failures);
  const delay = Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS);
  return {
    user_id: uid,
    sync_timestamp: Timestamp.now(),
    provider: PROVIDER,
    status: "failed",
    error_message: error?.message || String(error),
    next_retry_at: Timestamp.fromMillis(Date.now() + delay),
    data_synced: { metrics_count: 0, date_range: DATE_RANGE }
  };
}

async function recordFailure(uid, error) {
  const log = buildFailureLog(uid, error);
  lastFailureLog = log;
  if (BACKEND_RECORDS_FAILURES) {
    try {
      await api.post("/biometrics/sync", {
        provider: PROVIDER,
        status: "failed",
        error_message: log.error_message,
        next_retry_at: log.next_retry_at.toDate().toISOString(),
        date_range: DATE_RANGE
      });
    } catch (err) {
      console.warn("Could not record the failed Google Fit sync:", err);
    }
  }
  return { status: "failed", log, metrics: null };
}

/**
 * Connects (if needed), reads the last 24 hours from Google Fit, and writes a
 * biometric_sync_logs document. Never throws for sync problems; resolves
 * { status: "success" | "failed", log, metrics }.
 *
 * Pass { interactive: false } for background syncs: it skips the consent popup and fails
 * if there is no valid token.
 */
export async function syncGoogleFit({ interactive = true } = {}) {
  const user = requireCurrentUser();
  const uid = user.uid;

  let token;
  try {
    token = getCachedAccessToken() || (interactive ? await connectGoogleFit() : null);
    if (!token) throw new Error("Google Fit is not connected. Connect Google Fit to sync.");
  } catch (err) {
    return recordFailure(uid, err);
  }

  let metrics;
  try {
    const result = await fetchLast24Hours(token.accessToken, token.grantedScopes);
    if (result.errors.some((e) => e.status === 401)) clearGoogleFitToken();
    const attempted = token.grantedScopes.length;
    if (result.errors.length > 0 && result.errors.length >= attempted) throw result.errors[0];
    metrics = result.metrics;
  } catch (err) {
    if (err?.status === 401) clearGoogleFitToken();
    return recordFailure(uid, err);
  }

  // The user may have switched accounts while Google Fit was loading
  if (auth.currentUser?.uid !== uid) {
    return recordFailure(uid, new Error("The signed-in user changed during the sync."));
  }

  try {
    const { data } = await api.post("/biometrics/sync", {
      provider: PROVIDER,
      metrics: definedOnly(metrics),
      date_range: DATE_RANGE
    });
    const saved = data?.sync || {};
    const log = {
      id: saved.id,
      user_id: saved.user_id || uid,
      sync_timestamp: toTimestamp(saved.sync_timestamp),
      provider: PROVIDER,
      status: "success",
      error_message: null,
      next_retry_at: null,
      data_synced: saved.data_synced || { metrics_count: countMetrics(metrics), date_range: DATE_RANGE }
    };
    failuresByUid.delete(uid);
    latestByUid.set(uid, { ...metrics, sync_timestamp: log.sync_timestamp });
    return { status: "success", log, metrics };
  } catch (err) {
    return recordFailure(uid, err);
  }
}

/**
 * Most recent biometric values for `uid`, for attaching to a new journal entry:
 *   { resting_hr, hr_variability, sleep_hours, sleep_quality_score, steps, stress_level, sync_timestamp }
 * Metrics Google Fit could not provide are null (hr_variability and stress_level always are).
 *
 * Uses the latest sync from this session; if there is none but Google Fit is connected, it
 * syncs now. Resolves null when nothing is available. Only the signed-in user's own data
 * can be read.
 */
export async function getLatestBiometrics(uid) {
  const user = requireCurrentUser();
  if (!uid || uid !== user.uid) {
    throw new Error("Biometrics can only be read for the signed-in user.");
  }

  if (!latestByUid.has(uid) && getCachedAccessToken()) {
    await syncGoogleFit({ interactive: false });
  }

  const latest = latestByUid.get(uid);
  if (!latest) return null;
  return {
    resting_hr: latest.resting_hr,
    hr_variability: latest.hr_variability,
    sleep_hours: latest.sleep_hours,
    sleep_quality_score: latest.sleep_quality_score,
    steps: latest.steps,
    stress_level: latest.stress_level,
    sync_timestamp: latest.sync_timestamp
  };
}

/**
 * Converts getLatestBiometrics() output into the `biometrics` field accepted by
 * POST /api/journal: the backend schema rejects nulls and sync_timestamp, so both are removed.
 * Returns null when there is nothing to attach.
 */
export function toJournalBiometrics(biometrics) {
  if (!biometrics) return null;
  // eslint-disable-next-line no-unused-vars
  const { sync_timestamp, ...metrics } = biometrics;
  const defined = definedOnly(metrics);
  return Object.keys(defined).length ? defined : null;
}

/** The last failed attempt in this session (not yet persisted; see BACKEND_RECORDS_FAILURES). */
export function getLastGoogleFitFailure() {
  return lastFailureLog;
}

/**
 * Google Fit provider: every call to Google lives here, so the rest of the app only sees
 * normalized daily metrics. To move to the Google Health API (the Fit REST API is supported
 * only until the end of 2026), replace this module and keep the same exported functions.
 *
 * Minimum scopes, read-only: activity (steps, active minutes, calories), heart rate, sleep.
 * Distance is deliberately NOT requested: it needs the location scope.
 */
const axios = require('axios');
const config = require('../../config/env');

const SCOPES = Object.freeze([
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
  'https://www.googleapis.com/auth/fitness.sleep.read'
]);

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const FIT_BASE = 'https://www.googleapis.com/fitness/v1/users/me';
const DAY_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 15000;

class ProviderError extends Error {
  constructor(message, { status = 0, reason = 'provider_error' } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.reason = reason; // 'revoked' | 'insufficient_scope' | 'provider_error'
  }
}

function toProviderError(err) {
  const status = err.response?.status || 0;
  const data = err.response?.data || {};
  if (data.error === 'invalid_grant') return new ProviderError('Google access was revoked or expired.', { status, reason: 'revoked' });
  if (status === 401) return new ProviderError('Google rejected the access token.', { status, reason: 'revoked' });
  if (status === 403) return new ProviderError('Permission for this data type was not granted.', { status, reason: 'insufficient_scope' });
  // Never pass Google's raw error body upward: it can echo request details
  return new ProviderError(`Google Fit request failed${status ? ` (${status})` : ''}.`, { status });
}

const isConfigured = () => Boolean(config.googleFit.clientId && config.googleFit.clientSecret && config.googleFit.redirectUri);

function buildAuthUrl(state, loginHint) {
  const params = new URLSearchParams({
    client_id: config.googleFit.clientId,
    redirect_uri: config.googleFit.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline', // we need a refresh token for server-side sync
    prompt: 'consent', // always return a refresh token, and show the scopes again on reconnect
    include_granted_scopes: 'true',
    state
  });
  if (loginHint) params.set('login_hint', loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

const form = (obj) => new URLSearchParams(obj).toString();
const formHeaders = { 'Content-Type': 'application/x-www-form-urlencoded' };

async function exchangeCode(code) {
  try {
    const { data } = await axios.post(
      TOKEN_URL,
      form({
        code,
        client_id: config.googleFit.clientId,
        client_secret: config.googleFit.clientSecret,
        redirect_uri: config.googleFit.redirectUri,
        grant_type: 'authorization_code'
      }),
      { headers: formHeaders, timeout: TIMEOUT_MS }
    );
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || null,
      expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
      scopes: String(data.scope || '').split(' ').filter((s) => SCOPES.includes(s))
    };
  } catch (err) {
    throw toProviderError(err);
  }
}

async function refreshAccessToken(refreshToken) {
  try {
    const { data } = await axios.post(
      TOKEN_URL,
      form({
        refresh_token: refreshToken,
        client_id: config.googleFit.clientId,
        client_secret: config.googleFit.clientSecret,
        grant_type: 'refresh_token'
      }),
      { headers: formHeaders, timeout: TIMEOUT_MS }
    );
    return { accessToken: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  } catch (err) {
    throw toProviderError(err);
  }
}

async function revokeToken(token) {
  try {
    await axios.post(REVOKE_URL, form({ token }), { headers: formHeaders, timeout: TIMEOUT_MS });
  } catch (err) {
    // 400 = already invalid; nothing left to revoke
    if (err.response?.status !== 400) throw toProviderError(err);
  }
}

/** Local midnight (for the given UTC offset in minutes, e.g. +330 for IST) as a UTC timestamp. */
function localMidnight(ms, tzOffsetMinutes) {
  const shifted = ms + tzOffsetMinutes * 60000;
  return shifted - (shifted % DAY_MS) - tzOffsetMinutes * 60000;
}

const localDate = (ms, tzOffsetMinutes) => new Date(ms + tzOffsetMinutes * 60000).toISOString().slice(0, 10);

const DATA_TYPES = {
  steps: { name: 'com.google.step_count.delta', scope: SCOPES[0] },
  activeMinutes: { name: 'com.google.active_minutes', scope: SCOPES[0] },
  calories: { name: 'com.google.calories.expended', scope: SCOPES[0] },
  heartRate: { name: 'com.google.heart_rate.bpm', scope: SCOPES[1] }
};

async function aggregateDaily(accessToken, dataTypeName, startMs, endMs) {
  try {
    const { data } = await axios.post(
      `${FIT_BASE}/dataset:aggregate`,
      {
        aggregateBy: [{ dataTypeName }],
        bucketByTime: { durationMillis: DAY_MS },
        startTimeMillis: startMs,
        endTimeMillis: endMs
      },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: TIMEOUT_MS }
    );
    return data.bucket || [];
  } catch (err) {
    // No data source of this type on the account (e.g. no heart-rate device): treat as no data
    if (err.response?.status === 400) return [];
    throw toProviderError(err);
  }
}

async function sleepSessions(accessToken, startMs, endMs) {
  try {
    const { data } = await axios.get(`${FIT_BASE}/sessions`, {
      params: { startTime: new Date(startMs).toISOString(), endTime: new Date(endMs).toISOString(), activityType: 72 },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: TIMEOUT_MS
    });
    return data.session || [];
  } catch (err) {
    throw toProviderError(err);
  }
}

const sumPoints = (bucket, field) =>
  (bucket.dataset?.[0]?.point || []).reduce((s, p) => s + (p.value?.[0]?.[field] || 0), 0);

/**
 * Reads `days` local days ending today and returns
 *   { days: [{ date, steps, active_minutes, calories, heart_rate_avg, heart_rate_min, heart_rate_max, sleep_minutes }], errors: [] }
 * A data type whose scope was not granted is skipped (its fields stay null).
 */
async function fetchDailyMetrics(accessToken, { days, tzOffsetMinutes = 0, grantedScopes = SCOPES }) {
  const endMs = Date.now();
  const startMs = localMidnight(endMs, tzOffsetMinutes) - (days - 1) * DAY_MS;
  const byDate = new Map();
  for (let t = startMs; t <= endMs; t += DAY_MS) {
    byDate.set(localDate(t, tzOffsetMinutes), {
      date: localDate(t, tzOffsetMinutes),
      steps: null,
      active_minutes: null,
      calories: null,
      heart_rate_avg: null,
      heart_rate_min: null,
      heart_rate_max: null,
      sleep_minutes: null
    });
  }
  const errors = [];
  const granted = (scope) => grantedScopes.includes(scope);
  const dayOf = (bucket) => byDate.get(localDate(Number(bucket.startTimeMillis), tzOffsetMinutes));

  const tasks = [];
  if (granted(DATA_TYPES.steps.scope)) {
    tasks.push(
      aggregateDaily(accessToken, DATA_TYPES.steps.name, startMs, endMs).then((buckets) => {
        for (const b of buckets) if (dayOf(b)) dayOf(b).steps = Math.round(sumPoints(b, 'intVal'));
      }),
      aggregateDaily(accessToken, DATA_TYPES.activeMinutes.name, startMs, endMs).then((buckets) => {
        for (const b of buckets) if (dayOf(b)) dayOf(b).active_minutes = Math.round(sumPoints(b, 'intVal'));
      }),
      aggregateDaily(accessToken, DATA_TYPES.calories.name, startMs, endMs).then((buckets) => {
        for (const b of buckets) if (dayOf(b)) dayOf(b).calories = Math.round(sumPoints(b, 'fpVal'));
      })
    );
  }
  if (granted(DATA_TYPES.heartRate.scope)) {
    tasks.push(
      aggregateDaily(accessToken, DATA_TYPES.heartRate.name, startMs, endMs).then((buckets) => {
        for (const b of buckets) {
          const v = b.dataset?.[0]?.point?.[0]?.value; // summary: [avg, max, min]
          const day = dayOf(b);
          if (day && v?.length >= 3) {
            day.heart_rate_avg = Math.round(v[0].fpVal);
            day.heart_rate_max = Math.round(v[1].fpVal);
            day.heart_rate_min = Math.round(v[2].fpVal);
          }
        }
      })
    );
  }
  if (granted(SCOPES[2])) {
    // Sleep is counted on the day the user woke up
    tasks.push(
      sleepSessions(accessToken, startMs - DAY_MS / 2, endMs).then((sessions) => {
        for (const s of sessions) {
          const day = byDate.get(localDate(Number(s.endTimeMillis), tzOffsetMinutes));
          if (day) day.sleep_minutes = (day.sleep_minutes || 0) + Math.round((Number(s.endTimeMillis) - Number(s.startTimeMillis)) / 60000);
        }
      })
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === 'rejected') errors.push(r.reason instanceof ProviderError ? r.reason : toProviderError(r.reason));
  return { days: [...byDate.values()], errors };
}

module.exports = {
  SCOPES,
  ProviderError,
  isConfigured,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  revokeToken,
  fetchDailyMetrics,
  localDate
};

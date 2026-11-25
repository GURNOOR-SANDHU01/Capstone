/**
 * Google Fitness REST API reads for the last 24 hours.
 *
 * Google Fit has no data types for heart rate variability or stress, so those come back as
 * null. Resting heart rate and sleep quality are estimates computed from the raw data; see
 * the notes on each function.
 */

const FIT_BASE = "https://www.googleapis.com/fitness/v1/users/me";
const DAY_MS = 24 * 60 * 60 * 1000;

// Google's merged ("derived") streams, the same ones the Google Fit app shows
const SOURCES = {
  steps: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
  heartRate: "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
  sleepSegments: "derived:com.google.sleep.segment:com.google.android.gms:merged"
};

// com.google.sleep.segment stage values
const SLEEP_STAGE = { AWAKE: 1, SLEEP: 2, OUT_OF_BED: 3, LIGHT: 4, DEEP: 5, REM: 6 };
const SLEEP_ACTIVITY_TYPE = 72;

export class FitApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "FitApiError";
    this.status = status;
  }
}

// Millisecond epoch -> nanosecond string (multiplying by 1e6 would lose precision as a JS number)
const toNanos = (ms) => `${Math.trunc(ms)}000000`;
const nanosToMs = (ns) => Number(String(ns).slice(0, -6) || 0);

async function fitFetch(accessToken, path, { method = "GET", body } = {}) {
  const response = await fetch(`${FIT_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  // The user has no data source of this type (e.g. never wore a heart rate device)
  if (response.status === 404) return null;

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.error?.message || "";
    } catch {
      /* non-JSON error body */
    }
    const message = response.status === 401
      ? "Google Fit access expired. Please reconnect Google Fit."
      : response.status === 403
        ? `Google Fit denied access${detail ? `: ${detail}` : "."}`
        : `Google Fit request failed (${response.status})${detail ? `: ${detail}` : ""}`;
    throw new FitApiError(message, response.status);
  }
  return response.json();
}

/** Total steps in the window, or null when there are no step data points. */
export async function fetchSteps(accessToken, startMs, endMs) {
  const data = await fitFetch(accessToken, "/dataset:aggregate", {
    method: "POST",
    body: {
      aggregateBy: [{ dataSourceId: SOURCES.steps }],
      bucketByTime: { durationMillis: endMs - startMs },
      startTimeMillis: startMs,
      endTimeMillis: endMs
    }
  });
  const points = (data?.bucket || []).flatMap((b) => b.dataset || []).flatMap((d) => d.point || []);
  if (points.length === 0) return null;
  return points.reduce((sum, p) => sum + (p.value?.[0]?.intVal || 0), 0);
}

/**
 * Resting heart rate estimate: the 10th percentile of all heart rate samples in the window.
 * Google Fit does not expose a resting heart rate type through this API, and the lowest
 * readings of the day (usually during sleep) are the standard proxy.
 */
export async function fetchRestingHeartRate(accessToken, startMs, endMs) {
  const id = encodeURIComponent(SOURCES.heartRate);
  const data = await fitFetch(accessToken, `/dataSources/${id}/datasets/${toNanos(startMs)}-${toNanos(endMs)}`);
  const bpm = (data?.point || [])
    .map((p) => p.value?.[0]?.fpVal)
    .filter((v) => typeof v === "number" && v > 25 && v < 230)
    .sort((a, b) => a - b);
  if (bpm.length < 5) return null;
  return Math.round(bpm[Math.floor(bpm.length * 0.1)]);
}

/**
 * Sleep that ended in the window: { sleep_hours, sleep_quality_score }, or nulls when there
 * is no sleep session.
 *
 * sleep_quality_score (0.0–1.0) is a weighted mix of whatever is available:
 *   - duration (50%): 1.0 for 7–9 hours, falling off outside that range
 *   - efficiency (30%): time asleep / time in bed, needs sleep stage data
 *   - restorative sleep (20%): deep + REM share of sleep, 40%+ scores 1.0, needs stage data
 * Weights are rescaled when stage data is missing.
 */
export async function fetchSleep(accessToken, startMs, endMs) {
  // Look back 12 extra hours so a night that started before the window is still found
  const query = new URLSearchParams({
    startTime: new Date(startMs - DAY_MS / 2).toISOString(),
    endTime: new Date(endMs).toISOString(),
    activityType: String(SLEEP_ACTIVITY_TYPE)
  });
  const data = await fitFetch(accessToken, `/sessions?${query}`);
  const sessions = (data?.session || [])
    .map((s) => ({ start: Number(s.startTimeMillis), end: Number(s.endTimeMillis) }))
    .filter((s) => s.end > startMs && s.end <= endMs && s.end > s.start);

  if (sessions.length === 0) return { sleep_hours: null, sleep_quality_score: null };

  const windowStart = Math.min(...sessions.map((s) => s.start));
  const windowEnd = Math.max(...sessions.map((s) => s.end));
  const id = encodeURIComponent(SOURCES.sleepSegments);
  const segData = await fitFetch(accessToken, `/dataSources/${id}/datasets/${toNanos(windowStart)}-${toNanos(windowEnd)}`);

  const totals = { asleep: 0, awake: 0, restorative: 0 };
  let hasDetailedStages = false;
  for (const p of segData?.point || []) {
    const stage = p.value?.[0]?.intVal;
    const duration = nanosToMs(p.endTimeNanos) - nanosToMs(p.startTimeNanos);
    if (duration <= 0) continue;
    if (stage === SLEEP_STAGE.AWAKE || stage === SLEEP_STAGE.OUT_OF_BED) {
      totals.awake += duration;
    } else if ([SLEEP_STAGE.SLEEP, SLEEP_STAGE.LIGHT, SLEEP_STAGE.DEEP, SLEEP_STAGE.REM].includes(stage)) {
      totals.asleep += duration;
      if (stage === SLEEP_STAGE.DEEP || stage === SLEEP_STAGE.REM) totals.restorative += duration;
      if (stage !== SLEEP_STAGE.SLEEP) hasDetailedStages = true;
    }
  }

  const hasSegments = totals.asleep + totals.awake > 0;
  const asleepMs = hasSegments ? totals.asleep : sessions.reduce((sum, s) => sum + (s.end - s.start), 0);
  const hours = asleepMs / (60 * 60 * 1000);

  const parts = [[durationScore(hours), 0.5]];
  if (hasSegments) parts.push([totals.asleep / (totals.asleep + totals.awake), 0.3]);
  if (hasDetailedStages && totals.asleep > 0) parts.push([Math.min(1, totals.restorative / totals.asleep / 0.4), 0.2]);
  const weight = parts.reduce((sum, [, w]) => sum + w, 0);
  const quality = parts.reduce((sum, [score, w]) => sum + score * w, 0) / weight;

  return {
    sleep_hours: round(Math.min(hours, 24), 2),
    sleep_quality_score: round(clamp01(quality), 2)
  };
}

function durationScore(hours) {
  if (hours >= 7 && hours <= 9) return 1;
  if (hours < 7) return clamp01((hours - 3) / 4);
  return Math.max(0.5, 1 - (hours - 9) / 4);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round = (v, digits) => Number(v.toFixed(digits));

/**
 * Reads all metrics for the last 24 hours. Each metric group is fetched independently, so a
 * missing device or an unticked permission only nulls that group.
 * Resolves { metrics, errors }; `errors` lists the groups that failed for other reasons.
 */
export async function fetchLast24Hours(accessToken, grantedScopes = []) {
  const endMs = Date.now();
  const startMs = endMs - DAY_MS;
  const has = (scope) => grantedScopes.some((s) => s.endsWith(scope));

  const [steps, restingHr, sleep] = await Promise.allSettled([
    has("fitness.activity.read") ? fetchSteps(accessToken, startMs, endMs) : Promise.resolve(null),
    has("fitness.heart_rate.read") ? fetchRestingHeartRate(accessToken, startMs, endMs) : Promise.resolve(null),
    has("fitness.sleep.read") ? fetchSleep(accessToken, startMs, endMs) : Promise.resolve(null)
  ]);

  const errors = [steps, restingHr, sleep].filter((r) => r.status === "rejected").map((r) => r.reason);
  const value = (r) => (r.status === "fulfilled" ? r.value : null);

  return {
    metrics: {
      resting_hr: value(restingHr),
      hr_variability: null, // not available from Google Fit
      sleep_hours: value(sleep)?.sleep_hours ?? null,
      sleep_quality_score: value(sleep)?.sleep_quality_score ?? null,
      steps: value(steps),
      stress_level: null // not available from Google Fit
    },
    errors
  };
}

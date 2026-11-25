/**
 * Google Fit integration (server-side OAuth authorization-code flow).
 *
 * Security properties:
 *  - The browser never receives a Google token. The refresh token is stored only as
 *    AES-256-GCM ciphertext bound to the user's uid; access tokens live in server memory only.
 *  - The OAuth `state` is HMAC-signed, expires after 10 minutes and carries a one-time nonce
 *    that must match the one stored when the user clicked "Connect".
 *  - A revoked grant (invalid_grant / 401) deletes the stored token and marks the connection
 *    `revoked`, so the UI can ask the user to reconnect.
 *  - Doctors read a summary only with an active consent bridge, and every read is audit-logged.
 */
const config = require('../../config/env');
const logger = require('../../utils/logger');
const { Timestamp } = require('../../config/firebase/firestore');
const fitnessRepository = require('../../repositories/fitnessRepository');
const userRepository = require('../../repositories/userRepository');
const consentRepository = require('../../repositories/consentRepository');
const adminAuditRepository = require('../../repositories/adminAuditRepository');
const { httpError, journalAccessFor } = require('../accessPolicy');
const { ROLES } = require('../../config/roles');
const crypto = require('../../utils/crypto');
const defaultClient = require('./googleFitClient');
const journalRepository = require('../../repositories/journalRepository');
const safetyService = require('../safetyService');
const { analyze, moodByDate } = require('./fitnessInsights');

const PROVIDER = 'google_fit';
const MIN_SYNC_INTERVAL_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const METRIC_KEYS = ['steps', 'active_minutes', 'calories', 'heart_rate_avg', 'sleep_minutes'];

function summarize(days) {
  const out = {};
  for (const key of METRIC_KEYS) {
    const values = days.map((d) => d[key]).filter((v) => typeof v === 'number' && (key !== 'steps' || v > 0));
    out[key] = values.length
      ? { avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length), total: values.reduce((a, b) => a + b, 0), days_with_data: values.length }
      : { avg: null, total: null, days_with_data: 0 };
  }
  return out;
}

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

class GoogleFitService {
  constructor(client = defaultClient) {
    this.client = client;
    this.accessTokens = new Map(); // uid -> { accessToken, expiresAt }  (memory only)
  }

  get configured() {
    return this.client.isConfigured() && crypto.isEncryptionConfigured();
  }

  _publicConnection(conn) {
    if (!this.configured) return { configured: false, status: 'not_configured', provider: PROVIDER };
    if (!conn || conn.status === 'disconnected') return { configured: true, status: 'not_connected', provider: PROVIDER };
    return {
      configured: true,
      provider: PROVIDER,
      status: conn.status, // connected | revoked | pending
      scopes: conn.scopes || [],
      connected_at: conn.connected_at || null,
      last_sync_at: conn.last_sync_at || null,
      last_sync_status: conn.last_sync_status || null,
      last_error: conn.last_error || null
    };
  }

  async getStatus(user) {
    return this._publicConnection(await fitnessRepository.getConnection(user.uid));
  }

  _requireConfigured() {
    if (!this.configured) {
      throw httpError(503, 'GOOGLE_FIT_NOT_CONFIGURED', 'Google Fit is not configured on this server.');
    }
  }

  /** Step 1: returns the Google consent URL; the browser navigates there. */
  async startConnect(user) {
    this._requireConfigured();
    const nonce = crypto.randomToken();
    const existing = await fitnessRepository.getConnection(user.uid);
    await fitnessRepository.saveConnection(user.uid, {
      status: existing?.status === 'connected' ? 'connected' : 'pending',
      pending_nonce: nonce,
      pending_expires_at: Date.now() + 10 * 60 * 1000
    });
    const state = crypto.signState({ uid: user.uid, nonce });
    return { auth_url: this.client.buildAuthUrl(state, user.email || undefined) };
  }

  /**
   * Step 2: Google redirects the browser to the callback. Returns the frontend URL to redirect to.
   * Never throws: every failure becomes ?google_fit=<reason> on the redirect.
   */
  async handleCallback({ code, state, error }) {
    const back = (result) => `${config.frontendUrl}/dashboard/google-fit?google_fit=${encodeURIComponent(result)}`;
    if (!this.configured) return back('not_configured');

    const payload = crypto.verifyState(state);
    if (!payload?.uid || !payload?.nonce) return back('invalid_state');
    const uid = payload.uid;
    const conn = await fitnessRepository.getConnection(uid);
    if (!conn || conn.pending_nonce !== payload.nonce || Date.now() > (conn.pending_expires_at || 0)) {
      return back('invalid_state');
    }
    // One-time: the nonce is consumed whatever happens next
    await fitnessRepository.saveConnection(uid, {
      pending_nonce: null,
      pending_expires_at: null,
      status: conn.status === 'pending' ? 'disconnected' : conn.status
    });

    if (error) return back(error === 'access_denied' ? 'denied' : 'error');
    if (typeof code !== 'string' || !code) return back('error');

    try {
      const tokens = await this.client.exchangeCode(code);
      if (!tokens.refreshToken) return back('no_refresh_token');
      if (!tokens.scopes.length) {
        await this.client.revokeToken(tokens.refreshToken).catch(() => {});
        return back('no_scopes');
      }
      await fitnessRepository.saveConnection(uid, {
        status: 'connected',
        provider: PROVIDER,
        scopes: tokens.scopes,
        encrypted_refresh_token: crypto.encrypt(tokens.refreshToken, uid),
        connected_at: Timestamp.now(),
        last_error: null
      });
      this.accessTokens.set(uid, { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt });
      return back('connected');
    } catch (err) {
      logger.error('Google Fit OAuth code exchange failed', { reason: err.reason, status: err.status });
      return back('error');
    }
  }

  async _markRevoked(uid) {
    this.accessTokens.delete(uid);
    await fitnessRepository.saveConnection(uid, {
      status: 'revoked',
      encrypted_refresh_token: null,
      last_sync_status: 'failed',
      last_error: 'Google Fit access was revoked. Reconnect to continue syncing.'
    });
  }

  async _accessToken(uid, conn) {
    const cached = this.accessTokens.get(uid);
    if (cached && cached.expiresAt - 60000 > Date.now()) return cached.accessToken;
    if (!conn.encrypted_refresh_token) throw httpError(409, 'GOOGLE_FIT_REVOKED', 'Google Fit access was revoked. Please reconnect.');
    let refreshToken;
    try {
      refreshToken = crypto.decrypt(conn.encrypted_refresh_token, uid);
    } catch {
      logger.error('Stored Google Fit token could not be decrypted (key changed?)', { uid });
      await this._markRevoked(uid);
      throw httpError(409, 'GOOGLE_FIT_REVOKED', 'Google Fit needs to be reconnected.');
    }
    try {
      const t = await this.client.refreshAccessToken(refreshToken);
      this.accessTokens.set(uid, t);
      return t.accessToken;
    } catch (err) {
      if (err.reason === 'revoked') {
        await this._markRevoked(uid);
        throw httpError(409, 'GOOGLE_FIT_REVOKED', 'Google Fit access was revoked. Please reconnect.');
      }
      throw httpError(502, 'GOOGLE_FIT_UNAVAILABLE', 'Google Fit could not be reached. Please try again later.');
    }
  }

  async sync(user, { days = 30, tz_offset_minutes: tz = 0 } = {}) {
    this._requireConfigured();
    const uid = user.uid;
    const conn = await fitnessRepository.getConnection(uid);
    if (!conn || conn.status === 'disconnected' || conn.status === 'pending') {
      throw httpError(409, 'GOOGLE_FIT_NOT_CONNECTED', 'Connect Google Fit before syncing.');
    }
    if (conn.status === 'revoked') throw httpError(409, 'GOOGLE_FIT_REVOKED', 'Google Fit access was revoked. Please reconnect.');
    const lastMs = conn.last_sync_attempt_ms || 0;
    if (Date.now() - lastMs < MIN_SYNC_INTERVAL_MS) {
      throw httpError(429, 'SYNC_TOO_FREQUENT', 'Google Fit was synced moments ago. Please wait a minute.');
    }
    // Remember the user's timezone so background syncs bucket days the same way
    await fitnessRepository.saveConnection(uid, { last_sync_attempt_ms: Date.now(), tz_offset_minutes: tz });
    const status = await this._syncUser(uid, { ...conn, tz_offset_minutes: tz }, days);
    return { synced_days: days, status, connection: await this.getStatus(user) };
  }

  /** Shared by user-triggered and background syncs. Returns 'success' | 'partial' or throws. */
  async _syncUser(uid, conn, days) {
    const tz = conn.tz_offset_minutes || 0;
    const accessToken = await this._accessToken(uid, conn);
    // Fit's aggregate API merges every data source on the account: phone sensors and any app
    // that syncs to Google Fit (directly or via Health Connect)
    const result = await this.client.fetchDailyMetrics(accessToken, { days, tzOffsetMinutes: tz, grantedScopes: conn.scopes || [] });

    if (result.errors.some((e) => e.reason === 'revoked')) {
      await this._markRevoked(uid);
      throw httpError(409, 'GOOGLE_FIT_REVOKED', 'Google Fit access was revoked. Please reconnect.');
    }
    const hasData = result.days.some((d) => METRIC_KEYS.some((k) => d[k] !== null));
    if (result.errors.length && !hasData) {
      await fitnessRepository.saveConnection(uid, { last_sync_status: 'failed', last_error: 'Google Fit could not be reached.' });
      throw httpError(502, 'GOOGLE_FIT_UNAVAILABLE', 'Google Fit could not be reached. Please try again later.');
    }

    await fitnessRepository.upsertDays(uid, PROVIDER, result.days);
    const partial = result.errors.length > 0;
    await fitnessRepository.saveConnection(uid, {
      last_sync_at: Timestamp.now(),
      last_sync_ms: Date.now(),
      last_sync_status: partial ? 'partial' : 'success',
      last_error: partial ? 'Some data types could not be read (permission not granted or unavailable).' : null
    });

    try {
      await this._raiseWellbeingAlerts(uid);
    } catch (err) {
      logger.error('Wellbeing pattern check failed', { error: err.message });
    }
    return partial ? 'partial' : 'success';
  }

  async getMetrics(user, { from, to }) {
    const days = await fitnessRepository.listDays(user.uid, from, to);
    return { from, to, days: days.map(stripDay), summary: summarize(days), connection: await this.getStatus(user) };
  }

  /* ------------------------------------------------------------- analysis */

  /** Two periods of metrics (current + previous for comparison) and the matching journal mood. */
  async _analysisFor(uid, periodDays, { sharedJournalOnly = false } = {}) {
    const today = isoDay(Date.now());
    const from = isoDay(Date.now() - (2 * periodDays - 1) * DAY_MS);
    const [days, entries] = await Promise.all([
      fitnessRepository.listDays(uid, from, today),
      journalRepository.listForAnalysis(uid, { sharedOnly: sharedJournalOnly })
    ]);
    const inRange = entries.filter((e) => e.entry_date >= from && e.entry_date <= today);
    return analyze({ days, mood: moodByDate(inRange), today, periodDays });
  }

  /** Patient: trends, streaks, mood <-> activity links, wellbeing alerts and plain-language insights. */
  async getInsights(user, { days = 14 } = {}) {
    const analysis = await this._analysisFor(user.uid, days);
    return { ...analysis, connection: await this.getStatus(user) };
  }

  /**
   * Sustained risky patterns (moderate severity) go into the existing safety-alert pipeline:
   * consented doctors with red-flag alerts enabled, or the admin triage queue. Each pattern is
   * raised at most once per week. Alerts carry no journal text.
   */
  async _raiseWellbeingAlerts(uid) {
    const { alerts } = await this._analysisFor(uid, 14);
    const serious = alerts.filter((a) => a.severity === 'moderate');
    if (!serious.length) return [];
    const conn = (await fitnessRepository.getConnection(uid)) || {};
    const raised = { ...(conn.raised_alerts || {}) };
    const weekAgo = Date.now() - 7 * DAY_MS;
    const sent = [];
    for (const a of serious) {
      if ((raised[a.type] || 0) > weekAgo) continue;
      await safetyService.raiseAlert(uid, {
        severity: 'moderate',
        alertType: `wellbeing_${a.type}`,
        reason: `Wearable pattern: ${a.message}${a.with_low_mood ? ' Recent journal mood is also low.' : ''}`
      });
      raised[a.type] = Date.now();
      sent.push(a.type);
    }
    if (sent.length) await fitnessRepository.saveConnection(uid, { raised_alerts: raised });
    return sent;
  }

  /* ------------------------------------------------------- background sync */

  /** Syncs every connected account whose last sync is older than `maxAgeMs`. */
  async syncAllDue({ maxAgeMs = 6 * 60 * 60 * 1000, days = 7 } = {}) {
    if (!this.configured) return { synced: 0, failed: 0 };
    let synced = 0;
    let failed = 0;
    for (const conn of await fitnessRepository.listConnected()) {
      if (Date.now() - (conn.last_sync_ms || 0) < maxAgeMs) continue;
      try {
        await this._syncUser(conn.user_id || conn.id, conn, days);
        synced += 1;
      } catch (err) {
        failed += 1;
        logger.warn('Background Google Fit sync failed', { code: err.code });
      }
    }
    if (synced || failed) logger.info('Background Google Fit sync finished', { synced, failed });
    return { synced, failed };
  }

  startAutoSync({ intervalMs = 60 * 60 * 1000 } = {}) {
    if (!this.configured || this._timer) return;
    const run = () => this.syncAllDue().catch((err) => logger.error('Background sync crashed', { error: err.message }));
    this._timer = setInterval(run, intervalMs);
    this._timer.unref?.();
    setTimeout(run, 30 * 1000).unref?.();
    logger.info(`Google Fit background sync every ${Math.round(intervalMs / 60000)} min`);
  }

  async disconnect(user, { purge = false } = {}) {
    const uid = user.uid;
    const conn = await fitnessRepository.getConnection(uid);
    this.accessTokens.delete(uid);
    if (conn?.encrypted_refresh_token && this.configured) {
      try {
        await this.client.revokeToken(crypto.decrypt(conn.encrypted_refresh_token, uid));
      } catch (err) {
        logger.warn('Google Fit token revoke failed; deleting it locally anyway', { reason: err.reason });
      }
    }
    await fitnessRepository.deleteConnection(uid);
    const deleted = purge ? await fitnessRepository.deleteAllDays(uid) : 0;
    return { status: 'not_connected', deleted_days: deleted };
  }

  /**
   * Doctor view: wellness summary + intake check-in answers for a consenting patient.
   * Requires an active consent bridge with journal-level access (not emergency_only).
   * Every successful read is recorded in the audit log.
   */
  async getPatientSummaryForDoctor(user, patientId, { days = 14 } = {}) {
    if (user.role !== ROLES.DOCTOR) throw httpError(403, 'FORBIDDEN', 'Only doctors can view patient wellness summaries.');
    const bridge = await consentRepository.findActiveBridge(patientId, user.uid);
    const access = bridge ? journalAccessFor(bridge.access_level) : 'none';
    if (access === 'none') throw httpError(403, 'FORBIDDEN', 'Access denied. The patient has not granted consent for this data.');

    const to = isoDay(Date.now());
    const from = isoDay(Date.now() - (days - 1) * DAY_MS);
    const [rows, conn, profile] = await Promise.all([
      fitnessRepository.listDays(patientId, from, to),
      fitnessRepository.getConnection(patientId),
      userRepository.getById(patientId)
    ]);
    const screening = profile?.onboarding?.screening || {};
    // Mood links use only entries the patient chose to share; private entries never inform the doctor view
    const analysis = await this._analysisFor(patientId, days, { sharedJournalOnly: true });

    await adminAuditRepository.log({
      actorId: user.uid,
      actorRole: user.role,
      action: 'VIEW_PATIENT_WELLNESS',
      targetId: patientId,
      details: { days, access_level: bridge.access_level }
    });

    return {
      patient_id: patientId,
      access,
      range: { from, to },
      connection: { status: conn?.status === 'connected' ? 'connected' : conn?.status || 'not_connected', last_sync_at: conn?.last_sync_at || null },
      days: rows.map(stripDay),
      summary: summarize(rows),
      analysis: {
        trends: analysis.trends,
        streaks: analysis.streaks,
        mood_links: analysis.mood_links,
        alerts: analysis.alerts,
        insights: analysis.insights,
        mood_source: 'shared journal entries only'
      },
      intake: profile?.onboarding?.completed
        ? {
            completed_at: profile.onboarding.completed_at || null,
            risk_category: profile.onboarding.risk_category || null,
            wellness_answers: screening.wellness || null,
            // Safety-screening answers are only shown with full reflection access
            safety_answers: access === 'full' ? screening.safety || null : undefined
          }
        : null
    };
  }
}

function stripDay(d) {
  return {
    date: d.date,
    steps: d.steps ?? null,
    active_minutes: d.active_minutes ?? null,
    calories: d.calories ?? null,
    heart_rate_avg: d.heart_rate_avg ?? null,
    heart_rate_min: d.heart_rate_min ?? null,
    heart_rate_max: d.heart_rate_max ?? null,
    sleep_minutes: d.sleep_minutes ?? null
  };
}

module.exports = new GoogleFitService();
module.exports.GoogleFitService = GoogleFitService;
module.exports.summarize = summarize;

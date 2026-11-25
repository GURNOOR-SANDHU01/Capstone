/**
 * Google Fit server-side OAuth, encrypted token storage, sync, revocation, RBAC and doctor access.
 * Google is replaced by a fake client; no network access.
 */
const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({ firebaseApp: {}, auth: mockAuth, db: mockDb }));
jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');
const googleFitService = require('../src/services/fitness/googleFitService');
const realClient = require('../src/services/fitness/googleFitClient');
const crypto = require('../src/utils/crypto');

const PATIENT = 'Bearer token_user_fitpatient';
const PATIENT_UID = 'user_fitpatient';
const DOCTOR = 'Bearer therapist_token';
const ADMIN = 'Bearer admin_token';
const REFRESH = 'refresh-token-SECRET-123';

function fakeClient(overrides = {}) {
  return {
    SCOPES: realClient.SCOPES,
    isConfigured: () => true,
    buildAuthUrl: (state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`,
    exchangeCode: jest.fn(async () => ({
      accessToken: 'access-1',
      refreshToken: REFRESH,
      expiresAt: Date.now() + 3600e3,
      scopes: [...realClient.SCOPES]
    })),
    refreshAccessToken: jest.fn(async () => ({ accessToken: 'access-2', expiresAt: Date.now() + 3600e3 })),
    revokeToken: jest.fn(async () => {}),
    fetchDailyMetrics: jest.fn(async () => ({
      days: [
        { date: '2026-11-20', steps: 8000, active_minutes: 40, calories: 2100, heart_rate_avg: 72, heart_rate_min: 55, heart_rate_max: 140, sleep_minutes: 420 },
        { date: '2026-11-21', steps: 4000, active_minutes: 20, calories: 1900, heart_rate_avg: 75, heart_rate_min: 58, heart_rate_max: 120, sleep_minutes: 360 }
      ],
      errors: []
    })),
    ...overrides
  };
}

const stateFrom = (authUrl) => new URL(authUrl).searchParams.get('state');

async function connect() {
  const start = await request(app).post('/api/google-fit/connect').set('Authorization', PATIENT);
  expect(start.status).toBe(200);
  const state = stateFrom(start.body.data.auth_url);
  const cb = await request(app).get('/api/google-fit/oauth/callback').query({ code: 'auth-code', state });
  return { start, cb, state };
}

describe('Google Fit integration', () => {
  beforeEach(() => {
    mockDb.reset();
    googleFitService.client = fakeClient();
    googleFitService.accessTokens.clear();
  });

  it('connects via server-side OAuth and stores the refresh token encrypted, never in plain text', async () => {
    const { cb } = await connect();
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('http://localhost:5173/dashboard/google-fit?google_fit=connected');

    const stored = JSON.stringify(mockDb.store.fitness_connections[PATIENT_UID]);
    expect(stored).not.toContain(REFRESH);
    const conn = mockDb.store.fitness_connections[PATIENT_UID];
    expect(crypto.decrypt(conn.encrypted_refresh_token, PATIENT_UID)).toBe(REFRESH);
    // Ciphertext is bound to its owner
    expect(() => crypto.decrypt(conn.encrypted_refresh_token, 'someone_else')).toThrow();

    const status = await request(app).get('/api/google-fit/status').set('Authorization', PATIENT);
    expect(status.body.data.status).toBe('connected');
    expect(JSON.stringify(status.body)).not.toMatch(/token/i);
  });

  it('rejects a forged, replayed or missing OAuth state', async () => {
    const forged = await request(app).get('/api/google-fit/oauth/callback').query({ code: 'x', state: 'abc.def' });
    expect(forged.headers.location).toContain('google_fit=invalid_state');

    const { state } = await connect();
    const replay = await request(app).get('/api/google-fit/oauth/callback').query({ code: 'auth-code', state });
    expect(replay.headers.location).toContain('google_fit=invalid_state');
    expect(googleFitService.client.exchangeCode).toHaveBeenCalledTimes(1);
  });

  it('handles the user declining consent', async () => {
    const start = await request(app).post('/api/google-fit/connect').set('Authorization', PATIENT);
    const cb = await request(app)
      .get('/api/google-fit/oauth/callback')
      .query({ error: 'access_denied', state: stateFrom(start.body.data.auth_url) });
    expect(cb.headers.location).toContain('google_fit=denied');
    const status = await request(app).get('/api/google-fit/status').set('Authorization', PATIENT);
    expect(status.body.data.status).toBe('not_connected');
  });

  it('syncs daily metrics and returns them with a summary for a date range', async () => {
    await connect();
    const sync = await request(app).post('/api/google-fit/sync').set('Authorization', PATIENT).send({ days: 7, tz_offset_minutes: 330 });
    expect(sync.status).toBe(200);
    expect(sync.body.data.status).toBe('success');

    const res = await request(app).get('/api/google-fit/metrics').set('Authorization', PATIENT).query({ from: '2026-11-01', to: '2026-11-30' });
    expect(res.status).toBe(200);
    expect(res.body.data.days).toHaveLength(2);
    expect(res.body.data.summary.steps.avg).toBe(6000);
    expect(res.body.data.summary.sleep_minutes.avg).toBe(390);

    const again = await request(app).post('/api/google-fit/sync').set('Authorization', PATIENT).send({});
    expect(again.status).toBe(429);
  });

  it('marks the connection revoked and deletes the stored token when Google revokes access', async () => {
    await connect();
    googleFitService.accessTokens.clear();
    googleFitService.client.refreshAccessToken.mockRejectedValueOnce(
      Object.assign(new realClient.ProviderError('revoked', { reason: 'revoked' }))
    );
    const sync = await request(app).post('/api/google-fit/sync').set('Authorization', PATIENT).send({});
    expect(sync.status).toBe(409);
    expect(sync.body.error.code).toBe('GOOGLE_FIT_REVOKED');
    expect(mockDb.store.fitness_connections[PATIENT_UID].encrypted_refresh_token).toBeNull();
    const status = await request(app).get('/api/google-fit/status').set('Authorization', PATIENT);
    expect(status.body.data.status).toBe('revoked');
  });

  it('disconnect revokes at Google, deletes the connection and optionally purges data', async () => {
    await connect();
    await request(app).post('/api/google-fit/sync').set('Authorization', PATIENT).send({});
    const res = await request(app).delete('/api/google-fit/connection?purge=true').set('Authorization', PATIENT);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted_days).toBe(2);
    expect(googleFitService.client.revokeToken).toHaveBeenCalledWith(REFRESH);
    expect(mockDb.store.fitness_connections[PATIENT_UID]).toBeUndefined();
  });

  it('validates input and restricts the patient endpoints to patients', async () => {
    const bad = await request(app).get('/api/google-fit/metrics').set('Authorization', PATIENT).query({ from: "2026-01-01'; DROP", to: '2026-02-01' });
    expect(bad.status).toBe(400);
    const extra = await request(app).post('/api/google-fit/sync').set('Authorization', PATIENT).send({ days: 7, user_id: 'other' });
    expect(extra.status).toBe(400);

    for (const token of [DOCTOR, ADMIN]) {
      const res = await request(app).get('/api/google-fit/status').set('Authorization', token);
      expect(res.status).toBe(403);
    }
    const anon = await request(app).get('/api/google-fit/status');
    expect(anon.status).toBe(401);
  });

  it('doctor sees a wellness summary only with patient consent, and each view is audit-logged', async () => {
    await connect();
    await request(app).post('/api/google-fit/sync').set('Authorization', PATIENT).send({});

    const denied = await request(app).get(`/api/patients/${PATIENT_UID}/wellness-summary`).set('Authorization', DOCTOR);
    expect(denied.status).toBe(403);

    await request(app)
      .post('/api/consent/therapist')
      .set('Authorization', PATIENT)
      .send({ therapist_id: 'therapist_001_dr_sharma', access_level: 'longitudinal_summary_only' });

    const ok = await request(app).get(`/api/patients/${PATIENT_UID}/wellness-summary?days=14`).set('Authorization', DOCTOR);
    expect(ok.status).toBe(200);
    expect(ok.body.data.access).toBe('summary');
    expect(JSON.stringify(ok.body)).not.toMatch(/refresh|encrypted/i);

    const audit = Object.values(mockDb.store.admin_audit_logs || {});
    expect(audit.some((a) => a.action === 'VIEW_PATIENT_WELLNESS' && a.target_id === PATIENT_UID)).toBe(true);

    const asPatient = await request(app).get(`/api/patients/${PATIENT_UID}/wellness-summary`).set('Authorization', PATIENT);
    expect(asPatient.status).toBe(403);
  });
});

describe('crypto utilities', () => {
  it('encrypts with a fresh IV and detects tampering', () => {
    const a = crypto.encrypt('secret', 'uid1');
    const b = crypto.encrypt('secret', 'uid1');
    expect(a).not.toBe(b);
    const parts = a.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => crypto.decrypt(parts.join('.'), 'uid1')).toThrow();
  });

  it('rejects expired state', () => {
    const s = crypto.signState({ uid: 'u' }, -1);
    expect(crypto.verifyState(s)).toBeNull();
  });
});

describe('Session and account security', () => {
  beforeEach(() => mockDb.reset());

  it('logout revokes the session server-side', async () => {
    const token = 'Bearer token_user_logouttest';
    expect((await request(app).get('/api/users/me').set('Authorization', token)).status).toBe(200);
    expect((await request(app).post('/api/users/me/logout').set('Authorization', token)).status).toBe(204);
    const after = await request(app).get('/api/users/me').set('Authorization', token);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('admin can deactivate and reactivate an account; deactivated users are locked out', async () => {
    const token = 'Bearer token_user_deactivateme';
    await request(app).get('/api/users/me').set('Authorization', token);

    const off = await request(app).post('/api/admin/users/user_deactivateme/status').set('Authorization', ADMIN).send({ active: false });
    expect(off.status).toBe(200);
    expect(off.body.data.account_status).toBe('deactivated');
    expect(mockAuth.accounts.user_deactivateme.disabled).toBe(true);

    const blocked = await request(app).get('/api/users/me').set('Authorization', token);
    expect(blocked.status).toBe(401);

    const on = await request(app).post('/api/admin/users/user_deactivateme/status').set('Authorization', ADMIN).send({ active: true });
    expect(on.body.data.account_status).toBe('active');
    expect(mockAuth.accounts.user_deactivateme.disabled).toBe(false);
  });

  it('prevents self-deactivation and non-admin access', async () => {
    const self = await request(app).post('/api/admin/users/admin_001/status').set('Authorization', ADMIN).send({ active: false });
    expect(self.status).toBe(400);
    const patient = await request(app).post('/api/admin/users/admin_001/status').set('Authorization', PATIENT).send({ active: false });
    expect(patient.status).toBe(403);
  });

  it('sets strict security headers on API responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

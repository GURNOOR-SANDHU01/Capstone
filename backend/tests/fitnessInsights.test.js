/**
 * Fitness analysis: pure engine + insights endpoint, alert pipeline, background sync,
 * journal biometrics, and the doctor view's privacy boundary.
 */
const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({ firebaseApp: {}, auth: mockAuth, db: mockDb }));
jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const { analyze, moodByDate, pearson, shiftDate } = require('../src/services/fitness/fitnessInsights');

const TODAY = '2026-11-21';
const day = (offset, fields) => ({ date: shiftDate(TODAY, -offset), steps: null, active_minutes: null, calories: null, heart_rate_avg: null, sleep_minutes: null, ...fields });

describe('fitness analysis engine', () => {
  it('computes period-over-period trends, best day and streaks', () => {
    const days = [];
    for (let i = 0; i < 14; i += 1) days.push(day(i, { steps: 8000, sleep_minutes: 450 })); // current 14
    for (let i = 14; i < 28; i += 1) days.push(day(i, { steps: 4000, sleep_minutes: 450 })); // previous 14
    days[0].steps = 12000;
    const r = analyze({ days, today: TODAY, periodDays: 14 });
    expect(r.trends.steps.change_pct).toBeGreaterThan(90);
    expect(r.trends.steps.best).toEqual({ date: TODAY, value: 12000 });
    expect(r.streaks.step_goal.current).toBe(14);
    expect(r.streaks.sleep_goal.current).toBe(14);
    expect(r.insights.some((i) => i.kind === 'trend' && /rose/.test(i.text))).toBe(true);
  });

  it('treats 0 steps and missing days as no data (not as zero)', () => {
    const days = [day(0, { steps: 0 }), day(1, { steps: 9000 }), day(2, {}), day(3, { steps: 9000 })];
    const r = analyze({ days, today: TODAY, periodDays: 7 });
    expect(r.trends.steps.days_with_data).toBe(2);
    expect(r.trends.steps.avg).toBeNull(); // fewer than 3 days with data -> no average
    expect(r.streaks.step_goal.current).toBe(2);
  });

  it('links sleep and mood only with enough paired days, and says it is not causal', () => {
    const days = [];
    const mood = {};
    for (let i = 0; i < 10; i += 1) {
      const good = i % 2 === 0;
      days.push(day(i, { sleep_minutes: good ? 480 : 300, steps: 5000 + i * 100 }));
      mood[shiftDate(TODAY, -i)] = good ? 80 : 40;
    }
    const r = analyze({ days, mood, today: TODAY, periodDays: 14 });
    const sleep = r.mood_links.links.find((l) => l.metric === 'sleep_minutes');
    expect(sleep.strength).toBe('strong');
    expect(sleep.groups).toMatchObject({ high_mood: 80, low_mood: 40 });
    const text = r.insights.find((i) => i.kind === 'mood_link').text;
    expect(text).toMatch(/40 points higher/);
    expect(text).toMatch(/not proof of cause/);

    const few = analyze({ days, mood: { [TODAY]: 50 }, today: TODAY, periodDays: 14 });
    expect(few.mood_links.available).toBe(false);
    expect(few.mood_links.reason).toBe('not_enough_journal_days');
  });

  it('flags short-sleep streaks and escalates when mood is also low', () => {
    const days = [day(0, { sleep_minutes: 240 }), day(1, { sleep_minutes: 250 }), day(2, { sleep_minutes: 260 }), day(3, { sleep_minutes: 480 })];
    const calm = analyze({ days, today: TODAY });
    expect(calm.alerts).toEqual([expect.objectContaining({ type: 'short_sleep_streak', severity: 'low', value: 3 })]);

    const mood = Object.fromEntries([0, 1, 2].map((i) => [shiftDate(TODAY, -i), 20]));
    const low = analyze({ days, mood, today: TODAY });
    expect(low.alerts[0]).toMatchObject({ severity: 'moderate', with_low_mood: true });
  });

  it('flags a week-over-week activity drop and elevated heart rate', () => {
    const days = [];
    for (let i = 0; i < 7; i += 1) days.push(day(i, { steps: 2000, heart_rate_avg: 85 }));
    for (let i = 7; i < 28; i += 1) days.push(day(i, { steps: 8000, heart_rate_avg: 70 }));
    const types = analyze({ days, today: TODAY }).alerts.map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(['activity_drop', 'elevated_heart_rate']));
  });

  it('derives daily mood from journal entries, preferring the self-reported mood', () => {
    const m = moodByDate([
      { entry_date: '2026-11-20', detected_emotions: { sentiment_score: 1, corrected_emotion: 'Sad' } },
      { entry_date: '2026-11-20', detected_emotions: { sentiment_score: 0 } },
      { entry_date: '2026-11-19', detected_emotions: { sentiment_score: -1 } }
    ]);
    expect(m).toEqual({ '2026-11-20': 35, '2026-11-19': 0 });
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });

  it('returns a helpful message when there is no data', () => {
    const r = analyze({ days: [], today: TODAY });
    expect(r.insights).toEqual([expect.objectContaining({ kind: 'info' })]);
    expect(r.period.days_with_data).toBe(0);
  });
});

describe('insights, alerts and background sync (integration)', () => {
  const app = require('../src/app');
  const googleFitService = require('../src/services/fitness/googleFitService');
  const realClient = require('../src/services/fitness/googleFitClient');
  const PATIENT = 'Bearer token_user_insightpatient';
  const UID = 'user_insightpatient';
  const iso = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

  const shortSleepDays = () =>
    Array.from({ length: 7 }, (_, i) => ({
      date: iso(i), steps: 3000, active_minutes: 10, calories: 1800, heart_rate_avg: 72, heart_rate_min: 55, heart_rate_max: 120,
      sleep_minutes: i < 5 ? 240 : 480 // 5 short nights in a row
    }));

  async function connectAndSync() {
    const start = await request(app).post('/api/google-fit/connect').set('Authorization', PATIENT);
    const state = new URL(start.body.data.auth_url).searchParams.get('state');
    await request(app).get('/api/google-fit/oauth/callback').query({ code: 'c', state });
    return request(app).post('/api/google-fit/sync').set('Authorization', PATIENT).send({ days: 7 });
  }

  beforeEach(() => {
    mockDb.reset();
    googleFitService.accessTokens.clear();
    googleFitService.client = {
      SCOPES: realClient.SCOPES,
      isConfigured: () => true,
      buildAuthUrl: (state) => `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`,
      exchangeCode: async () => ({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600e3, scopes: [...realClient.SCOPES] }),
      refreshAccessToken: async () => ({ accessToken: 'a2', expiresAt: Date.now() + 3600e3 }),
      revokeToken: async () => {},
      fetchDailyMetrics: jest.fn(async () => ({ days: shortSleepDays(), errors: [] }))
    };
  });

  it('GET /insights returns trends, alerts and plain-language insights', async () => {
    await connectAndSync();
    const res = await request(app).get('/api/google-fit/insights?days=7').set('Authorization', PATIENT);
    expect(res.status).toBe(200);
    expect(res.body.data.alerts[0]).toMatchObject({ type: 'short_sleep_streak', severity: 'moderate' });
    expect(res.body.data.insights[0].text).toMatch(/5 nights in a row/);
    const bad = await request(app).get('/api/google-fit/insights?days=13').set('Authorization', PATIENT);
    expect(bad.status).toBe(400);
  });

  it('raises a moderate wellbeing alert into the safety pipeline once per week', async () => {
    await connectAndSync();
    const alerts = () => Object.values(mockDb.store.red_flag_alert_logs || {}).filter((a) => a.user_id === UID);
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0].alert_type).toBe('wellbeing_short_sleep_streak');

    await googleFitService.syncAllDue({ maxAgeMs: 0 }); // another sync, same pattern
    expect(alerts()).toHaveLength(1);
  });

  it('background sync refreshes connected accounts that are due', async () => {
    await connectAndSync();
    const calls = googleFitService.client.fetchDailyMetrics.mock.calls.length;
    expect((await googleFitService.syncAllDue({ maxAgeMs: 6 * 3600e3 })).synced).toBe(0); // just synced
    expect((await googleFitService.syncAllDue({ maxAgeMs: 0 })).synced).toBe(1);
    expect(googleFitService.client.fetchDailyMetrics.mock.calls.length).toBe(calls + 1);
  });

  it('attaches the latest synced sleep/steps to new journal entries', async () => {
    await connectAndSync();
    const res = await request(app).post('/api/journal-entries').set('Authorization', PATIENT).send({ content: 'Tired today.' });
    expect(res.status).toBe(201);
    expect(res.body.data.biometrics).toMatchObject({ sleep_hours: 4, steps: 3000 });
  });

  it('doctor insights use only SHARED journal entries', async () => {
    await connectAndSync();
    // 6 private entries with very low mood: must not reach the doctor
    for (let i = 0; i < 6; i += 1) {
      await request(app).post('/api/journal-entries').set('Authorization', PATIENT)
        .send({ content: 'private', entry_date: iso(i), self_reported_emotion: 'Sad', visibility: 'private' });
    }
    await request(app).post('/api/consent/therapist').set('Authorization', PATIENT)
      .send({ therapist_id: 'therapist_001_dr_sharma', access_level: 'full_reflection_access' });

    const doc = await request(app).get(`/api/patients/${UID}/wellness-summary?days=7`).set('Authorization', 'Bearer therapist_token');
    expect(doc.status).toBe(200);
    expect(doc.body.data.analysis.mood_source).toBe('shared journal entries only');
    expect(doc.body.data.analysis.mood_links.available).toBe(false);
    expect(doc.body.data.analysis.alerts.every((a) => !a.with_low_mood)).toBe(true);

    const own = await request(app).get('/api/google-fit/insights?days=7').set('Authorization', PATIENT);
    expect(own.body.data.recent_mood).toBe(20); // the patient sees their own private mood
  });
});

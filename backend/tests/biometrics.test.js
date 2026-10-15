const request = require('supertest');
const { mockDb, mockAuth, mockTimestamp } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('Biometric Synchronization Endpoints', () => {
  const token = 'Bearer token_user_bio_tester';

  beforeEach(() => {
    mockDb.reset();
  });

  it('POST /api/biometrics/sync should record a sync attempt and return metrics', async () => {
    const res = await request(app)
      .post('/api/biometrics/sync')
      .set('Authorization', token)
      .send({
        provider: 'google_fit',
        metrics: {
          resting_hr: 72,
          hr_variability: 45,
          sleep_hours: 7.5,
          stress_level: 4
        },
        date_range: 'last 24 hours'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sync.provider).toBe('google_fit');
    expect(res.body.data.sync.status).toBe('success');
    expect(res.body.data.metrics.resting_hr).toBe(72);
  });

  it('GET /api/biometrics should list sync logs for authenticated user', async () => {
    // Sync Google Fit
    await request(app)
      .post('/api/biometrics/sync')
      .set('Authorization', token)
      .send({
        provider: 'google_fit',
        metrics: { resting_hr: 70 }
      });

    // Fetch logs
    const res = await request(app)
      .get('/api/biometrics')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].provider).toBe('google_fit');
    expect(res.body.data[0].user_id).toBe('user_bio_tester');
  });

  it('POST /api/biometrics/sync should reject unsupported provider', async () => {
    const res = await request(app)
      .post('/api/biometrics/sync')
      .set('Authorization', token)
      .send({
        provider: 'fitbit_unsupported'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

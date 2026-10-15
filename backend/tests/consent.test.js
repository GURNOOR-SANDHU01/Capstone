const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('Consent & Therapist Access Controls', () => {
  const patientToken = 'Bearer token_user_patient_priya';
  const therapistToken = 'Bearer therapist_token'; // therapist_001_dr_sharma

  beforeEach(() => {
    mockDb.reset();
  });

  it('Therapist should NOT access patient journal without consent (403)', async () => {
    // Patient creates a journal entry
    const entryRes = await request(app)
      .post('/api/journal-entries')
      .set('Authorization', patientToken)
      .send({ content: 'Confidential patient thoughts' });

    const entryId = entryRes.body.data.id;

    // Therapist attempts to read entry
    const res = await request(app)
      .get(`/api/journal-entries/${entryId}`)
      .set('Authorization', therapistToken);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Patient should grant consent, creating bridge and immutable audit log', async () => {
    const grantRes = await request(app)
      .post('/api/consent/therapist')
      .set('Authorization', patientToken)
      .send({
        therapist_id: 'therapist_001_dr_sharma',
        access_level: 'longitudinal_summary_only',
        red_flag_alerts_enabled: true
      });

    expect(grantRes.status).toBe(201);
    expect(grantRes.body.success).toBe(true);
    expect(grantRes.body.data.bridge.consent_granted).toBe(true);
    expect(grantRes.body.data.auditLogId).toBeDefined();

    // Verify GET /api/consent includes bridge and audit log
    const getRes = await request(app)
      .get('/api/consent')
      .set('Authorization', patientToken);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.activeBridges.length).toBe(1);
    expect(getRes.body.data.auditHistory.length).toBe(1);
    expect(getRes.body.data.auditHistory[0].action).toBe('granted');
  });

  it('Therapist should access patient journal AFTER consent is granted', async () => {
    // Patient creates entry
    const entryRes = await request(app)
      .post('/api/journal-entries')
      .set('Authorization', patientToken)
      .send({ content: 'Session prep journal entry', visibility: 'shared' });

    const entryId = entryRes.body.data.id;

    // Patient grants consent (default access level: longitudinal_summary_only)
    await request(app)
      .post('/api/consent/therapist')
      .set('Authorization', patientToken)
      .send({ therapist_id: 'therapist_001_dr_sharma' });

    // Therapist reads entry
    const readRes = await request(app)
      .get(`/api/journal-entries/${entryId}`)
      .set('Authorization', therapistToken);

    expect(readRes.status).toBe(200);
    expect(readRes.body.success).toBe(true);
    expect(readRes.body.data.id).toBe(entryId);
    // Summary-only consent never exposes the journal text
    expect(readRes.body.data.access).toBe('summary');
    expect(readRes.body.data.masked_content).toBeUndefined();
  });

  it('Revoking consent must prevent future therapist access', async () => {
    // Patient creates entry
    const entryRes = await request(app)
      .post('/api/journal-entries')
      .set('Authorization', patientToken)
      .send({ content: 'Journal for monitored period' });

    const entryId = entryRes.body.data.id;

    // Grant consent
    await request(app)
      .post('/api/consent/therapist')
      .set('Authorization', patientToken)
      .send({ therapist_id: 'therapist_001_dr_sharma' });

    // Revoke consent
    const revokeRes = await request(app)
      .delete('/api/consent/therapist')
      .set('Authorization', patientToken)
      .send({ therapist_id: 'therapist_001_dr_sharma' });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.status).toBe('revoked');

    // Therapist tries to read entry again -> 403
    const blockedRes = await request(app)
      .get(`/api/journal-entries/${entryId}`)
      .set('Authorization', therapistToken);

    expect(blockedRes.status).toBe(403);
  });
});

const request = require('supertest');
const { mockDb, mockAuth, mockTimestamp } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('Safety Alerts & Therapist Review Authorization', () => {
  const userToken = 'Bearer token_user_alert_patient';
  const therapistToken = 'Bearer therapist_token'; // therapist_001_dr_sharma

  beforeEach(() => {
    mockDb.reset();
  });

  it('GET /api/safety-alerts should list alerts for patient', async () => {
    // Directly seed an alert into mockDb
    await mockDb.collection('red_flag_alert_logs').add({
      user_id: 'user_alert_patient',
      therapist_id: 'therapist_001_dr_sharma',
      alert_type: 'sustained_emotional_decline',
      severity: 'high',
      trigger_reason: 'High anxiety detected across consecutive days',
      alert_status: 'pending',
      triggered_at: mockTimestamp.now()
    });

    const res = await request(app)
      .get('/api/safety-alerts')
      .set('Authorization', userToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].alert_type).toBe('sustained_emotional_decline');
  });

  it('PATCH /api/safety-alerts/:id should allow authorized therapist to update status to viewed/resolved', async () => {
    // The patient must still consent to red-flag alerts from this doctor
    await mockDb.collection('therapist_bridges').add({
      user_id: 'user_alert_patient',
      therapist_id: 'therapist_001_dr_sharma',
      consent_granted: true,
      access_level: 'longitudinal_summary_only',
      red_flag_alerts_enabled: true
    });
    const docRef = await mockDb.collection('red_flag_alert_logs').add({
      user_id: 'user_alert_patient',
      therapist_id: 'therapist_001_dr_sharma',
      alert_type: 'sustained_emotional_decline',
      severity: 'high',
      trigger_reason: 'Anxiety spike',
      alert_status: 'pending',
      triggered_at: mockTimestamp.now()
    });

    const updateRes = await request(app)
      .patch(`/api/safety-alerts/${docRef.id}`)
      .set('Authorization', therapistToken)
      .send({
        alert_status: 'resolved',
        therapist_action_taken: 'Discussed coping strategies during Tuesday consultation.'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.alert_status).toBe('resolved');
    expect(updateRes.body.data.therapist_action_taken).toContain('Tuesday consultation');
  });

  it('PATCH /api/safety-alerts/:id should reject regular user (requires therapist role)', async () => {
    const docRef = await mockDb.collection('red_flag_alert_logs').add({
      user_id: 'user_alert_patient',
      therapist_id: 'therapist_001_dr_sharma',
      alert_status: 'pending',
      triggered_at: mockTimestamp.now()
    });

    const res = await request(app)
      .patch(`/api/safety-alerts/${docRef.id}`)
      .set('Authorization', userToken)
      .send({ alert_status: 'resolved' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

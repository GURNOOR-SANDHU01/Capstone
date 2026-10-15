const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('AI Model Analysis Endpoints', () => {
  const token = 'Bearer valid_user_token';

  it('POST /api/analysis/emotions should return 28 emotion states and primary emotion', async () => {
    const res = await request(app)
      .post('/api/analysis/emotions')
      .set('Authorization', token)
      .send({
        content: 'I feel anxious and worried about my final presentations.',
        input_source: 'text'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.primary_state).toBe('nervousness');
    expect(res.body.data.all_28_states).toBeDefined();
    expect(res.body.data.provenance.is_mock).toBe(true);
  });

  it('POST /api/analysis/intent should detect triggers and coping strategies', async () => {
    const res = await request(app)
      .post('/api/analysis/intent')
      .set('Authorization', token)
      .send({
        content: 'Facing severe project deadlines at work, but taking a walk helped.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.intent).toBe('work_stress');
    expect(res.body.data.triggers).toContain('deadline_pressure');
    expect(res.body.data.coping_attempts).toContain('walking');
  });

  it('POST /api/analysis/safety should evaluate distress without making clinical diagnosis', async () => {
    const res = await request(app)
      .post('/api/analysis/safety')
      .set('Authorization', token)
      .send({
        content: 'I had a quiet day reading a book.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.severity_flag).toBe('normal');
    expect(res.body.data.red_zone_triggered).toBe(false);
    expect(res.body.data.provenance.disclaimer).toContain('not a clinical diagnosis');
  });

  it('POST /api/analysis/reflection should generate CBT exploration prompt', async () => {
    const res = await request(app)
      .post('/api/analysis/reflection')
      .set('Authorization', token)
      .send({
        content: 'I am overwhelmed and do not know where to start.',
        sentiment_score: -0.6
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.prompt_text).toBeDefined();
    expect(res.body.data.cbt_technique_used).toBeDefined();
  });
});

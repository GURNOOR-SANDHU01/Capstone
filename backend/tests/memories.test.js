const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('Memories & Feedback Operations', () => {
  const userToken = 'Bearer token_user_mem_tester';
  const otherToken = 'Bearer token_user_other';

  beforeEach(() => {
    mockDb.reset();
  });

  it('POST /api/memories should create an extracted memory', async () => {
    const res = await request(app)
      .post('/api/memories')
      .set('Authorization', userToken)
      .send({
        memory_text: 'Deep breathing during morning commute reduces stress.',
        memory_type: 'coping_pattern',
        importance_score: 0.8
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.memory_text).toBe('Deep breathing during morning commute reduces stress.');
    expect(res.body.data.user_id).toBe('user_mem_tester');
  });

  it('GET /api/memories should list memories for authenticated user only', async () => {
    await request(app)
      .post('/api/memories')
      .set('Authorization', userToken)
      .send({ memory_text: 'User memory 1', memory_type: 'coping_pattern' });

    const res = await request(app)
      .get('/api/memories')
      .set('Authorization', userToken);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
  });

  it('POST /api/memories/:id/feedback should record feedback and boost importance score', async () => {
    const memRes = await request(app)
      .post('/api/memories')
      .set('Authorization', userToken)
      .send({
        memory_text: 'Listening to music helps after disputes.',
        memory_type: 'coping_pattern',
        importance_score: 0.7
      });

    const memoryId = memRes.body.data.id;

    // Submit agree feedback
    const fbRes = await request(app)
      .post(`/api/memories/${memoryId}/feedback`)
      .set('Authorization', userToken)
      .send({
        user_feedback: 'agree',
        user_notes: 'Accurate, I do this regularly'
      });

    expect(fbRes.status).toBe(200);
    expect(fbRes.body.success).toBe(true);
    expect(fbRes.body.data.feedback.user_feedback).toBe('agree');
    expect(fbRes.body.data.updatedImportanceScore).toBeCloseTo(0.75); // 0.70 + 0.05 boost
  });

  it('POST /api/memories/:id/feedback should reject other user feedback attempt', async () => {
    const memRes = await request(app)
      .post('/api/memories')
      .set('Authorization', userToken)
      .send({ memory_text: 'Private coping pattern', memory_type: 'coping_pattern' });

    const memoryId = memRes.body.data.id;

    const res = await request(app)
      .post(`/api/memories/${memoryId}/feedback`)
      .set('Authorization', otherToken)
      .send({ user_feedback: 'disagree' });

    expect(res.status).toBe(403);
  });
});

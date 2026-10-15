const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('CBT Reflection Prompts & Responses', () => {
  const userToken = 'Bearer token_user_ref_tester';

  beforeEach(() => {
    mockDb.reset();
  });

  it('POST /api/reflection-prompts should create a CBT prompt', async () => {
    const res = await request(app)
      .post('/api/reflection-prompts')
      .set('Authorization', userToken)
      .send({
        prompt_text: 'What thoughts arose when the deadline was moved up?',
        prompt_type: 'cbt_clarification',
        cbt_technique_used: 'cognitive_exploration'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.prompt_text).toBe('What thoughts arose when the deadline was moved up?');
  });

  it('PATCH /api/reflection-prompts/:id should record response and helpfulness rating', async () => {
    const createRes = await request(app)
      .post('/api/reflection-prompts')
      .set('Authorization', userToken)
      .send({
        prompt_text: 'What assumption did you make about the meeting?',
        prompt_type: 'cbt_cognitive_reframing'
      });

    const promptId = createRes.body.data.id;

    const patchRes = await request(app)
      .patch(`/api/reflection-prompts/${promptId}`)
      .set('Authorization', userToken)
      .send({
        user_response: 'I assumed my manager was displeased when she was just busy.',
        was_helpful: true,
        helpful_rating: 5
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.data.user_response).toContain('manager was displeased');
    expect(patchRes.body.data.helpful_rating).toBe(5);
    expect(patchRes.body.data.was_helpful).toBe(true);
  });
});

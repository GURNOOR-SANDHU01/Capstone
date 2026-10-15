const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('Journal Entries & Cross-User Security', () => {
  const userAToken = 'Bearer token_user_alice';
  const userBToken = 'Bearer token_user_bob';

  beforeEach(() => {
    mockDb.reset();
  });

  it('POST /api/journal-entries should create an entry with PII scrubbed and AI models evaluated', async () => {
    const res = await request(app)
      .post('/api/journal-entries')
      .set('Authorization', userAToken)
      .send({
        content: 'I felt overwhelmed by deadlines today. My email is alice@work.com and phone is 555-123-4567.',
        input_source: 'text',
        extracted_themes: ['deadlines', 'work']
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user_id).toBe('user_alice');
    // Verify Presidio PII scrub
    expect(res.body.data.masked_content).toContain('<EMAIL>');
    expect(res.body.data.masked_content).toContain('<PHONE_NUMBER>');
    expect(res.body.data.masked_content).not.toContain('alice@work.com');
    // Verify AI model evaluation
    expect(res.body.data.detected_emotions).toBeDefined();
    expect(res.body.data.intent_object).toBeDefined();
    expect(res.body.data.reflection_prompt).toBeDefined();
    expect(res.body.data.safety_flags).toBeDefined();
  });

  it('GET /api/journal-entries should list only authenticated user entries with pagination', async () => {
    // Create entry for Alice
    await request(app)
      .post('/api/journal-entries')
      .set('Authorization', userAToken)
      .send({ content: 'Alice entry 1' });

    // Create entry for Bob
    await request(app)
      .post('/api/journal-entries')
      .set('Authorization', userBToken)
      .send({ content: 'Bob entry 1' });

    // Alice fetches her entries
    const resAlice = await request(app)
      .get('/api/journal-entries?page=1&limit=10')
      .set('Authorization', userAToken);

    expect(resAlice.status).toBe(200);
    expect(resAlice.body.success).toBe(true);
    expect(resAlice.body.data.length).toBe(1);
    expect(resAlice.body.data[0].user_id).toBe('user_alice');
    expect(resAlice.body.pagination).toBeDefined();
    expect(resAlice.body.pagination.page).toBe(1);
  });

  it('GET /api/journal-entries/:id should block cross-user access without consent', async () => {
    // Create entry for Alice
    const createRes = await request(app)
      .post('/api/journal-entries')
      .set('Authorization', userAToken)
      .send({ content: 'Alice private thoughts' });

    const aliceEntryId = createRes.body.data.id;

    // Bob tries to read Alice entry
    const resBob = await request(app)
      .get(`/api/journal-entries/${aliceEntryId}`)
      .set('Authorization', userBToken);

    expect(resBob.status).toBe(403);
    expect(resBob.body.success).toBe(false);
    expect(resBob.body.error.code).toBe('FORBIDDEN');
  });

  it('PATCH /api/journal-entries/:id should update entry for owner', async () => {
    const createRes = await request(app)
      .post('/api/journal-entries')
      .set('Authorization', userAToken)
      .send({ content: 'Initial entry text' });

    const entryId = createRes.body.data.id;

    const patchRes = await request(app)
      .patch(`/api/journal-entries/${entryId}`)
      .set('Authorization', userAToken)
      .send({
        reflection_prompt: {
          user_response: 'It helped me reframe my expectations.',
          was_helpful: true
        }
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.data.reflection_prompt.user_response).toBe('It helped me reframe my expectations.');
    expect(patchRes.body.data.reflection_prompt.was_helpful).toBe(true);
  });

  it('DELETE /api/journal-entries/:id should delete entry for owner and reject other users', async () => {
    const createRes = await request(app)
      .post('/api/journal-entries')
      .set('Authorization', userAToken)
      .send({ content: 'Entry to be deleted' });

    const entryId = createRes.body.data.id;

    // Bob tries to delete Alice entry
    const failRes = await request(app)
      .delete(`/api/journal-entries/${entryId}`)
      .set('Authorization', userBToken);

    expect(failRes.status).toBe(403);

    // Alice deletes her own entry
    const successRes = await request(app)
      .delete(`/api/journal-entries/${entryId}`)
      .set('Authorization', userAToken);

    expect(successRes.status).toBe(200);
    expect(successRes.body.success).toBe(true);
  });
});

const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('User Profile CRUD Operations', () => {
  const token = 'Bearer token_user_test_profile';

  beforeEach(() => {
    mockDb.reset();
  });

  it('GET /api/users/me should auto-initialize user profile if not found', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('user_test_profile');
    expect(res.body.data.preferences).toBeDefined();
    expect(res.body.data.structured_memory).toBeDefined();
    expect(res.body.data.resilience_streaks).toBeDefined();
  });

  it('PATCH /api/users/me should update permitted fields', async () => {
    // Initial fetch to create
    await request(app).get('/api/users/me').set('Authorization', token);

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', token)
      .send({
        full_name: 'Updated Name',
        preferences: {
          theme: 'light',
          cbt_alignment: false
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('Updated Name');
    expect(res.body.data.preferences.theme).toBe('light');
    expect(res.body.data.preferences.cbt_alignment).toBe(false);
  });

  it('PATCH /api/users/me should reject protected fields modification', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', token)
      .send({
        role: 'admin'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('DELETE /api/users/me should require explicit confirmation', async () => {
    const res = await request(app)
      .delete('/api/users/me')
      .set('Authorization', token)
      .send({ confirm: false });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('DELETE /api/users/me should delete user account when confirmed', async () => {
    // Seed user and journal entry
    await request(app).get('/api/users/me').set('Authorization', token);

    const deleteRes = await request(app)
      .delete('/api/users/me')
      .set('Authorization', token)
      .send({ confirm: true, reason: 'Testing account deletion' });

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.data.message).toContain('successfully purged');
  });
});

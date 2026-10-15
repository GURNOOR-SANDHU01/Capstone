const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({
  firebaseApp: {},
  auth: mockAuth,
  db: mockDb
}));

jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

describe('Health Endpoints', () => {
  it('GET /api/health should return minimal server health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.service).toBe('sentience-backend');
    expect(res.body.data).not.toHaveProperty('secret');
  });

  it('GET /api/health/firebase should return Firestore connectivity status', async () => {
    const res = await request(app).get('/api/health/firebase');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.firebase.projectId).toBe('sentience-6f40e');
  });

  it('GET /api/health/model should return AI model adapter health', async () => {
    const res = await request(app).get('/api/health/model');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });
});

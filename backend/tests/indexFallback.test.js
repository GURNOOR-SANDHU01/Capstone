/**
 * Live Firestore without deployed composite indexes: every query that combines a filter with
 * orderBy fails with FAILED_PRECONDITION (code 9). Pages must still work via the in-memory
 * fallback (src/repositories/indexedQuery.js), with correct filtering, sorting and paging.
 */
const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({ firebaseApp: {}, auth: mockAuth, db: mockDb }));
jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');
const { pagedQuery, sortValue } = require('../src/repositories/indexedQuery');

const PATIENT = 'Bearer token_user_noindex';
const DOCTOR = 'Bearer therapist_token';

// Reproduce "The query requires an index" for composite queries only
const QueryProto = Object.getPrototypeOf(mockDb.collection('probe').where('a', '==', 1));
const realGet = QueryProto.get;
function simulateMissingIndexes() {
  return jest.spyOn(QueryProto, 'get').mockImplementation(function get() {
    const composite = this.order && (this.filters || []).length > 0;
    if (composite) {
      const err = new Error('9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/...');
      err.code = 9;
      return Promise.reject(err);
    }
    return realGet.call(this);
  });
}

describe('pages work on a Firestore without composite indexes', () => {
  let spy;
  beforeEach(() => {
    mockDb.reset();
    spy = simulateMissingIndexes();
  });
  afterEach(() => spy.mockRestore());

  it('the simulation really rejects indexed queries (sanity check)', async () => {
    await expect(mockDb.collection('memories').where('user_id', '==', 'x').orderBy('created_at', 'desc').get())
      .rejects.toMatchObject({ code: 9 });
  });

  it('journal list: newest first, date filters and paging still work', async () => {
    for (const [i, date] of ['2026-11-01', '2026-11-10', '2026-11-20'].entries()) {
      await request(app).post('/api/journal-entries').set('Authorization', PATIENT).send({ content: `entry ${i}`, entry_date: date });
      await new Promise((r) => setTimeout(r, 1100)); // distinct created_at seconds
    }
    const all = await request(app).get('/api/journal-entries').set('Authorization', PATIENT);
    expect(all.status).toBe(200);
    expect(all.body.data.map((e) => e.masked_content)).toEqual(['entry 2', 'entry 1', 'entry 0']);

    const ranged = await request(app).get('/api/journal-entries?startDate=2026-11-05&endDate=2026-11-15').set('Authorization', PATIENT);
    expect(ranged.body.data.map((e) => e.masked_content)).toEqual(['entry 1']);

    const page2 = await request(app).get('/api/journal-entries?limit=2&page=2').set('Authorization', PATIENT);
    expect(page2.body.data.map((e) => e.masked_content)).toEqual(['entry 0']);
    expect(page2.body.pagination.hasMore).toBe(false);
  }, 15000);

  it('Mood & Insights memories, Care team access (consent) and reflections load', async () => {
    await request(app).post('/api/journal-entries').set('Authorization', PATIENT).send({ content: 'Deadlines at work again, went for a walk.' });
    await request(app).post('/api/consent/therapist').set('Authorization', PATIENT).send({ therapist_id: 'therapist_001_dr_sharma' });

    const memories = await request(app).get('/api/memories').set('Authorization', PATIENT);
    expect(memories.status).toBe(200);
    expect(memories.body.data.length).toBeGreaterThan(0);

    const consent = await request(app).get('/api/consent').set('Authorization', PATIENT);
    expect(consent.status).toBe(200);

    const reflections = await request(app).get('/api/reflection-prompts').set('Authorization', PATIENT);
    expect(reflections.status).toBe(200);
  });

  it('safety alerts for patients and doctors load', async () => {
    await request(app).post('/api/consent/therapist').set('Authorization', PATIENT)
      .send({ therapist_id: 'therapist_001_dr_sharma', red_flag_alerts_enabled: true });
    await request(app).post('/api/journal-entries').set('Authorization', PATIENT).send({ content: 'I want to end my life' });

    const doc = await request(app).get('/api/safety-alerts').set('Authorization', DOCTOR);
    expect(doc.status).toBe(200);
    expect(doc.body.data.length).toBeGreaterThan(0);
  });

  it('other database errors are not swallowed', async () => {
    spy.mockImplementation(() => Promise.reject(Object.assign(new Error('unavailable'), { code: 14 })));
    const res = await request(app).get('/api/memories').set('Authorization', PATIENT);
    expect(res.status).toBe(500);
  });
});

describe('pagedQuery helper', () => {
  it('sorts mixed timestamp shapes and applies range filters in memory', async () => {
    const rows = [
      { id: 'a', v: 5, t: { _seconds: 100 } },
      { id: 'b', v: 1, t: { seconds: 300 } },
      { id: 'c', v: 9, t: '1970-01-01T00:03:20Z' } // 200 s
    ];
    const fakeQuery = {
      where() { return this; },
      orderBy() { return { limit: () => ({ offset: () => ({ get: () => Promise.reject(Object.assign(new Error('x'), { code: 'FAILED_PRECONDITION' })) }) }) }; },
      limit() { return { get: async () => ({ docs: rows.map((r) => ({ id: r.id, exists: true, data: () => r })) }) }; }
    };
    const r = await pagedQuery({ collection: fakeQuery, equality: { user: 'u' }, ranges: [{ field: 'v', op: '>=', value: 2 }], orderBy: { field: 't' }, limit: 10, label: 't' });
    expect(r.indexFallback).toBe(true);
    expect(r.items.map((x) => x.id)).toEqual(['c', 'a']);
    expect(sortValue({ toMillis: () => 42 })).toBe(42);
  });
});

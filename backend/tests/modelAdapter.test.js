/**
 * Contract between the backend and an external AI/model service (HttpModelAdapter).
 * Uses a fake adapter; no network access.
 */
jest.mock('../src/config/firebase/admin', () => {
  const { mockDb: db, mockAuth: auth } = require('./mocks/firebaseAdminMock');
  return { firebaseApp: {}, auth, db };
});
jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const { ModelService } = require('../src/services/modelService');

const validEmotions = { primary_state: 'joy', confidence: 0.9, sentiment_score: 0.8, all_28_states: { joy: 0.9 } };
const validSafety = { severity_flag: 'normal', red_zone_triggered: false, crisis_language_detected: false };

function fakeAdapter(overrides = {}) {
  return {
    healthCheck: async () => ({ status: 'healthy' }),
    analyzeEmotions: async () => validEmotions,
    analyzeIntent: async () => ({ intent: 'general_reflection', triggers: [] }),
    analyzeSafety: async () => validSafety,
    generateReflection: async () => ({ prompt_text: 'External prompt?' }),
    extractMemories: async () => [{ text: 'pattern', type: 'coping_pattern', score: 0.7 }],
    ...overrides
  };
}

describe('Model service contract', () => {
  it('accepts bare results and results wrapped in the API envelope', async () => {
    const bare = new ModelService(fakeAdapter());
    expect((await bare.analyzeEmotions('hi')).primary_state).toBe('joy');

    const wrapped = new ModelService(
      fakeAdapter({ analyzeEmotions: async () => ({ success: true, data: validEmotions }) })
    );
    expect((await wrapped.analyzeEmotions('hi')).primary_state).toBe('joy');
    expect((await wrapped.generateReflection('hi')).prompt_text).toBe('External prompt?');
  });

  it('falls back to built-in analysis when the service errors or times out', async () => {
    const svc = new ModelService(
      fakeAdapter({
        analyzeEmotions: async () => {
          throw new Error('ECONNREFUSED');
        }
      })
    );
    const res = await svc.analyzeEmotions('I feel happy today');
    expect(res.provenance).toMatchObject({ adapter: 'fallback', fallback_reason: 'upstream_error' });
    expect(typeof res.sentiment_score).toBe('number');
  });

  it('falls back when the service returns a result that breaks the contract', async () => {
    const svc = new ModelService(fakeAdapter({ analyzeSafety: async () => ({ severity: 'ok' }) }));
    const res = await svc.analyzeSafety('fine day', validEmotions, null);
    expect(res.severity_flag).toBe('normal');
    expect(res.provenance.fallback_reason).toBe('invalid_response');
  });

  it('never reports crisis language as less than high severity', async () => {
    const svc = new ModelService(fakeAdapter()); // the external model says "normal"
    const res = await svc.analyzeSafety('I want to end my life', validEmotions, null);
    expect(res).toMatchObject({ severity_flag: 'high', crisis_language_detected: true, red_zone_triggered: true });
  });

  it('validates memory extraction arrays', async () => {
    const svc = new ModelService(fakeAdapter({ extractMemories: async () => [{ text: 'x' }] }));
    const res = await svc.extractMemories('work deadline stress');
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].type).toBe('work_stress'); // built-in fallback
  });

  it('uses only the built-in analysis when no external service is configured', async () => {
    const svc = new ModelService();
    expect(svc.usingFallbackOnly).toBe(true);
    expect((await svc.analyzeSafety('no reason to live', null, null)).severity_flag).toBe('high');
  });
});

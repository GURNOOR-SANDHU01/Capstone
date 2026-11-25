/**
 * Voice journal: POST /api/journal-entries/audio and POST /api/analysis/audio.
 * The model service is replaced with a spy; no network or real model.
 */
const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => ({ firebaseApp: {}, auth: mockAuth, db: mockDb }));
jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');
const modelService = require('../src/services/modelService');
const { ModelService } = require('../src/services/modelService');

const AUTH = 'Bearer token_user_alice';
const FAKE_AUDIO = Buffer.from('RIFF....WAVEfmt fake audio bytes');

const fusedResult = {
  transcript: 'I miss her so much. Call me at 555-123-4567.',
  emotion: 'sadness',
  decision: 'agree',
  text_says: 'sadness',
  voice_says: 'sadness',
  voice_raw: 'sadness',
  fused_scores: { sadness: 0.71, joy: 0.05 },
  fine_grained_emotions: [{ label: 'grief', score: 0.62 }],
  detected_emotions: {
    primary_state: 'sadness',
    confidence: 0.71,
    sentiment_score: -0.8,
    all_28_states: { grief: 0.62 },
    provenance: { adapter: 'sentimed-local', model: 'wavlm-large+soulscribe-v8', is_mock: false }
  }
};

describe('Voice journal entries', () => {
  beforeEach(() => mockDb.reset());
  afterEach(() => jest.restoreAllMocks());

  it('transcribes, stores the PII-scrubbed transcript and the fused voice emotion', async () => {
    const audioSpy = jest.spyOn(modelService, 'analyzeAudio').mockResolvedValue(fusedResult);
    const textSpy = jest.spyOn(modelService, 'analyzeEmotions');

    const res = await request(app)
      .post('/api/journal-entries/audio?visibility=shared&tags=family,grief')
      .set('Authorization', AUTH)
      .set('Content-Type', 'audio/webm')
      .send(FAKE_AUDIO);

    expect(res.status).toBe(201);
    const e = res.body.data;
    expect(e.input_source).toBe('audio');
    expect(e.entry_type).toBe('voice_journal');
    expect(e.visibility).toBe('shared');
    expect(e.extracted_themes).toEqual(['family', 'grief']);
    expect(e.masked_content).toContain('<PHONE_NUMBER>');
    expect(e.masked_content).not.toContain('555-123-4567');
    expect(e.detected_emotions.primary_state).toBe('sadness');
    expect(e.detected_emotions.voice_analysis.decision).toBe('agree');
    expect(e.detected_emotions.voice_analysis.voice_says).toBe('sadness');
    expect(e.detected_emotions.fine_grained_emotions).toEqual([{ label: 'grief', score: 0.62 }]);
    expect(e.safety_flags).toBeDefined();

    // The recording itself went to the model service; the text emotion call was skipped
    expect(audioSpy).toHaveBeenCalledWith(expect.any(Buffer), 'audio/webm', 'recording.webm');
    expect(textSpy).not.toHaveBeenCalled();
  });

  it('rejects a recording with no speech (422)', async () => {
    jest.spyOn(modelService, 'analyzeAudio').mockResolvedValue({ ...fusedResult, transcript: '  ' });
    const res = await request(app)
      .post('/api/journal-entries/audio')
      .set('Authorization', AUTH)
      .set('Content-Type', 'audio/webm')
      .send(FAKE_AUDIO);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NO_SPEECH_DETECTED');
  });

  it('returns 503 VOICE_ANALYSIS_UNAVAILABLE with a readable message when no model service is configured', async () => {
    const res = await request(app)
      .post('/api/journal-entries/audio')
      .set('Authorization', AUTH)
      .set('Content-Type', 'audio/webm')
      .send(FAKE_AUDIO);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('VOICE_ANALYSIS_UNAVAILABLE');
    expect(res.body.error.message).toMatch(/model service/i);
  });

  it('requires an audio body and rejects unknown query fields', async () => {
    const empty = await request(app).post('/api/journal-entries/audio').set('Authorization', AUTH).send();
    expect(empty.status).toBe(400);

    const extra = await request(app)
      .post('/api/journal-entries/audio?detected_emotions=joy')
      .set('Authorization', AUTH)
      .set('Content-Type', 'audio/webm')
      .send(FAKE_AUDIO);
    expect(extra.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/journal-entries/audio').set('Content-Type', 'audio/webm').send(FAKE_AUDIO);
    expect(res.status).toBe(401);
  });

  it('POST /api/analysis/audio previews analysis without storing an entry', async () => {
    jest.spyOn(modelService, 'analyzeAudio').mockResolvedValue(fusedResult);
    const res = await request(app)
      .post('/api/analysis/audio')
      .set('Authorization', AUTH)
      .set('Content-Type', 'audio/wav')
      .send(FAKE_AUDIO);
    expect(res.status).toBe(200);
    expect(res.body.data.emotion).toBe('sadness');
    expect(res.body.data.transcript).toContain('<PHONE_NUMBER>');
    const list = await request(app).get('/api/journal-entries').set('Authorization', AUTH);
    expect(list.body.data).toHaveLength(0);
  });
});

describe('ModelService.analyzeAudio contract', () => {
  it('validates the upstream result and maps upstream failures', async () => {
    const ok = new ModelService({ analyzeAudio: async () => ({ success: true, data: fusedResult }) });
    expect((await ok.analyzeAudio(FAKE_AUDIO, 'audio/webm')).detected_emotions.primary_state).toBe('sadness');

    const invalid = new ModelService({ analyzeAudio: async () => ({ transcript: 'x' }) });
    await expect(invalid.analyzeAudio(FAKE_AUDIO)).rejects.toMatchObject({ status: 503, code: 'VOICE_ANALYSIS_UNAVAILABLE' });

    const down = new ModelService({ analyzeAudio: async () => { throw new Error('ECONNREFUSED'); } });
    await expect(down.analyzeAudio(FAKE_AUDIO)).rejects.toMatchObject({ status: 503 });

    const badAudio = new ModelService({
      analyzeAudio: async () => {
        const err = new Error('Request failed with status code 400');
        err.response = { status: 400, data: { detail: 'Could not decode audio' } };
        throw err;
      }
    });
    await expect(badAudio.analyzeAudio(FAKE_AUDIO)).rejects.toMatchObject({ status: 422, code: 'AUDIO_NOT_ANALYSABLE' });
  });
});

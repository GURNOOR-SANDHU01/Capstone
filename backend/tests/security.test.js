/**
 * Authorization, privacy and consent enforcement (Stage 1 security hardening).
 * Runs entirely against the in-memory Firebase mock; no live Firebase access.
 */
const request = require('supertest');
const { mockDb, mockAuth, mockTimestamp } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => {
  const { mockDb: db, mockAuth: auth } = require('./mocks/firebaseAdminMock');
  return { firebaseApp: {}, auth, db };
});
jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');
const { normalizeRole } = require('../src/config/roles');

const PATIENT = 'user_patient_asha';
const OTHER_PATIENT = 'user_patient_ben';
const DOCTOR = 'doc_meera';
const OTHER_DOCTOR = 'doc_ravi';

const tokens = {
  patient: `Bearer token_${PATIENT}`,
  otherPatient: `Bearer token_${OTHER_PATIENT}`,
  doctor: `Bearer doctor_token_${DOCTOR}`,
  otherDoctor: `Bearer doctor_token_${OTHER_DOCTOR}`,
  legacyTherapist: 'Bearer therapist_token',
  admin: 'Bearer admin_token'
};

const api = () => request(app);

async function createEntry(token, body) {
  const res = await api().post('/api/journal-entries').set('Authorization', token).send(body);
  expect(res.status).toBe(201);
  return res.body.data;
}

async function grant(token, doctorId, extra = {}) {
  return api().post('/api/consent/therapist').set('Authorization', token).send({ therapist_id: doctorId, ...extra });
}

beforeEach(() => {
  mockDb.reset();
  mockAuth.addAccount(PATIENT, 'user');
  mockAuth.addAccount(OTHER_PATIENT, 'user');
  mockAuth.addAccount(DOCTOR, 'doctor');
  mockAuth.addAccount(OTHER_DOCTOR, 'doctor');
});

describe('Role model', () => {
  it('normalizes legacy and unknown roles to canonical, least-privileged values', () => {
    expect(normalizeRole('user')).toBe('patient');
    expect(normalizeRole('therapist')).toBe('doctor');
    expect(normalizeRole('Doctor')).toBe('doctor');
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('superuser')).toBe('patient');
    expect(normalizeRole(undefined)).toBe('patient');
  });

  it('reports the verified claim role, ignoring a role stored in the profile document', async () => {
    await mockDb.collection('users').doc(PATIENT).set({ full_name: 'Asha', email: 'a@example.com', role: 'admin' });
    const res = await api().get('/api/users/me').set('Authorization', tokens.patient);
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('patient');
  });

  it('treats the legacy "therapist" claim as doctor', async () => {
    const res = await api().get('/api/patients').set('Authorization', tokens.legacyTherapist);
    expect(res.status).toBe(200);
  });

  it('rejects revoked tokens', async () => {
    const res = await api().get('/api/users/me').set('Authorization', 'Bearer revoked_token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('rejects profile updates that try to set role or other protected fields', async () => {
    const res = await api().patch('/api/users/me').set('Authorization', tokens.patient).send({ role: 'admin' });
    expect(res.status).toBe(400);
  });
});

describe('Profile initialization', () => {
  it('handles concurrent first requests without overwriting profile data', async () => {
    const [a, b] = await Promise.all([
      api().get('/api/users/me').set('Authorization', tokens.patient),
      api().get('/api/users/me').set('Authorization', tokens.patient)
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    await api().patch('/api/users/me').set('Authorization', tokens.patient).send({ full_name: 'Asha Rao' });
    const again = await api().get('/api/users/me').set('Authorization', tokens.patient);
    expect(again.body.data.full_name).toBe('Asha Rao');
  });
});

describe('Admin role management', () => {
  it('is restricted to admins', async () => {
    for (const token of [tokens.patient, tokens.doctor]) {
      const res = await api().get('/api/admin/users').set('Authorization', token);
      expect(res.status).toBe(403);
    }
    const ok = await api().get('/api/admin/users').set('Authorization', tokens.admin);
    expect(ok.status).toBe(200);
  });

  it('sets the claim, mirrors it, revokes sessions and writes an audit record', async () => {
    const res = await api()
      .post(`/api/admin/users/${OTHER_PATIENT}/role`)
      .set('Authorization', tokens.admin)
      .send({ role: 'doctor' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ uid: OTHER_PATIENT, previous_role: 'patient', role: 'doctor' });
    expect((await mockAuth.getUser(OTHER_PATIENT)).customClaims.role).toBe('doctor');
    expect((await mockDb.collection('users').doc(OTHER_PATIENT).get()).data().role).toBe('doctor');

    // Existing sessions stop working until the user signs in again
    const stale = await api().get('/api/users/me').set('Authorization', tokens.otherPatient);
    expect(stale.status).toBe(401);

    const audit = await api().get('/api/admin/audit-logs').set('Authorization', tokens.admin);
    expect(audit.body.data[0]).toMatchObject({ action: 'SET_ROLE', target_id: OTHER_PATIENT, actor_id: 'admin_001' });
  });

  it('rejects self role changes, invalid roles and unknown accounts', async () => {
    const self = await api().post('/api/admin/users/admin_001/role').set('Authorization', tokens.admin).send({ role: 'patient' });
    expect(self.status).toBe(400);

    const invalid = await api().post(`/api/admin/users/${PATIENT}/role`).set('Authorization', tokens.admin).send({ role: 'superuser' });
    expect(invalid.status).toBe(400);

    const missing = await api().post('/api/admin/users/nobody/role').set('Authorization', tokens.admin).send({ role: 'doctor' });
    expect(missing.status).toBe(404);
  });
});

describe('Journal input integrity', () => {
  it.each([
    ['safety_flags', { severity_flag: 'normal', red_zone_triggered: false, crisis_language_detected: false }],
    ['masked_content', 'pre-masked text'],
    ['detected_emotions', { primary_state: 'joy', confidence: 1, sentiment_score: 1 }],
    ['intent_object', { intent: 'none' }],
    ['reflection_prompt', { prompt_text: 'x' }]
  ])('rejects client-supplied %s on create', async (field, value) => {
    const res = await api()
      .post('/api/journal-entries')
      .set('Authorization', tokens.patient)
      .send({ content: 'Today was hard.', [field]: value });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('computes safety server-side and routes a high-severity alert to admin triage when no doctor is consented', async () => {
    const entry = await createEntry(tokens.patient, { content: 'I feel like I want to die.' });
    expect(entry.safety_flags.severity_flag).toBe('high');

    const alerts = await api().get('/api/safety-alerts').set('Authorization', tokens.admin);
    expect(alerts.status).toBe(200);
    expect(alerts.body.data).toHaveLength(1);
    expect(alerts.body.data[0]).toMatchObject({ user_id: PATIENT, therapist_id: '', severity: 'high' });
    expect(JSON.stringify(alerts.body.data[0])).not.toContain('want to die');
  });

  it('scrubs PII from content and reflection text and records the self-reported emotion', async () => {
    const entry = await createEntry(tokens.patient, {
      content: 'Call me at 555-123-4567 or mail asha@example.com',
      reflection_response: 'Reach me at asha@example.com',
      self_reported_emotion: 'Anxious'
    });
    expect(entry.masked_content).not.toContain('asha@example.com');
    expect(entry.masked_content).not.toContain('555-123-4567');
    expect(entry.reflection_prompt.user_response).toContain('<EMAIL>');
    expect(entry.detected_emotions.corrected_emotion).toBe('Anxious');
    expect(entry.visibility).toBe('private');
  });

  it('does not let the owner rewrite AI/safety outputs via PATCH', async () => {
    const entry = await createEntry(tokens.patient, { content: 'Fine day.' });
    for (const body of [
      { safety_flags: { severity_flag: 'normal' } },
      { masked_content: 'rewritten' },
      { detected_emotions: { primary_state: 'joy' } }
    ]) {
      const res = await api().patch(`/api/journal-entries/${entry.id}`).set('Authorization', tokens.patient).send(body);
      expect(res.status).toBe(400);
    }
    const ok = await api()
      .patch(`/api/journal-entries/${entry.id}`)
      .set('Authorization', tokens.patient)
      .send({ visibility: 'shared', detected_emotions: { corrected_emotion: 'Calm' } });
    expect(ok.status).toBe(200);
    expect(ok.body.data.visibility).toBe('shared');
    expect(ok.body.data.detected_emotions.corrected_emotion).toBe('Calm');
  });
});

describe('Journal privacy and consent', () => {
  async function doctorReads(entryId, token = tokens.doctor) {
    return api().get(`/api/journal-entries/${entryId}`).set('Authorization', token);
  }

  it('keeps private entries private even with full consent', async () => {
    await grant(tokens.patient, DOCTOR, { access_level: 'full_reflection_access' });
    const entry = await createEntry(tokens.patient, { content: 'private thoughts', visibility: 'private' });
    expect((await doctorReads(entry.id)).status).toBe(403);
  });

  it('treats legacy entries without a visibility field as private', async () => {
    await grant(tokens.patient, DOCTOR, { access_level: 'full_reflection_access' });
    const ref = await mockDb.collection('journal_entries').add({ user_id: PATIENT, masked_content: 'old', created_at: mockTimestamp.now() });
    expect((await doctorReads(ref.id)).status).toBe(403);
  });

  it('returns the full shared entry for full_reflection_access', async () => {
    await grant(tokens.patient, DOCTOR, { access_level: 'full_reflection_access' });
    const entry = await createEntry(tokens.patient, { content: 'shared thoughts', visibility: 'shared' });
    const res = await doctorReads(entry.id);
    expect(res.status).toBe(200);
    expect(res.body.data.access).toBe('full');
    expect(res.body.data.masked_content).toBe('shared thoughts');
  });

  it('returns only a summary for longitudinal_summary_only', async () => {
    await grant(tokens.patient, DOCTOR, { access_level: 'longitudinal_summary_only' });
    const entry = await createEntry(tokens.patient, { content: 'shared thoughts', visibility: 'shared', reflection_response: 'my answer' });
    const res = await doctorReads(entry.id);
    expect(res.status).toBe(200);
    expect(res.body.data.access).toBe('summary');
    expect(res.body.data.masked_content).toBeUndefined();
    expect(res.body.data.reflection_prompt).toBeUndefined();
    expect(res.body.data.detected_emotions.primary_state).toBeDefined();
  });

  it('denies journal access for emergency_only consent, no consent, another doctor, revoked consent, admins and other patients', async () => {
    const entry = await createEntry(tokens.patient, { content: 'shared', visibility: 'shared' });
    expect((await doctorReads(entry.id)).status).toBe(403); // no consent yet

    await grant(tokens.patient, DOCTOR, { access_level: 'emergency_only' });
    expect((await doctorReads(entry.id)).status).toBe(403);

    await grant(tokens.patient, DOCTOR, { access_level: 'full_reflection_access' });
    expect((await doctorReads(entry.id)).status).toBe(200);
    expect((await doctorReads(entry.id, tokens.otherDoctor)).status).toBe(403);
    expect((await doctorReads(entry.id, tokens.admin)).status).toBe(403);
    expect((await doctorReads(entry.id, tokens.otherPatient)).status).toBe(403);

    await api().delete('/api/consent/therapist').set('Authorization', tokens.patient).send({ therapist_id: DOCTOR });
    expect((await doctorReads(entry.id)).status).toBe(403);
  });

  it('lists only shared entries to a consented doctor', async () => {
    await grant(tokens.patient, DOCTOR, { access_level: 'full_reflection_access' });
    await createEntry(tokens.patient, { content: 'one shared', visibility: 'shared' });
    await createEntry(tokens.patient, { content: 'one private', visibility: 'private' });

    const res = await api().get(`/api/patients/${PATIENT}/journal-entries`).set('Authorization', tokens.doctor);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].masked_content).toBe('one shared');
    expect(res.body.pagination.access).toBe('full');

    const unconsented = await api().get(`/api/patients/${PATIENT}/journal-entries`).set('Authorization', tokens.otherDoctor);
    expect(unconsented.status).toBe(403);

    const asPatient = await api().get(`/api/patients/${PATIENT}/journal-entries`).set('Authorization', tokens.patient);
    expect(asPatient.status).toBe(403);
  });
});

describe('Consent ownership and validation', () => {
  it('only allows consent to an existing doctor account other than yourself', async () => {
    expect((await grant(tokens.patient, PATIENT)).status).toBe(400);
    expect((await grant(tokens.patient, OTHER_PATIENT)).status).toBe(400);
    expect((await grant(tokens.patient, 'ghost_doctor')).status).toBe(404);
    expect((await grant(tokens.patient, DOCTOR)).status).toBe(201);
  });

  it('shows the patient on the doctor roster only while consent is active', async () => {
    await grant(tokens.patient, DOCTOR);
    let roster = await api().get('/api/patients').set('Authorization', tokens.doctor);
    expect(roster.body.data.map((p) => p.patient_id)).toEqual([PATIENT]);

    await api().delete('/api/consent/therapist').set('Authorization', tokens.patient).send({ therapist_id: DOCTOR });
    roster = await api().get('/api/patients').set('Authorization', tokens.doctor);
    expect(roster.body.data).toHaveLength(0);
  });
});

describe('Safety alert authorization', () => {
  async function addAlert(fields) {
    return mockDb.collection('red_flag_alert_logs').add({
      alert_type: 'sustained_emotional_decline',
      severity: 'high',
      trigger_reason: 'test',
      alert_status: 'pending',
      triggered_at: mockTimestamp.now(),
      ...fields
    });
  }
  const patch = (id, token) =>
    api().patch(`/api/safety-alerts/${id}`).set('Authorization', token).send({ alert_status: 'viewed' });

  it('lets only the assigned, still-consented doctor update an alert', async () => {
    await grant(tokens.patient, DOCTOR);
    const alert = await addAlert({ user_id: PATIENT, therapist_id: DOCTOR });

    expect((await patch(alert.id, tokens.otherDoctor)).status).toBe(403);
    expect((await patch(alert.id, tokens.patient)).status).toBe(403);
    expect((await patch(alert.id, tokens.doctor)).status).toBe(200);

    await api().delete('/api/consent/therapist').set('Authorization', tokens.patient).send({ therapist_id: DOCTOR });
    expect((await patch(alert.id, tokens.doctor)).status).toBe(403);
  });

  it('keeps unassigned triage alerts admin-only', async () => {
    const alert = await addAlert({ user_id: PATIENT, therapist_id: '' });
    expect((await patch(alert.id, tokens.doctor)).status).toBe(403);
    const res = await patch(alert.id, tokens.admin);
    expect(res.status).toBe(200);
    expect(res.body.data.last_actor_role).toBe('admin');
  });

  it("hides a patient's alerts from a doctor after consent is revoked", async () => {
    await grant(tokens.patient, DOCTOR);
    await addAlert({ user_id: PATIENT, therapist_id: DOCTOR });
    let list = await api().get('/api/safety-alerts').set('Authorization', tokens.doctor);
    expect(list.body.data).toHaveLength(1);

    await api().delete('/api/consent/therapist').set('Authorization', tokens.patient).send({ therapist_id: DOCTOR });
    list = await api().get('/api/safety-alerts').set('Authorization', tokens.doctor);
    expect(list.body.data).toHaveLength(0);
  });

  it('routes journal red flags to consented doctors', async () => {
    await grant(tokens.patient, DOCTOR, { red_flag_alerts_enabled: true });
    await createEntry(tokens.patient, { content: 'there is no reason to live' });
    const list = await api().get('/api/safety-alerts').set('Authorization', tokens.doctor);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].therapist_id).toBe(DOCTOR);
  });
});

describe('Onboarding', () => {
  const valid = {
    basic_info: { full_name: 'Asha Rao', phone: '+91 98765 43210', language: 'English' },
    emergency_contact: { name: 'Ravi Rao', relation: 'Sibling', phone: '+91 98765 00000' },
    wellness_answers: { mood: 'stable', anxiety: 'mild', sleep: 'moderate', energy: 'normal' },
    safety_answers: { crisis_thoughts: 'none', immediate_risk: 'no' },
    privacy_consent: true
  };
  const submit = (body) => api().put('/api/users/me/onboarding').set('Authorization', tokens.patient).send(body);

  it('stores completion server-side with a LOW risk category and no alert', async () => {
    const res = await submit(valid);
    expect(res.status).toBe(200);
    expect(res.body.data.risk_category).toBe('LOW');
    expect(res.body.data.alerts_created).toBe(0);
    expect(res.body.data.profile.onboarding.completed).toBe(true);
    expect(res.body.data.profile.phone).toBe('+91 98765 43210');

    const me = await api().get('/api/users/me').set('Authorization', tokens.patient);
    expect(me.body.data.onboarding.completed).toBe(true);
  });

  it('evaluates urgent risk on the server and raises a critical triage alert', async () => {
    const res = await submit({ ...valid, safety_answers: { crisis_thoughts: 'frequent', immediate_risk: 'no' } });
    expect(res.body.data.risk_category).toBe('HIGH_URGENT');
    const alerts = await api().get('/api/safety-alerts').set('Authorization', tokens.admin);
    expect(alerts.body.data[0]).toMatchObject({ severity: 'critical', alert_type: 'onboarding_safety_screening' });
  });

  it('rejects missing consent and client-supplied risk or completion state', async () => {
    expect((await submit({ ...valid, privacy_consent: false })).status).toBe(400);
    expect((await submit({ ...valid, risk_category: 'LOW' })).status).toBe(400);
    expect((await submit({ ...valid, completed: true })).status).toBe(400);
  });
});

describe('Journal editing', () => {
  it('re-masks and re-analyses edited text on the server and alerts on a new high-risk edit', async () => {
    const entry = await createEntry(tokens.patient, { content: 'A quiet day.', self_reported_emotion: 'Calm' });
    const res = await api()
      .patch(`/api/journal-entries/${entry.id}`)
      .set('Authorization', tokens.patient)
      .send({ content: 'Mail me at asha@example.com, I want to die' });
    expect(res.status).toBe(200);
    expect(res.body.data.masked_content).toContain('<EMAIL>');
    expect(res.body.data.safety_flags.severity_flag).toBe('high');
    expect(res.body.data.detected_emotions.corrected_emotion).toBe('Calm'); // self-report kept
    expect(res.body.data.edited_at).toBeDefined();

    const alerts = await api().get('/api/safety-alerts').set('Authorization', tokens.admin);
    expect(alerts.body.data).toHaveLength(1);
  });

  it('does not let another user edit the text', async () => {
    const entry = await createEntry(tokens.patient, { content: 'Mine.' });
    const res = await api().patch(`/api/journal-entries/${entry.id}`).set('Authorization', tokens.otherPatient).send({ content: 'hijacked' });
    expect(res.status).toBe(403);
  });
});

describe('Error responses', () => {
  it('maps a missing Firestore index to a generic 503 instead of leaking the index link', async () => {
    const journalRepository = require('../src/repositories/journalRepository');
    const err = Object.assign(new Error('FAILED_PRECONDITION: The query requires an index. https://console.firebase.google.com/...'), { code: 9 });
    const spy = jest.spyOn(journalRepository, 'listByUser').mockRejectedValue(err);
    try {
      const res = await api().get('/api/journal-entries').set('Authorization', tokens.patient);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_NOT_READY');
      expect(JSON.stringify(res.body)).not.toContain('console.firebase');
    } finally {
      spy.mockRestore();
    }
  });

  it('never exposes internal error details for server errors', async () => {
    const journalRepository = require('../src/repositories/journalRepository');
    const spy = jest
      .spyOn(journalRepository, 'listByUser')
      .mockRejectedValue(new Error('internal: projects/secret-path/databases/(default) stack detail'));
    try {
      const res = await api().get('/api/journal-entries').set('Authorization', tokens.patient);
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toContain('secret-path');
      expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'An unexpected internal server error occurred.' });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('Least privilege', () => {
  it('only patients can grant or revoke consent', async () => {
    expect((await grant(tokens.doctor, OTHER_DOCTOR)).status).toBe(403);
    expect((await grant(tokens.admin, DOCTOR)).status).toBe(403);
    const revoke = await api().delete('/api/consent/therapist').set('Authorization', tokens.doctor).send({ therapist_id: OTHER_DOCTOR });
    expect(revoke.status).toBe(403);
    expect((await api().get('/api/consent').set('Authorization', tokens.admin)).status).toBe(403);
  });

  it('admins cannot list appointment details', async () => {
    const res = await api().get('/api/appointments').set('Authorization', tokens.admin);
    expect(res.status).toBe(403);
  });
});

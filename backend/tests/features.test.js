/**
 * Appointments, care instructions, messaging, clinics and admin tools.
 * In-memory Firebase mock only.
 */
const request = require('supertest');
const { mockDb, mockAuth } = require('./mocks/firebaseAdminMock');

jest.mock('../src/config/firebase/admin', () => {
  const { mockDb: db, mockAuth: auth } = require('./mocks/firebaseAdminMock');
  return { firebaseApp: {}, auth, db };
});
jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));

const app = require('../src/app');

const PATIENT = 'user_pat_asha';
const OTHER_PATIENT = 'user_pat_ben';
const DOCTOR = 'doc_meera';
const OTHER_DOCTOR = 'doc_ravi';
const t = {
  patient: `Bearer token_${PATIENT}`,
  otherPatient: `Bearer token_${OTHER_PATIENT}`,
  doctor: `Bearer doctor_token_${DOCTOR}`,
  otherDoctor: `Bearer doctor_token_${OTHER_DOCTOR}`,
  admin: 'Bearer admin_token'
};
const api = () => request(app);
const as = (token) => ({
  get: (p) => api().get(p).set('Authorization', token),
  post: (p, b) => api().post(p).set('Authorization', token).send(b),
  patch: (p, b) => api().patch(p).set('Authorization', token).send(b)
});

const grantConsent = () => as(t.patient).post('/api/consent/therapist', { therapist_id: DOCTOR, access_level: 'full_reflection_access' });
const futureDate = '2030-05-20';

beforeEach(async () => {
  mockDb.reset();
  mockAuth.addAccount(PATIENT, 'user');
  mockAuth.addAccount(OTHER_PATIENT, 'user');
  mockAuth.addAccount(DOCTOR, 'doctor');
  mockAuth.addAccount(OTHER_DOCTOR, 'doctor');
  await mockDb.collection('users').doc(PATIENT).set({ full_name: 'Asha Rao', role: 'patient' });
  await mockDb.collection('users').doc(DOCTOR).set({ full_name: 'Dr. Meera Iyer', role: 'doctor', doctor_profile: { specialization: 'Psychiatry', clinic_name: 'Central' } });
});

describe('Appointments', () => {
  const request_ = (token, body = {}) =>
    as(token).post('/api/appointments', { doctor_id: DOCTOR, date: futureDate, time: '10:30 AM', reason: 'Follow-up', ...body });

  it('patient request ignores client-supplied identity and stores verified participants', async () => {
    const res = await request_(t.patient, { patient_id: 'spoofed_patient' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      patient_id: PATIENT,
      patient_name: 'Asha Rao',
      doctor_id: DOCTOR,
      doctor_name: 'Dr. Meera Iyer',
      specialization: 'Psychiatry',
      status: 'PENDING',
      meeting_url: null
    });
  });

  it('rejects booking with a non-doctor account', async () => {
    const res = await request_(t.patient, { doctor_id: OTHER_PATIENT });
    expect(res.status).toBe(400);
  });

  it('runs the full lifecycle with role-checked transitions', async () => {
    const { body } = await request_(t.patient);
    const id = body.data.id;
    const act = (token, b) => as(token).post(`/api/appointments/${id}/actions`, b);

    expect((await act(t.patient, { action: 'confirm' })).status).toBe(403); // patient cannot confirm
    expect((await act(t.otherDoctor, { action: 'confirm' })).status).toBe(403); // not a participant

    const confirmed = await act(t.doctor, { action: 'confirm' });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');
    expect(confirmed.body.data.meeting_url).toMatch(/^https:\/\/meet\.jit\.si\/SentiMed-[0-9a-f]{18}$/);

    expect((await act(t.doctor, { action: 'confirm' })).status).toBe(409); // already confirmed

    const resched = await act(t.doctor, { action: 'reschedule', date: '2030-05-21', time: '03:00 PM', note: 'Clinic emergency' });
    expect(resched.body.data.status).toBe('RESCHEDULE_REQUESTED');
    const accepted = await act(t.patient, { action: 'accept_reschedule' });
    expect(accepted.body.data).toMatchObject({ status: 'CONFIRMED', date: '2030-05-21', time: '03:00 PM', rescheduled_date: null });

    expect((await act(t.patient, { action: 'cancel' })).body.data.status).toBe('CANCELLED');
    expect((await act(t.doctor, { action: 'complete' })).status).toBe(409);
  });

  it('lists appointments scoped to the caller', async () => {
    await request_(t.patient);
    expect((await as(t.patient).get('/api/appointments')).body.data).toHaveLength(1);
    expect((await as(t.doctor).get('/api/appointments')).body.data).toHaveLength(1);
    expect((await as(t.otherPatient).get('/api/appointments')).body.data).toHaveLength(0);
    expect((await as(t.otherDoctor).get('/api/appointments')).body.data).toHaveLength(0);
    // admins get counts from /api/admin/stats, never appointment details
    expect((await as(t.admin).get('/api/appointments')).status).toBe(403);
  });

  it('doctors can only schedule with consenting patients', async () => {
    const body = { patient_id: PATIENT, date: futureDate, time: '11:00 AM', reason: 'Check-in' };
    expect((await as(t.doctor).post('/api/appointments', body)).status).toBe(403);
    await grantConsent();
    const res = await as(t.doctor).post('/api/appointments', body);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('CONFIRMED');
    expect(res.body.data.meeting_url).toBeTruthy();
  });
});

describe('Care instructions', () => {
  const body = { patient_id: PATIENT, type: 'Medication Reminder', medication_name: 'Magnesium 200mg', schedule: 'Daily 9 PM', start_date: '2030-01-01' };

  it('requires consent and the doctor role', async () => {
    expect((await as(t.doctor).post('/api/care-instructions', body)).status).toBe(403);
    expect((await as(t.patient).post('/api/care-instructions', body)).status).toBe(403);
    await grantConsent();
    const res = await as(t.doctor).post('/api/care-instructions', body);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ doctor_id: DOCTOR, patient_id: PATIENT, status: 'Active' });

    expect((await as(t.patient).get('/api/care-instructions')).body.data).toHaveLength(1);
    expect((await as(t.otherPatient).get('/api/care-instructions')).body.data).toHaveLength(0);
    expect((await as(t.otherDoctor).patch(`/api/care-instructions/${res.body.data.id}`, { status: 'Paused' })).status).toBe(403);
    expect((await as(t.doctor).patch(`/api/care-instructions/${res.body.data.id}`, { status: 'Paused' })).body.data.status).toBe('Paused');
  });
});

describe('Secure messaging', () => {
  it('works only between consenting patient and doctor', async () => {
    expect((await as(t.patient).post('/api/messages', { to: DOCTOR, text: 'Hello' })).status).toBe(403);
    await grantConsent();
    expect((await as(t.patient).post('/api/messages', { to: DOCTOR, text: 'Hello doctor' })).status).toBe(201);
    expect((await as(t.doctor).post('/api/messages', { to: PATIENT, text: 'Hello Asha' })).status).toBe(201);

    const thread = await as(t.doctor).get(`/api/messages?with=${PATIENT}`);
    expect(thread.body.data.map((m) => m.text)).toEqual(['Hello doctor', 'Hello Asha']);
    expect(thread.body.data[0].sender_role).toBe('patient');

    expect((await as(t.otherDoctor).get(`/api/messages?with=${PATIENT}`)).status).toBe(403);
    expect((await as(t.admin).get(`/api/messages?with=${PATIENT}`)).status).toBe(403);
  });
});

describe('Clinics and admin tools', () => {
  it('only admins create clinics; everyone signed in can list them', async () => {
    const clinic = { name: 'Central', location: 'Mumbai', contact: '+91 22 0000 0000' };
    expect((await as(t.doctor).post('/api/clinics', clinic)).status).toBe(403);
    expect((await as(t.admin).post('/api/clinics', clinic)).status).toBe(201);
    const list = await as(t.patient).get('/api/clinics');
    expect(list.body.data[0]).toMatchObject({ name: 'Central', doctors_count: 1 });
  });

  it('admin promotes an existing account to doctor by email', async () => {
    const res = await as(t.admin).post('/api/admin/doctors', { email: `${OTHER_PATIENT}@example.com`, specialization: 'CBT' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: OTHER_PATIENT, role: 'doctor', doctor_profile: { specialization: 'CBT' } });
    expect((await mockAuth.getUser(OTHER_PATIENT)).customClaims.role).toBe('doctor');
    expect((await as(t.admin).post('/api/admin/doctors', { email: 'nobody@example.com' })).status).toBe(404);
  });

  it('admin stats summarise the platform', async () => {
    const res = await as(t.admin).get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toMatchObject({ patient: 1, doctor: 1 });
    expect((await as(t.doctor).get('/api/admin/stats')).status).toBe(403);
  });
});

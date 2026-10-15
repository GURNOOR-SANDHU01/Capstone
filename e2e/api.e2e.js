/**
 * API end-to-end test: real Firebase ID tokens (Auth emulator) -> Express backend -> Firestore emulator.
 * Exercises authentication, roles, onboarding, journal CRUD, privacy, consent, alerts and admin.
 *
 *   (terminal 1) npm run emulators
 *   (terminal 2) npm run test:api
 */
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } = require('firebase/firestore');
const H = require('./lib/harness');

const { expect } = H;
const apps = [];

async function newClient(name) {
  const app = initializeApp({ apiKey: 'demo-api-key', projectId: H.PROJECT_ID, authDomain: `${H.PROJECT_ID}.firebaseapp.com` }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${H.AUTH_HOST}`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, ...H.FIRESTORE_HOST.split(':').map((v, i) => (i ? Number(v) : v)));
  return { app, auth, db };
}

function apiFor(client) {
  const call = async (method, path, body) => {
    const token = await client.auth.currentUser.getIdToken();
    const res = await fetch(`${H.BACKEND_URL}/api${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = res.status === 204 ? null : await res.json();
    return { status: res.status, body: json };
  };
  return {
    get: (p) => call('GET', p),
    post: (p, b) => call('POST', p, b),
    put: (p, b) => call('PUT', p, b),
    patch: (p, b) => call('PATCH', p, b),
    del: (p, b) => call('DELETE', p, b)
  };
}

async function signUp(client, email) {
  const cred = await createUserWithEmailAndPassword(client.auth, email, 'Passw0rd!e2e');
  return cred.user.uid;
}

(async () => {
  const r = H.createReporter('API E2E');
  let backend;
  try {
    await H.assertEmulatorsUp();
    await H.resetEmulators();
    backend = await H.startBackendAndWait();
    console.log(`Backend on ${H.BACKEND_URL} -> emulators (${H.PROJECT_ID})\n`);

    const patientC = await newClient('patient');
    const doctorC = await newClient('doctor');
    const adminC = await newClient('admin');
    const patient = apiFor(patientC);
    const doctor = apiFor(doctorC);
    const admin = apiFor(adminC);

    let patientUid, doctorUid, adminUid;
    const ids = {};

    await r.step('patient signs up with Firebase Auth and gets a backend profile with role patient', async () => {
      patientUid = await signUp(patientC, 'asha.patient@e2e.test');
      const me = await patient.get('/users/me');
      expect(me.status, 'status').toBe(200);
      expect(me.body.data.role, 'role').toBe('patient');
      expect(me.body.data.onboarding, 'onboarding').toBe(undefined);
    });

    await r.step('browser clients cannot read or write Firestore directly (rules deny all)', async () => {
      const read = await getDoc(doc(patientC.db, 'users', patientUid)).then(() => 'allowed', (e) => e.code);
      expect(read, 'direct read').toBe('permission-denied');
      const write = await setDoc(doc(patientC.db, 'users', patientUid), { role: 'admin' }).then(() => 'allowed', (e) => e.code);
      expect(write, 'direct write').toBe('permission-denied');
    });

    await r.step('patient cannot grant themselves a role', async () => {
      const res = await patient.patch('/users/me', { role: 'admin' });
      expect(res.status, 'status').toBe(400);
      expect((await patient.get('/admin/users')).status, 'admin api').toBe(403);
    });

    await r.step('profile update and server-side onboarding (LOW risk)', async () => {
      expect((await patient.patch('/users/me', { full_name: 'Asha Rao', phone: '+91 98765 43210' })).status, 'patch').toBe(200);
      const res = await patient.put('/users/me/onboarding', {
        basic_info: { full_name: 'Asha Rao', phone: '+91 98765 43210', language: 'English' },
        emergency_contact: { name: 'Ravi Rao', relation: 'Sibling', phone: '+91 98765 00000' },
        wellness_answers: { mood: 'stable', anxiety: 'mild', sleep: 'moderate', energy: 'normal' },
        safety_answers: { crisis_thoughts: 'none', immediate_risk: 'no' },
        privacy_consent: true
      });
      expect(res.status, 'status').toBe(200);
      expect(res.body.data.risk_category, 'risk').toBe('LOW');
      const me = await patient.get('/users/me');
      expect(me.body.data.onboarding.completed, 'completed persisted').toBe(true);
    });

    await r.step('journal: create private + shared entries with server-side PII scrubbing', async () => {
      const priv = await patient.post('/journal-entries', {
        content: 'Private note, email me at asha@example.com',
        visibility: 'private',
        self_reported_emotion: 'Anxious',
        extracted_themes: ['work']
      });
      expect(priv.status, 'create private').toBe(201);
      expect(priv.body.data.masked_content, 'masked').notToContain('asha@example.com');
      ids.private = priv.body.data.id;

      const shared = await patient.post('/journal-entries', { content: 'Shared: a calm walk helped today', visibility: 'shared', self_reported_emotion: 'Calm' });
      expect(shared.status, 'create shared').toBe(201);
      ids.shared = shared.body.data.id;
    });

    await r.step('journal: trusted fields from the client are rejected', async () => {
      const res = await patient.post('/journal-entries', { content: 'x', safety_flags: { severity_flag: 'normal' } });
      expect(res.status, 'status').toBe(400);
    });

    await r.step('journal: list returns only the owner entries, newest first, with Firestore Timestamps', async () => {
      const res = await patient.get('/journal-entries?limit=50');
      expect(res.status, 'status').toBe(200);
      expect(res.body.data.length, 'count').toBe(2);
      expect(res.body.data[0].id, 'newest first').toBe(ids.shared);
      expect(typeof res.body.data[0].created_at._seconds, 'timestamp').toBe('number');
    });

    await r.step('journal: toggle visibility and delete', async () => {
      const tmp = await patient.post('/journal-entries', { content: 'temporary entry' });
      const vis = await patient.patch(`/journal-entries/${tmp.body.data.id}`, { visibility: 'shared' });
      expect(vis.body.data.visibility, 'visibility').toBe('shared');
      expect((await patient.del(`/journal-entries/${tmp.body.data.id}`)).status, 'delete').toBe(200);
      expect((await patient.get(`/journal-entries/${tmp.body.data.id}`)).status, 'gone').toBe(404);
    });

    await r.step('authentication failures: missing, malformed and forged tokens are rejected', async () => {
      const none = await fetch(`${H.BACKEND_URL}/api/journal-entries`);
      expect(none.status, 'no token').toBe(401);
      const bad = await fetch(`${H.BACKEND_URL}/api/journal-entries`, { headers: { Authorization: 'Bearer not-a-token' } });
      expect(bad.status, 'malformed').toBe(401);
      // a structurally valid but unsigned token claiming to be the patient
      const fake = ['{"alg":"none","typ":"JWT"}', JSON.stringify({ sub: patientUid, user_id: patientUid, role: 'admin', aud: H.PROJECT_ID })]
        .map((p) => Buffer.from(p).toString('base64url')).join('.') + '.';
      const forged = await fetch(`${H.BACKEND_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${fake}` } });
      expect(forged.status, 'forged').toBe(401);
      const body = await forged.text();
      expect(body, 'no stack trace').notToContain('at ');
    });

    await r.step('cross-patient isolation: another patient cannot read, edit, delete or list these entries', async () => {
      const otherC = await newClient('other-patient');
      await signUp(otherC, 'ben.other@e2e.test');
      const other = apiFor(otherC);
      expect((await other.get(`/journal-entries/${ids.private}`)).status, 'read private').toBe(403);
      expect((await other.get(`/journal-entries/${ids.shared}`)).status, 'read shared').toBe(403);
      expect((await other.patch(`/journal-entries/${ids.shared}`, { content: 'hijack' })).status, 'edit').toBe(403);
      expect((await other.del(`/journal-entries/${ids.shared}`)).status, 'delete').toBe(403);
      expect((await other.get('/journal-entries')).body.data.length, 'own list empty').toBe(0);
      expect((await other.get(`/patients/${patientUid}/journal-entries`)).status, 'doctor endpoint').toBe(403);
    });

    await r.step('journal edit re-masks and re-analyses text in Firestore', async () => {
      const created = await patient.post('/journal-entries', { content: 'Original text for editing' });
      ids.edited = created.body.data.id;
      const res = await patient.patch(`/journal-entries/${ids.edited}`, { content: 'Edited: call me on 555-123-4567, feeling good' });
      expect(res.status, 'status').toBe(200);
      expect(res.body.data.masked_content, 'masked').notToContain('555-123-4567');
      const reread = await patient.get(`/journal-entries/${ids.edited}`);
      expect(reread.body.data.masked_content, 'persisted').toContain('Edited:');
    });

    await r.step('admin bootstrap via scripts/set-role.js, then doctor promotion via the admin API', async () => {
      adminUid = await signUp(adminC, 'admin@e2e.test');
      doctorUid = await signUp(doctorC, 'meera.doctor@e2e.test');
      await admin.get('/users/me');
      await doctor.get('/users/me');

      const dry = await H.runBackendScript('set-role.js', ['--uid', adminUid, '--role', 'admin']);
      expect(dry, 'dry run output').toContain('Dry run only');
      await H.runBackendScript('set-role.js', ['--uid', adminUid, '--role', 'admin', '--apply']);

      // tokens were revoked by the role change: sign in again to get a token with the new claim
      await signInWithEmailAndPassword(adminC.auth, 'admin@e2e.test', 'Passw0rd!e2e');
      await adminC.auth.currentUser.getIdToken(true);
      expect((await admin.get('/users/me')).body.data.role, 'admin role').toBe('admin');

      const promote = await admin.post(`/admin/users/${doctorUid}/role`, { role: 'doctor' });
      expect(promote.status, 'promote').toBe(200);
      const stale = await doctor.get('/users/me');
      expect(stale.status, 'old doctor session revoked').toBe(401);
      await signInWithEmailAndPassword(doctorC.auth, 'meera.doctor@e2e.test', 'Passw0rd!e2e');
      await doctorC.auth.currentUser.getIdToken(true);
      expect((await doctor.get('/users/me')).body.data.role, 'doctor role').toBe('doctor');
      expect((await admin.patch(`/admin/doctors/${doctorUid}`, { specialization: 'Clinical Psychology', clinic_name: 'Central Clinic' })).status, 'doctor profile').toBe(200);
    });

    await r.step('doctor directory lists the doctor for patients', async () => {
      const res = await patient.get('/doctors');
      expect(res.status, 'status').toBe(200);
      expect(res.body.data.map((d) => d.id), 'directory').toContain(doctorUid);
    });

    await r.step('no consent: doctor cannot read shared entries or list the patient', async () => {
      expect((await doctor.get(`/journal-entries/${ids.shared}`)).status, 'read').toBe(403);
      expect((await doctor.get(`/patients/${patientUid}/journal-entries`)).status, 'list').toBe(403);
      expect((await doctor.get('/patients')).body.data.length, 'roster').toBe(0);
    });

    await r.step('consent to a non-doctor is rejected', async () => {
      expect((await patient.post('/consent/therapist', { therapist_id: adminUid })).status, 'admin as doctor').toBe(400);
      expect((await patient.post('/consent/therapist', { therapist_id: patientUid })).status, 'self').toBe(400);
    });

    await r.step('full consent: doctor sees shared entries with text, never private ones', async () => {
      const grant = await patient.post('/consent/therapist', { therapist_id: doctorUid, access_level: 'full_reflection_access', red_flag_alerts_enabled: true });
      expect(grant.status, 'grant').toBe(201);
      const roster = await doctor.get('/patients');
      expect(roster.body.data[0].patient_id, 'roster').toBe(patientUid);
      expect(roster.body.data[0].full_name, 'roster name').toBe('Asha Rao');

      const list = await doctor.get(`/patients/${patientUid}/journal-entries`);
      expect(list.status, 'list').toBe(200);
      expect(list.body.data.map((e) => e.id).join(','), 'ids').toBe(ids.shared);
      expect(list.body.data[0].masked_content, 'text').toContain('calm walk');
      expect((await doctor.get(`/journal-entries/${ids.private}`)).status, 'private read').toBe(403);
    });

    await r.step('summary consent: doctor sees trends but no journal text', async () => {
      await patient.post('/consent/therapist', { therapist_id: doctorUid, access_level: 'longitudinal_summary_only', red_flag_alerts_enabled: true });
      const list = await doctor.get(`/patients/${patientUid}/journal-entries`);
      expect(list.body.pagination.access, 'access').toBe('summary');
      expect(list.body.data[0].masked_content, 'text hidden').toBe(undefined);
      expect(typeof list.body.data[0].detected_emotions.sentiment_score, 'sentiment').toBe('number');
    });

    await r.step('red flag: crisis entry alerts the consented doctor; doctor resolves it', async () => {
      await patient.post('/journal-entries', { content: 'I feel there is no reason to live', visibility: 'private' });
      const alerts = await doctor.get('/safety-alerts');
      expect(alerts.status, 'list').toBe(200);
      expect(alerts.body.data.length, 'count').toBe(1);
      expect(JSON.stringify(alerts.body.data[0]), 'no journal text in alert').notToContain('no reason to live');
      ids.alert = alerts.body.data[0].id;
      const upd = await doctor.patch(`/safety-alerts/${ids.alert}`, { alert_status: 'resolved', therapist_action_taken: 'Called patient' });
      expect(upd.status, 'resolve').toBe(200);
      expect(upd.body.data.alert_status, 'status').toBe('resolved');
      expect((await patient.patch(`/safety-alerts/${ids.alert}`, { alert_status: 'viewed' })).status, 'patient cannot update').toBe(403);
    });

    await r.step('revoking consent removes doctor access immediately', async () => {
      expect((await patient.del('/consent/therapist', { therapist_id: doctorUid })).status, 'revoke').toBe(200);
      expect((await doctor.get(`/patients/${patientUid}/journal-entries`)).status, 'list').toBe(403);
      expect((await doctor.get('/safety-alerts')).body.data.length, 'alerts hidden').toBe(0);
      expect((await doctor.patch(`/safety-alerts/${ids.alert}`, { alert_status: 'viewed' })).status, 'alert update').toBe(403);
      const consent = await patient.get('/consent');
      expect(consent.body.data.auditHistory.length >= 3, 'audit trail').toBe(true);
    });

    await r.step('admin sees users, the triage queue and the role audit trail', async () => {
      const users = await admin.get('/admin/users');
      expect(users.status, 'users').toBe(200);
      expect(users.body.data.find((u) => u.id === doctorUid).role, 'mirror').toBe('doctor');
      const audit = await admin.get('/admin/audit-logs');
      expect(audit.body.data.some((a) => a.action === 'SET_ROLE' && a.target_id === doctorUid), 'audit').toBe(true);
      expect((await admin.get('/safety-alerts')).status, 'admin alerts').toBe(200);
      expect((await admin.get(`/journal-entries/${ids.shared}`)).status, 'admin cannot read journals').toBe(403);
    });
  } catch (err) {
    console.error('E2E setup failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (backend) backend.kill();
    await Promise.all(apps.map((a) => deleteApp(a).catch(() => {})));
    const ok = r.summary();
    if (!ok) process.exitCode = 1;
    setTimeout(() => process.exit(process.exitCode || 0), 200);
  }
})();

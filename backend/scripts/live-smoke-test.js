#!/usr/bin/env node
/**
 * Live smoke test against the real Firebase project, using a TEMPORARY account.
 *
 *   node scripts/live-smoke-test.js            # prints the plan, does nothing
 *   node scripts/live-smoke-test.js --apply    # runs it (requires the API on http://localhost:5000)
 *
 * Creates one Auth user, obtains a real Firebase ID token (Identity Toolkit REST sign-in),
 * exercises the API, then ALWAYS deletes the account and every document created for it,
 * and verifies that nothing is left behind. Prints no tokens or credentials.
 */
const crypto = require('crypto');
const { parseArgs, loadFirebase, banner } = require('./lib/common');

const API = process.env.SMOKE_API_URL || 'http://localhost:5000/api';
const EMAIL = `smoke-test-${Date.now()}@sentience.invalid`;
const OWNED_COLLECTIONS = ['journal_entries', 'reflection_prompts_and_responses', 'memories', 'red_flag_alert_logs', 'memory_feedback', 'biometric_sync_logs', 'consent_audit_logs', 'therapist_bridges'];

async function webApiKey(projectId) {
  const { GoogleAuth } = require('google-auth-library');
  const { firebase } = require('../src/config/env');
  const client = await new GoogleAuth({ keyFile: firebase.serviceAccountPath, scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const apps = (await client.request({ url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps` })).data.apps || [];
  if (!apps.length) throw new Error('No Firebase web app registered in the project');
  const cfg = (await client.request({ url: `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/${apps[0].appId}/config` })).data;
  return cfg.apiKey;
}

async function call(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

(async () => {
  const args = parseArgs();
  banner('Live smoke test (temporary account)', Boolean(args.apply));
  if (!args.apply) {
    console.log(`Would create ${EMAIL}, verify its ID token, create/read/edit/delete one journal entry, then delete the account and its documents.`);
    process.exit(0);
  }

  const { db, auth } = loadFirebase();
  const projectId = require('../src/config/env').firebase.projectId;
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok });
    console.log(`  ${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
  };
  let uid;

  try {
    const health = await call('GET', '/health/firebase');
    check('API reachable and connected to live Firestore', health.body?.data?.firebase?.firestoreConnected === true, health.body?.data?.firebase?.projectId);

    const password = crypto.randomBytes(18).toString('base64url');
    uid = (await auth.createUser({ email: EMAIL, password, displayName: 'Smoke Test' })).uid;
    check('temporary Auth account created', Boolean(uid));

    const key = await webApiKey(projectId);
    const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password, returnSecureToken: true })
    }).then((r) => r.json());
    const token = signIn.idToken;
    check('real Firebase ID token issued by Firebase Auth', Boolean(token));

    check('request without token rejected', (await call('GET', '/users/me')).status === 401);
    const tampered = token.slice(0, -4) + (token.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    check('tampered token rejected', (await call('GET', '/users/me', tampered)).status === 401);

    const me = await call('GET', '/users/me', token);
    check('backend verified the real token and created the profile', me.status === 200 && me.body.data.id === uid);
    check('role comes from the server (patient by default)', me.body?.data?.role === 'patient');
    check('admin API refused for a patient', (await call('GET', '/admin/users', token)).status === 403);

    const created = await call('POST', '/journal-entries', token, { content: 'Live smoke test entry. Contact me at smoke@example.com', visibility: 'private' });
    const entryId = created.body?.data?.id;
    check('journal entry created in live Firestore', created.status === 201 && Boolean(entryId));
    check('PII masked server-side', created.status === 201 && !created.body.data.masked_content.includes('smoke@example.com'));
    check('client-supplied safety flags rejected', (await call('POST', '/journal-entries', token, { content: 'x', safety_flags: { severity_flag: 'normal' } })).status === 400);

    const read = await call('GET', `/journal-entries/${entryId}`, token);
    check('entry read back from live Firestore', read.status === 200 && read.body.data.id === entryId);
    const edited = await call('PATCH', `/journal-entries/${entryId}`, token, { content: 'Live smoke test entry, edited.' });
    check('entry edited and persisted', edited.status === 200 && (await call('GET', `/journal-entries/${entryId}`, token)).body.data.masked_content.includes('edited'));

    const list = await call('GET', '/journal-entries', token);
    if (list.status === 200) check('journal list query (composite index deployed)', list.body.data.some((e) => e.id === entryId));
    else check('journal list without deployed index returns a safe 503, no internals', list.status === 503 && list.body.error.code === 'SERVICE_NOT_READY' && !JSON.stringify(list.body).includes('console.firebase'), `HTTP ${list.status}`);

    check('entry deleted', (await call('DELETE', `/journal-entries/${entryId}`, token)).status === 200);
  } catch (err) {
    check('unexpected error', false, err.message.split('\n')[0]);
  } finally {
    if (uid) {
      // Remove every document the test created, then the account; verify nothing remains.
      const leftovers = [];
      for (const coll of OWNED_COLLECTIONS) {
        const snap = await db.collection(coll).where('user_id', '==', uid).get();
        for (const doc of snap.docs) await doc.ref.delete();
      }
      await db.collection('users').doc(uid).delete();
      await auth.deleteUser(uid).catch(() => {});
      for (const coll of OWNED_COLLECTIONS) {
        if (!(await db.collection(coll).where('user_id', '==', uid).get()).empty) leftovers.push(coll);
      }
      if ((await db.collection('users').doc(uid).get()).exists) leftovers.push('users');
      const authGone = await auth.getUser(uid).then(() => false, (e) => e.code === 'auth/user-not-found');
      check('cleanup: account and all test documents deleted', leftovers.length === 0 && authGone, leftovers.join(', '));
    }
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\nLive smoke test: ${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();

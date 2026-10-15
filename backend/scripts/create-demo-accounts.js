#!/usr/bin/env node
/**
 * Gives the existing demo personas real Firebase Auth accounts (docs/data-reconciliation-plan.md, R2).
 *
 *  - every users/{id} document without an Auth account  -> Auth account with uid = id, role patient
 *  - every therapist_id referenced by therapist_bridges / red_flag_alert_logs that has no
 *    Auth account                                         -> Auth account with that uid, role doctor,
 *                                                            plus a users/{uid} profile created with
 *                                                            create() (never overwrites)
 *
 * Because UIDs equal the existing document IDs, all existing references become valid without
 * rewriting any Firestore document. Existing Auth accounts are never modified.
 *
 * Emails default to <uid>@sentience.invalid (non-deliverable). Generated passwords are written
 * ONLY to --credentials-out (must be outside the repository) and are never printed.
 *
 *   node scripts/create-demo-accounts.js                                           # dry run
 *   node scripts/create-demo-accounts.js --apply --credentials-out ../../_backups/demo-credentials.json
 *
 * Rollback: node scripts/create-demo-accounts.js --rollback <credentials file> [--apply]
 * (deletes exactly the accounts listed in that file, and the doctor profiles it created).
 */
const fs = require('fs');
const crypto = require('crypto');
const { parseArgs, loadFirebase, assertOutsideRepo, banner } = require('./lib/common');

const DEMO_DOMAIN = 'sentience.invalid';
const password = () => crypto.randomBytes(12).toString('base64url');

async function hasAuthAccount(auth, uid) {
  try {
    await auth.getUser(uid);
    return true;
  } catch (err) {
    if (err.code === 'auth/user-not-found') return false;
    throw err;
  }
}

async function plan(db, auth) {
  const users = await db.collection('users').get();
  const userIds = new Set(users.docs.map((d) => d.id));
  const accounts = [];

  for (const doc of users.docs) {
    if (await hasAuthAccount(auth, doc.id)) continue;
    accounts.push({ uid: doc.id, role: 'patient', displayName: doc.get('full_name') || '', createProfile: false });
  }

  const therapistIds = new Set();
  for (const coll of ['therapist_bridges', 'red_flag_alert_logs']) {
    (await db.collection(coll).get()).docs.forEach((d) => d.get('therapist_id') && therapistIds.add(d.get('therapist_id')));
  }
  for (const uid of therapistIds) {
    if (await hasAuthAccount(auth, uid)) continue;
    accounts.push({ uid, role: 'doctor', displayName: 'Demo Doctor', createProfile: !userIds.has(uid) });
  }
  return accounts;
}

async function create(args, db, auth, firestore) {
  const accounts = await plan(db, auth);
  accounts.forEach((a) =>
    console.log(`${args.apply ? 'CREATE' : 'would create'} auth uid=${a.uid} role=${a.role} email=${a.uid}@${DEMO_DOMAIN}${a.createProfile ? ' + users profile' : ''}`)
  );
  if (!accounts.length) return console.log('Nothing to do: every persona already has an Auth account.');
  if (!args.apply) return console.log('\nDry run only. Re-run with --apply --credentials-out <file outside repo>.');

  if (!args['credentials-out']) throw new Error('--apply requires --credentials-out <file outside the repository>');
  const outFile = assertOutsideRepo(args['credentials-out']);
  if (fs.existsSync(outFile)) throw new Error(`${outFile} already exists; choose a new file`);

  const created = [];
  try {
    for (const a of accounts) {
      const pw = password();
      await auth.createUser({ uid: a.uid, email: `${a.uid}@${DEMO_DOMAIN}`, password: pw, displayName: a.displayName || undefined });
      await auth.setCustomUserClaims(a.uid, { role: a.role });
      const record = { uid: a.uid, role: a.role, email: `${a.uid}@${DEMO_DOMAIN}`, password: pw, createdProfile: false };
      if (a.createProfile) {
        const now = firestore.Timestamp.now();
        await db.collection('users').doc(a.uid).create({
          full_name: a.displayName,
          email: record.email,
          role: a.role,
          created_at: now,
          updated_at: now,
          doctor_profile: { status: 'Active', specialization: 'Demo Practitioner' }
        });
        record.createdProfile = true;
      } else {
        await db.collection('users').doc(a.uid).update({ role: a.role, updated_at: firestore.Timestamp.now() });
      }
      created.push(record);
      console.log(`  created ${a.uid}`);
    }
  } finally {
    // Always persist what was created so a partial run can be rolled back
    fs.writeFileSync(outFile, JSON.stringify({ created_at: new Date().toISOString(), accounts: created }, null, 2), { flag: 'wx' });
    console.log(`\nCredentials for ${created.length} account(s) written to ${outFile} (not printed).`);
  }
}

async function rollback(args, db, auth) {
  const { accounts } = JSON.parse(fs.readFileSync(args.rollback, 'utf8'));
  for (const a of accounts) {
    console.log(`${args.apply ? 'DELETE' : 'would delete'} auth uid=${a.uid}${a.createdProfile ? ' + created users profile' : ''}`);
    if (!args.apply) continue;
    await auth.deleteUser(a.uid).catch((e) => console.log(`  auth: ${e.code}`));
    if (a.createdProfile) await db.collection('users').doc(a.uid).delete();
  }
  // Note: the role mirror written onto pre-existing patient profiles is left in place (harmless display field).
}

(async () => {
  const args = parseArgs();
  try {
    banner(args.rollback ? 'Demo accounts ROLLBACK' : 'Create demo accounts', Boolean(args.apply));
    const { db, auth, firestore } = loadFirebase();
    if (args.rollback) await rollback(args, db, auth);
    else await create(args, db, auth, firestore);
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.code || '', err.message);
    process.exit(1);
  }
})();

#!/usr/bin/env node
/**
 * Exports every document of every root collection (and nested subcollections) to a local
 * JSON file, preserving Firestore types and each document's updateTime.
 * READ-ONLY on Firestore. The output contains personal data and must stay outside the repo.
 *
 *   node scripts/backup-firestore.js --out ../../_backups/firestore-YYYY-MM-DD.json
 *
 * Restore one or all documents from a backup (WRITES; dry-run unless --apply):
 *   node scripts/backup-firestore.js --restore <file> [--doc journal_entries/<id>] [--apply]
 */
const fs = require('fs');
const crypto = require('crypto');
const { parseArgs, loadFirebase, assertOutsideRepo, banner, encodeValue, decodeValue } = require('./lib/common');

async function exportCollection(ref, firestore, out) {
  const snap = await ref.get();
  for (const doc of snap.docs) {
    out.push({
      path: doc.ref.path,
      // full precision: used as an exact write precondition by reconcile-data.js
      updateTime: { seconds: doc.updateTime.seconds, nanoseconds: doc.updateTime.nanoseconds },
      updateTimeIso: doc.updateTime.toDate().toISOString(),
      data: encodeValue(doc.data(), firestore)
    });
    for (const sub of await doc.ref.listCollections()) await exportCollection(sub, firestore, out);
  }
}

async function runExport(args) {
  if (!args.out) throw new Error('--out <file> is required');
  const outFile = assertOutsideRepo(args.out);
  const t = banner('Firestore backup (read-only)', false);
  const { db, firestore } = loadFirebase();

  const documents = [];
  const collections = await db.listCollections();
  for (const c of collections) await exportCollection(c, firestore, documents);

  const body = { project: t.projectId, emulated: t.emulated, exported_at: new Date().toISOString(), count: documents.length, documents };
  const json = JSON.stringify(body, null, 2);
  fs.writeFileSync(outFile, json, { flag: 'wx' }); // never overwrite an existing backup
  const counts = documents.reduce((acc, d) => ((acc[d.path.split('/')[0]] = (acc[d.path.split('/')[0]] || 0) + 1), acc), {});
  console.log(`Exported ${documents.length} documents from ${collections.length} collections:`, counts);
  console.log(`File: ${outFile}`);
  console.log(`SHA-256: ${crypto.createHash('sha256').update(json).digest('hex')}`);
}

async function runRestore(args) {
  const apply = Boolean(args.apply);
  banner('Firestore restore from backup', apply);
  const { db, firestore } = loadFirebase();
  const backup = JSON.parse(fs.readFileSync(args.restore, 'utf8'));
  const docs = args.doc ? backup.documents.filter((d) => d.path === args.doc) : backup.documents;
  if (!docs.length) throw new Error(args.doc ? `Document ${args.doc} is not in the backup` : 'Backup is empty');

  for (const d of docs) {
    const current = await db.doc(d.path).get();
    const state = current.exists ? `exists (updated ${current.updateTime.toDate().toISOString()})` : 'missing';
    console.log(`${apply ? 'RESTORE' : 'would restore'} ${d.path}  [current: ${state}; backup: ${d.updateTimeIso}]`);
    if (apply) await db.doc(d.path).set(decodeValue(d.data, firestore, db));
  }
  console.log(`\n${docs.length} document(s) ${apply ? 'restored' : 'would be restored'}.`);
}

(async () => {
  const args = parseArgs();
  try {
    if (args.restore) await runRestore(args);
    else await runExport(args);
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();

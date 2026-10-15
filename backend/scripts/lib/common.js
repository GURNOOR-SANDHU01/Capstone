/**
 * Shared helpers for operational scripts (backup, reconcile, roles, demo accounts).
 *
 * Every script is DRY-RUN by default and only writes when `--apply` is passed.
 * Scripts use the backend's own Firebase Admin initialization (backend/.env), so they
 * target the same project as the API — or the local emulators when
 * FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are set.
 */
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');

function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split('=');
      if (inline !== undefined) args[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[key] = argv[++i];
      else args[key] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function loadFirebase() {
  // Resolve .env relative to backend/ regardless of the caller's working directory
  process.chdir(BACKEND_ROOT);
  const { db, auth } = require('../../src/config/firebase/admin');
  const firestore = require('firebase-admin/firestore');
  return { db, auth, firestore };
}

function target() {
  const { projectId } = require('../../src/config/env').firebase;
  const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
  return { projectId, emulated, label: emulated ? `${projectId} (LOCAL EMULATOR)` : `${projectId} (LIVE)` };
}

/** Refuses output paths inside the git repository (backups/credentials hold personal data). */
function assertOutsideRepo(filePath) {
  const resolved = path.resolve(filePath);
  const rel = path.relative(REPO_ROOT, resolved);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    throw new Error(`Refusing to write ${resolved}: it is inside the repository. Choose a path outside ${REPO_ROOT}.`);
  }
  return resolved;
}

function banner(name, apply) {
  const t = target();
  console.log(`\n=== ${name} — target: ${t.label} — mode: ${apply ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'} ===\n`);
  return t;
}

/** Firestore value <-> JSON with type tags, so backups round-trip Timestamps etc. exactly. */
function encodeValue(v, firestore) {
  const { Timestamp, GeoPoint, DocumentReference } = firestore;
  if (v === null || v === undefined) return v ?? null;
  if (v instanceof Timestamp) return { __type: 'timestamp', seconds: v.seconds, nanoseconds: v.nanoseconds };
  if (v instanceof GeoPoint) return { __type: 'geopoint', latitude: v.latitude, longitude: v.longitude };
  if (v instanceof DocumentReference) return { __type: 'reference', path: v.path };
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __type: 'bytes', base64: Buffer.from(v).toString('base64') };
  if (Array.isArray(v)) return v.map((x) => encodeValue(x, firestore));
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encodeValue(x, firestore)]));
  return v;
}

function decodeValue(v, firestore, db) {
  const { Timestamp, GeoPoint } = firestore;
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => decodeValue(x, firestore, db));
  switch (v.__type) {
    case 'timestamp':
      return new Timestamp(v.seconds, v.nanoseconds);
    case 'geopoint':
      return new GeoPoint(v.latitude, v.longitude);
    case 'reference':
      return db.doc(v.path);
    case 'bytes':
      return Buffer.from(v.base64, 'base64');
    default:
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decodeValue(x, firestore, db)]));
  }
}

module.exports = {
  BACKEND_ROOT,
  REPO_ROOT,
  parseArgs,
  loadFirebase,
  target,
  assertOutsideRepo,
  banner,
  encodeValue,
  decodeValue
};

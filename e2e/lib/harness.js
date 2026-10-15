/**
 * E2E harness: runs the real Express backend against the Firebase emulators.
 *
 * Safety: the project ID must start with "demo-" (Firebase treats demo-* projects as
 * emulator-only; they cannot reach production), and the backend is started from an empty
 * working directory with credentials cleared, so it can never load backend/.env or the
 * service-account key.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PROJECT_ID = 'demo-sentience';
const AUTH_HOST = '127.0.0.1:9099';
const FIRESTORE_HOST = '127.0.0.1:8080';
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 5055);
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_DIR = path.resolve(__dirname, '..', 'artifacts', 'runtime');

if (!PROJECT_ID.startsWith('demo-')) throw new Error('E2E must use a demo-* project');

const backendEnv = () => ({
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(BACKEND_PORT),
  FIREBASE_PROJECT_ID: PROJECT_ID,
  FIRESTORE_EMULATOR_HOST: FIRESTORE_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
  GCLOUD_PROJECT: PROJECT_ID,
  FIREBASE_SERVICE_ACCOUNT_PATH: '',
  FIREBASE_SERVICE_ACCOUNT_JSON: '',
  FIREBASE_CLIENT_EMAIL: '',
  FIREBASE_PRIVATE_KEY: '',
  GOOGLE_APPLICATION_CREDENTIALS: '',
  USE_MOCK_MODELS: 'true',
  RATE_LIMIT_MAX: '100000'
});

async function waitFor(url, { timeoutMs = 30000, label = url } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return res;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function assertEmulatorsUp() {
  await waitFor(`http://${AUTH_HOST}/`, { label: 'Auth emulator' });
  await waitFor(`http://${FIRESTORE_HOST}/`, { label: 'Firestore emulator' });
}

async function resetEmulators() {
  const fsReset = await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  const authReset = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' });
  if (!fsReset.ok || !authReset.ok) throw new Error('Failed to reset emulator data');
}

function startBackend() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true }); // empty cwd: no .env, no key file
  const logFile = fs.openSync(path.resolve(__dirname, '..', 'artifacts', 'backend.log'), 'w');
  const child = spawn(process.execPath, [path.join(ROOT, 'backend', 'src', 'server.js')], {
    cwd: RUNTIME_DIR,
    env: backendEnv(),
    stdio: ['ignore', logFile, logFile]
  });
  return child;
}

async function startBackendAndWait() {
  const child = startBackend();
  await waitFor(`${BACKEND_URL}/api/health`, { label: 'backend' });
  const fb = await (await fetch(`${BACKEND_URL}/api/health/firebase`)).json();
  if (fb.data.firebase.projectId !== PROJECT_ID) {
    child.kill();
    throw new Error(`Backend is not pointed at ${PROJECT_ID} (got ${fb.data.firebase.projectId})`);
  }
  return child;
}

/** Runs a backend operational script (e.g. scripts/set-role.js) against the emulators. */
function runBackendScript(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'backend', 'scripts', script), ...args], {
      cwd: RUNTIME_DIR,
      env: backendEnv()
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${script} exited ${code}:\n${out}`))));
  });
}

/** Minimal assertion/report helper */
function createReporter(name, { onFail } = {}) {
  const results = [];
  return {
    async step(title, fn) {
      try {
        await fn();
        results.push({ title, ok: true });
        console.log(`  ✔ ${title}`);
      } catch (err) {
        results.push({ title, ok: false, error: err.message });
        console.log(`  ✘ ${title}\n      ${err.message}`);
        if (onFail) await onFail(title).catch(() => {});
      }
    },
    summary() {
      const failed = results.filter((r) => !r.ok);
      console.log(`\n${name}: ${results.length - failed.length}/${results.length} passed`);
      return failed.length === 0;
    }
  };
}

function expect(actual, label = 'value') {
  return {
    toBe(expected) {
      if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`${label}: expected truthy, got ${JSON.stringify(actual)}`);
    },
    toContain(item) {
      if (!actual || !actual.includes(item)) throw new Error(`${label}: expected to contain ${JSON.stringify(item)}`);
    },
    notToContain(item) {
      if (actual && actual.includes(item)) throw new Error(`${label}: expected NOT to contain ${JSON.stringify(item)}`);
    }
  };
}

module.exports = {
  PROJECT_ID,
  AUTH_HOST,
  FIRESTORE_HOST,
  BACKEND_PORT,
  BACKEND_URL,
  assertEmulatorsUp,
  resetEmulators,
  startBackendAndWait,
  runBackendScript,
  createReporter,
  expect,
  waitFor
};

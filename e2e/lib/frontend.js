/**
 * Starts the real Vite dev server for the React app, configured for Live mode against the
 * Firebase Auth emulator and the E2E backend (via the Vite /api proxy).
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const H = require('./harness');

const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT || 5174);
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const FRONTEND_DIR = path.resolve(__dirname, '..', '..', 'frontend');

async function startFrontend() {
  const log = fs.openSync(path.resolve(__dirname, '..', 'artifacts', 'vite.log'), 'w');
  const child = spawn(process.execPath, [path.join(FRONTEND_DIR, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(FRONTEND_PORT), '--strictPort'], {
    cwd: FRONTEND_DIR,
    env: {
      ...process.env,
      VITE_FIREBASE_API_KEY: 'demo-api-key',
      VITE_FIREBASE_PROJECT_ID: H.PROJECT_ID,
      VITE_FIREBASE_AUTH_DOMAIN: `${H.PROJECT_ID}.firebaseapp.com`,
      // Every Firebase variable is set explicitly: process env has priority over frontend/.env.local,
      // so a real project config on disk can never leak into the emulator tests
      VITE_FIREBASE_APP_ID: 'demo-app',
      VITE_FIREBASE_STORAGE_BUCKET: '',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '',
      VITE_FIREBASE_MEASUREMENT_ID: '',
      VITE_FIREBASE_AUTH_EMULATOR_HOST: H.AUTH_HOST,
      VITE_API_BASE_URL: '/api',
      VITE_DEV_API_PROXY_TARGET: H.BACKEND_URL
    },
    stdio: ['ignore', log, log]
  });
  await H.waitFor(FRONTEND_URL, { label: 'Vite dev server', timeoutMs: 60000 });
  // Safety: the served app must target the emulator project, never the live one
  const served = await (await fetch(`${FRONTEND_URL}/src/services/firebase.js`)).text();
  if (!served.includes(H.PROJECT_ID) || served.includes('sentience-6f40e')) {
    child.kill();
    throw new Error('Frontend is not configured for the emulator project; refusing to run browser tests');
  }
  return child;
}

module.exports = { startFrontend, FRONTEND_URL };

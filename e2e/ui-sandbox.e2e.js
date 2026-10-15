/**
 * Regression test: the offline Sandbox demo (no Firebase config, no backend) still works.
 *
 *   node ui-sandbox.e2e.js        (no emulators or backend needed)
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');
const H = require('./lib/harness');
const { monitor, visitAllTabs } = require('./lib/monitor');

const PORT = 5175;
const URL = `http://localhost:${PORT}`;
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');
const ART = path.resolve(__dirname, 'artifacts');

(async () => {
  const r = H.createReporter('Sandbox UI');
  let vite;
  let browser;
  const errors = [];
  fs.mkdirSync(ART, { recursive: true });
  try {
    const env = { ...process.env };
    for (const k of Object.keys(env)) if (k.startsWith('VITE_')) delete env[k];
    // Sandbox mode; all Firebase variables blanked so frontend/.env.local cannot switch on Live mode
    for (const k of ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID', 'MEASUREMENT_ID', 'AUTH_EMULATOR_HOST']) {
      env[`VITE_FIREBASE_${k}`] = '';
    }
    vite = spawn(process.execPath, [path.join(FRONTEND_DIR, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort'], {
      cwd: FRONTEND_DIR,
      env,
      stdio: 'ignore'
    });
    await H.waitFor(URL, { label: 'Vite (sandbox)', timeoutMs: 60000 });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.message));
    const m = monitor(page, 'sandbox');
    const apiCalls = [];
    page.on('request', (req) => req.url().includes('/api/') && apiCalls.push(req.url()));

    await r.step('sandbox login with demo credentials', async () => {
      await page.goto(URL);
      await page.getByText('Sandbox Mode', { exact: true }).waitFor();
      await page.getByRole('button', { name: /Sign In as/ }).click();
      await page.getByRole('button', { name: /Sign Out/ }).first().waitFor();
    });

    await r.step('journal works offline (localStorage) and keeps the privacy choice', async () => {
      await page.getByRole('button', { name: 'Journal & Diary', exact: true }).first().click();
      await page.getByRole('button', { name: /Private Only/ }).click();
      await page.getByPlaceholder(/What is on your mind today/).fill('Sandbox entry stays in this browser.');
      await page.getByRole('button', { name: /Save Entry/ }).click();
      await page.getByText('Journal Saved').waitFor();
      const card = page.locator('.card', { hasText: 'Sandbox entry stays in this browser.' }).last();
      H.expect(await card.innerText(), 'privacy kept').toContain('Private');
    });

    await r.step('dashboard, insights and appointments render with demo data', async () => {
      await page.getByRole('button', { name: 'Mood & Insights', exact: true }).first().click();
      await page.getByText(/Based on \d+ entries/).waitFor();
      await page.getByRole('button', { name: 'Appointments', exact: true }).first().click();
      await page.getByText('Dr. Sarah Jenkins').first().waitFor();
    });

    await r.step('every sandbox patient tab loads without errors', async () => {
      await visitAllTabs(page);
    });

    await r.step('doctor and admin demo portals still open', async () => {
      await page.getByRole('button', { name: /Sign Out/ }).first().click();
      await page.getByRole('button', { name: /Doctor/ }).first().click();
      await page.getByRole('button', { name: /Sign In as/ }).click();
      await page.getByText('Doctor Care Dashboard').waitFor();
      await page.getByRole('button', { name: 'Doctor Safety Center', exact: true }).first().click();
      await page.getByText(/Patient:/).first().waitFor();
      await page.getByRole('button', { name: /Sign Out/ }).first().click();
      await page.getByRole('button', { name: /Admin/ }).first().click();
      await page.getByRole('button', { name: /Sign In as/ }).click();
      await page.getByText('System Administrator Hub').waitFor();
      await page.screenshot({ path: path.join(ART, 'sandbox-admin.png'), fullPage: true });
    });

    await r.step('no console errors or failed requests (and no API calls in Sandbox)', async () => {
      H.expect(errors.join(' | '), 'page errors').toBe('');
      m.expectClean();
      H.expect(apiCalls.length, `API calls in sandbox: ${apiCalls.join(', ')}`).toBe(0);
    });
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (vite) vite.kill();
    if (!r.summary()) process.exitCode = 1;
    setTimeout(() => process.exit(process.exitCode || 0), 200);
  }
})();

/**
 * Browser end-to-end test of the patient experience (Live mode) in a real Chrome:
 * React (Vite) -> Firebase Auth emulator + Express backend -> Firestore emulator.
 *
 * Registration, onboarding, profile, journal (create / edit / share / delete), persistence across
 * reloads and separate sessions, cross-patient isolation, insights + remembered patterns, error
 * handling, and every patient tab — with console errors, failed requests and HTTP errors monitored.
 *
 *   (terminal 1) npm run emulators
 *   (terminal 2) npm run test:ui
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const H = require('./lib/harness');
const { startFrontend, FRONTEND_URL } = require('./lib/frontend');
const { monitor, visitAllTabs } = require('./lib/monitor');

const ART = path.resolve(__dirname, 'artifacts');
const RUN = Date.now();
const EMAIL = `ui.patient.${RUN}@e2e.test`;
const PASSWORD = 'Passw0rd!ui';
const ENTRY_TEXT = `Walked by the lake today, felt calmer. Reach me at lake.walker@example.com`;

async function signIn(page, email) {
  await page.goto(FRONTEND_URL);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole('button', { name: /Sign In as/ }).click();
  await page.getByRole('button', { name: /Sign Out/ }).first().waitFor();
}

const nav = (page, label) => page.getByRole('button', { name: label, exact: true }).first().click();
// Saved entries only (they have a delete button); the composer card can also contain the typed text
const entryCard = (page, text) =>
  page.locator('.card', { hasText: text }).filter({ has: page.locator('button[title="Delete entry"], button[title^="Click again"]') }).last();

async function writeEntry(page, text, tag) {
  await page.getByPlaceholder(/What is on your mind today/).fill(text);
  if (tag) {
    await page.getByPlaceholder(/Add tag/).fill(tag);
    await page.getByPlaceholder(/Add tag/).press('Enter');
  }
  await page.getByRole('button', { name: /Save Entry/ }).click();
  await entryCard(page, text.slice(0, 30)).waitFor();
}

(async () => {
  let failShot = async () => {};
  const r = H.createReporter('UI E2E', { onFail: (title) => failShot(title) });
  let backend;
  let frontend;
  let browser;
  const monitors = [];
  fs.mkdirSync(ART, { recursive: true });

  try {
    await H.assertEmulatorsUp();
    await H.resetEmulators();
    backend = await H.startBackendAndWait();
    frontend = await startFrontend();
    browser = await chromium.launch({ channel: 'chrome', headless: true });

    const newPage = async (label) => {
      const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
      page.setDefaultTimeout(15000);
      const m = monitor(page, label);
      monitors.push(m);
      return { page, m };
    };
    const { page, m } = await newPage('patient');
    const shot = (name) => page.screenshot({ path: path.join(ART, `${name}.png`), fullPage: true });
    failShot = (title) => shot(`FAIL-${title.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`);
    console.log(`Frontend ${FRONTEND_URL} -> backend ${H.BACKEND_URL} -> emulators (${H.PROJECT_ID})\n`);

    await r.step('app loads in Live mode with no demo credentials', async () => {
      await page.goto(FRONTEND_URL);
      await page.getByText('Live Firebase').waitFor();
      await page.getByText('Secure Portal').waitFor();
      H.expect(await page.locator('input[type="email"]').first().inputValue(), 'email prefill').toBe('');
      await shot('01-login');
    });

    await r.step('wrong password shows a friendly error and does not sign in', async () => {
      await m.expectedFailures(async () => {
        await page.locator('input[type="email"]').first().fill('nobody@e2e.test');
        await page.locator('input[type="password"]').first().fill('wrong-password');
        await page.getByRole('button', { name: /Sign In as/ }).click();
        await page.getByText(/Incorrect email or password|No account exists/).waitFor();
      });
    });

    await r.step('patient registers through Firebase Auth', async () => {
      await page.getByText('Create an account').click();
      await page.getByPlaceholder('e.g. Alex Morgan').fill('Asha Rao');
      await page.getByPlaceholder('alex@example.com').fill(EMAIL);
      await page.getByPlaceholder('Create a strong password').fill(PASSWORD);
      await page.locator('form button[type="submit"]').click();
      await page.getByRole('button', { name: /Continue/ }).waitFor();
    });

    await r.step('onboarding wizard (incl. safety questions) is saved by the backend', async () => {
      const cont = () => page.getByRole('button', { name: /Continue/ }).click();
      const phone = page.locator('input.input-field[type="text"]').nth(1);
      for (let i = 0; i < 2 && !(await phone.isVisible()); i++) await cont();
      H.expect(await page.locator('input.input-field[type="text"]').nth(0).inputValue(), 'name from registration').toBe('Asha Rao');
      await phone.fill('+91 98765 43210');
      await cont();
      await page.getByPlaceholder('e.g. Jane Sandhu').fill('Ravi Rao');
      await page.getByPlaceholder('+1 (555) 987-6543').fill('+91 98765 00000');
      await page.locator('#emergency-consent').check();
      await cont();
      await cont();
      await page.getByText(/currently in danger/).waitFor(); // immediate-risk question is answerable
      await page.getByRole('button', { name: /Complete Onboarding/ }).click();
      await page.getByText('Journal & Diary').first().waitFor();
      await shot('02-dashboard');
    });

    await r.step('new account shows honest empty states (no invented data)', async () => {
      await nav(page, 'Dashboard');
      await page.getByText('Write a journal entry to start tracking').waitFor();
      await page.getByText('No journal entries yet.').waitFor();
    });

    await r.step('validation: an empty journal entry is rejected with a message', async () => {
      await nav(page, 'Journal & Diary');
      await page.getByRole('button', { name: /Save Entry/ }).click();
      await page.getByText('Input Required').waitFor();
    });

    await r.step('unsaved journal text survives navigating to another screen and back', async () => {
      await page.getByPlaceholder(/What is on your mind today/).fill('Half-written draft that must not be lost');
      await nav(page, 'Dashboard');
      await nav(page, 'Journal & Diary');
      H.expect(await page.getByPlaceholder(/What is on your mind today/).inputValue(), 'draft').toBe('Half-written draft that must not be lost');
    });

    await r.step('journal entry is created through the API with server-side PII masking', async () => {
      await nav(page, 'Journal & Diary');
      await page.getByText('No journal entries yet').waitFor();
      await writeEntry(page, ENTRY_TEXT, 'walk');
      const text = await entryCard(page, 'Walked by the lake').innerText();
      H.expect(text, 'masked text').toContain('<EMAIL>');
      H.expect(text, 'raw email').notToContain('lake.walker@example.com');
      H.expect(text, 'AI CBT prompt shown').toContain('CBT prompt:');
      await shot('03-journal-saved');
    });

    await r.step('entry and completed onboarding persist across a full page reload', async () => {
      await page.reload();
      await nav(page, 'Journal & Diary');
      await entryCard(page, 'Walked by the lake').waitFor();
    });

    await r.step('editing an entry re-analyses it on the server and persists', async () => {
      await entryCard(page, 'Walked by the lake').getByTitle('Edit entry').click();
      await page.getByLabel('Edit entry text').fill('Walked by the lake again, felt good and calm.');
      await page.getByLabel('Mood').selectOption('Joyful');
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await page.getByText('Entry Updated').waitFor();
      await page.reload();
      await nav(page, 'Journal & Diary');
      const card = entryCard(page, 'Walked by the lake again');
      await card.waitFor();
      H.expect(await card.innerText(), 'edited mood').toContain('Joyful');
    });

    await r.step('sharing toggle updates the entry on the server', async () => {
      const badge = entryCard(page, 'Walked by the lake again').getByRole('button', { name: /Shared with Doctor|Private/ });
      const before = (await badge.innerText()).trim();
      await badge.click();
      await page.getByText('Sharing Updated').waitFor();
      await page.reload();
      await nav(page, 'Journal & Diary');
      const after = (await entryCard(page, 'Walked by the lake again').getByRole('button', { name: /Shared with Doctor|Private/ }).innerText()).trim();
      H.expect(after !== before, `visibility changed (${before} -> ${after})`).toBe(true);
    });

    await r.step('profile changes are saved and survive a reload', async () => {
      await nav(page, 'Profile & Settings');
      const name = page.locator('form input[type="text"]').first();
      await name.fill('Asha R. Rao');
      await page.getByRole('button', { name: /Save Changes/ }).click();
      await page.getByText('Profile Updated').waitFor();
      await page.reload();
      await nav(page, 'Profile & Settings');
      await page.getByRole('heading', { name: 'Asha R. Rao' }).waitFor();
      H.expect(await page.locator('input[type="email"]').inputValue(), 'email read-only value').toBe(EMAIL);
    });

    await r.step('insights are computed from real entries; remembered patterns accept feedback', async () => {
      await nav(page, 'Journal & Diary');
      await writeEntry(page, 'Another happy walk in the park, great mood.', 'walk');
      await writeEntry(page, 'Work deadline stress all day.', 'work');
      await writeEntry(page, 'More work deadline stress tonight.', 'work');
      await nav(page, 'Mood & Insights');
      await page.getByText(/Entries tagged #walk average/).waitFor();
      await page.getByText(/Entries tagged #work average/).waitFor();
      await page.getByText('Active coping (walking, music, breathing) aids user emotional recovery.').first().waitFor();
      await page.getByRole('button', { name: 'Fits me' }).first().click();
      await page.getByText(/Thanks — marked "agree"/).waitFor();
      await shot('04-insights');
    });

    await r.step('activity history lists the real entries', async () => {
      await nav(page, 'Activity History');
      await page.getByText(/Journal Entry: /).first().waitFor();
    });

    await r.step('AI companion replies through the backend; crisis language gets safety resources', async () => {
      await nav(page, 'AI Companion');
      const input = page.getByPlaceholder('Share what you are feeling...');
      await input.fill('I am stressed about a work deadline');
      await page.getByRole('button', { name: /^Send$/ }).click();
      await page.getByText('What specifically felt most challenging about this situation').waitFor();
      await input.fill('Sometimes I think there is no reason to live');
      await page.getByRole('button', { name: /^Send$/ }).click();
      await page.getByText(/please call your local emergency number or a crisis line/).waitFor();
      // the conversation survives switching screens
      await nav(page, 'Dashboard');
      await nav(page, 'AI Companion');
      await page.getByText('I am stressed about a work deadline').waitFor();
    });

    await r.step('validation: an invalid phone number is rejected before saving the profile', async () => {
      await nav(page, 'Profile & Settings');
      const phone = page.locator('form input[type="text"]').nth(1);
      await phone.fill('call me maybe');
      await page.getByRole('button', { name: /Save Changes/ }).click();
      await page.getByText(/Enter a valid phone number/).waitFor();
      await phone.fill('+91 98765 43210');
    });

    await r.step('the same account in a separate browser session sees the same journal', async () => {
      const { page: second } = await newPage('patient-session-2');
      await signIn(second, EMAIL);
      await nav(second, 'Journal & Diary');
      await entryCard(second, 'Walked by the lake again').waitFor();
      await entryCard(second, 'More work deadline stress').waitFor();
      await second.context().close();
    });

    await r.step('a different patient cannot see any of these entries', async () => {
      const { page: other } = await newPage('other-patient');
      await other.goto(FRONTEND_URL);
      await other.getByText('Create an account').click();
      await other.getByPlaceholder('e.g. Alex Morgan').fill('Ben Other');
      await other.getByPlaceholder('alex@example.com').fill(`other.${RUN}@e2e.test`);
      await other.getByPlaceholder('+91 98765 43210').fill('+91 90000 11111');
      await other.getByPlaceholder('Create a strong password').fill(PASSWORD);
      await other.locator('form button[type="submit"]').click();
      const cont = () => other.getByRole('button', { name: /Continue/ }).click();
      const contact = other.getByPlaceholder('e.g. Jane Sandhu');
      for (let i = 0; i < 3 && !(await contact.isVisible()); i++) {
        await cont();
        await other.waitForTimeout(150);
      }
      await contact.fill('Someone');
      await other.getByPlaceholder('+1 (555) 987-6543').fill('+91 90000 22222');
      await other.locator('#emergency-consent').check();
      await cont();
      await cont();
      await other.getByRole('button', { name: /Complete Onboarding/ }).click();
      await nav(other, 'Journal & Diary');
      await other.getByText('No journal entries yet').waitFor();
      H.expect(await other.locator('body').innerText(), 'isolation').notToContain('Walked by the lake');
      await other.context().close();
    });

    await r.step('network failure shows an error with retry, and retry recovers', async () => {
      await m.expectedFailures(async () => {
        await page.route('**/api/journal-entries**', (route) => route.abort());
        await page.reload();
        await nav(page, 'Journal & Diary');
        await page.getByText('Could not load your journal').waitFor();
        await shot('05-network-error');
        await page.unroute('**/api/journal-entries**');
      });
      await page.getByRole('button', { name: /Retry/ }).click();
      await entryCard(page, 'Walked by the lake again').waitFor();
    });

    await r.step('delete requires confirmation and removes the entry permanently', async () => {
      const card = entryCard(page, 'Walked by the lake again');
      await card.getByTitle('Delete entry').click();
      await card.getByRole('button', { name: /Confirm/ }).click();
      await page.getByText('Entry Removed').waitFor();
      await page.reload();
      await nav(page, 'Journal & Diary');
      await entryCard(page, 'More work deadline stress').waitFor();
      H.expect(await page.locator('body').innerText(), 'deleted').notToContain('Walked by the lake again');
    });

    await r.step('every patient tab loads without errors or failed requests', async () => {
      const tabs = await visitAllTabs(page);
      H.expect(tabs.length >= 10, `visited ${tabs.length} tabs`).toBe(true);
    });

    await r.step('sign out returns to the login screen and clears unsaved drafts', async () => {
      await nav(page, 'Journal & Diary');
      await page.getByPlaceholder(/What is on your mind today/).fill('private draft before sign-out');
      await page.getByRole('button', { name: /Sign Out/ }).first().click();
      await page.getByText('Live Firebase').waitFor();
      await signIn(page, EMAIL);
      await nav(page, 'Journal & Diary');
      H.expect(await page.getByPlaceholder(/What is on your mind today/).inputValue(), 'draft cleared').toBe('');
      await page.getByRole('button', { name: /Sign Out/ }).first().click();
    });

    await r.step('no console errors, failed requests or HTTP errors in any session', async () => {
      monitors.forEach((mon) => mon.expectClean());
    });
  } catch (err) {
    console.error('UI E2E setup failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (frontend) frontend.kill();
    if (backend) backend.kill();
    if (!r.summary()) process.exitCode = 1;
    console.log(`Screenshots: ${ART}`);
    setTimeout(() => process.exit(process.exitCode || 0), 200);
  }
})();

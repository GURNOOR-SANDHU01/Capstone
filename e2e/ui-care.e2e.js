/**
 * Multi-role browser end-to-end test (patient, doctor, admin in separate Chrome sessions):
 * consent, shared journals, appointments, messaging, care instructions, safety alerts, admin tools.
 * React (Vite) -> Firebase Auth emulator + Express -> Firestore emulator. Never touches live Firebase.
 *
 *   (terminal 1) npm run emulators
 *   (terminal 2) node ui-care.e2e.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
const H = require('./lib/harness');
const { startFrontend, FRONTEND_URL } = require('./lib/frontend');
const { monitor, visitAllTabs } = require('./lib/monitor');

const ART = path.resolve(__dirname, 'artifacts');
const PW = 'Passw0rd!care';
const DOCTOR = { email: 'dr.meera@e2e.test', name: 'Dr. Meera Iyer' };
const ADMIN = { email: 'admin@e2e.test', name: 'Platform Admin' };
const PATIENT = { email: 'asha.care@e2e.test', name: 'Asha Rao' };
const NEW_DOCTOR = { email: 'ravi.newdoc@e2e.test', name: 'Dr. Ravi Menon' };
const monitors = [];

/** Creates an Auth account, initializes its backend profile, then assigns a role with scripts/set-role.js */
async function provision(account, role) {
  const app = initializeApp({ apiKey: 'demo-api-key', projectId: H.PROJECT_ID }, account.email);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${H.AUTH_HOST}`, { disableWarnings: true });
  const cred = await createUserWithEmailAndPassword(auth, account.email, PW);
  await updateProfile(cred.user, { displayName: account.name });
  const token = await cred.user.getIdToken(true);
  await fetch(`${H.BACKEND_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } });
  await H.runBackendScript('set-role.js', ['--uid', cred.user.uid, '--role', role, '--apply']);
  await deleteApp(app);
  return cred.user.uid;
}

async function newSession(browser, errors, label) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  monitors.push(monitor(page, label));
  return page;
}

const nav = (page, label) => page.getByRole('button', { name: label, exact: true }).first().click();

async function signIn(page, account) {
  await page.goto(FRONTEND_URL);
  await page.locator('input[type="email"]').first().fill(account.email);
  await page.locator('input[type="password"]').first().fill(PW);
  await page.getByRole('button', { name: /Sign In as/ }).click();
  await page.getByRole('button', { name: /Sign Out/ }).first().waitFor();
}

(async () => {
  const r = H.createReporter('Multi-role UI E2E');
  let backend;
  let frontend;
  let browser;
  const errors = [];
  fs.mkdirSync(ART, { recursive: true });

  try {
    await H.assertEmulatorsUp();
    await H.resetEmulators();
    backend = await H.startBackendAndWait();
    frontend = await startFrontend();
    await provision(DOCTOR, 'doctor');
    await provision(ADMIN, 'admin');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    console.log(`Provisioned doctor + admin via scripts/set-role.js; frontend ${FRONTEND_URL}\n`);

    const patient = await newSession(browser, errors, 'patient');
    const doctor = await newSession(browser, errors, 'doctor');
    const admin = await newSession(browser, errors, 'admin');
    const shot = (page, name) => page.screenshot({ path: path.join(ART, `care-${name}.png`), fullPage: true });

    await r.step('patient registers and completes onboarding', async () => {
      await patient.goto(FRONTEND_URL);
      await patient.getByText('Create an account').click();
      await patient.getByPlaceholder('e.g. Alex Morgan').fill(PATIENT.name);
      await patient.getByPlaceholder('alex@example.com').fill(PATIENT.email);
      await patient.getByPlaceholder('+91 98765 43210').fill('+91 98765 43210');
      await patient.getByPlaceholder('Create a strong password').fill(PW);
      await patient.locator('form button[type="submit"]').click();
      const cont = () => patient.getByRole('button', { name: /Continue/ }).click();
      // The wizard starts at the first incomplete section (name + phone were given at registration)
      const contact = patient.getByPlaceholder('e.g. Jane Sandhu');
      for (let i = 0; i < 3 && !(await contact.isVisible()); i++) {
        await cont();
        await patient.waitForTimeout(150);
      }
      await contact.fill('Ravi Rao');
      await patient.getByPlaceholder('+1 (555) 987-6543').fill('+91 98765 00000');
      await patient.locator('#emergency-consent').check();
      await cont();
      await cont();
      await patient.getByRole('button', { name: /Complete Onboarding/ }).click();
      await patient.getByRole('button', { name: /Sign Out/ }).first().waitFor();
    });

    await r.step('patient grants the doctor full journal access from Profile & Settings', async () => {
      await nav(patient, 'Profile & Settings');
      await patient.getByText('Care Team Access').waitFor();
      // registration details survive the sign-up race (no email-prefix name, phone kept)
      await patient.getByRole('heading', { name: PATIENT.name }).waitFor();
      H.expect(await patient.locator('input[type="text"]').nth(1).inputValue(), 'phone').toBe('+91 98765 43210');
      await patient.getByLabel('Access level').selectOption('full_reflection_access');
      await patient.getByRole('button', { name: /Grant Access/ }).click();
      await patient.getByText('Access Granted').waitFor();
      await patient.getByRole('button', { name: /Revoke/ }).waitFor();
      await shot(patient, '01-care-team');
    });

    await r.step('patient writes a shared journal entry', async () => {
      await nav(patient, 'Journal & Diary');
      await patient.getByPlaceholder(/What is on your mind today/).fill('Shared reflection for my doctor: sleep improved this week.');
      await patient.getByRole('button', { name: /Save Entry/ }).click();
      await patient.getByText('Journal Saved').waitFor();
    });

    await r.step('patient requests an appointment with the doctor from the directory', async () => {
      await nav(patient, 'Appointments');
      await patient.getByRole('button', { name: /Schedule Consultation/ }).click();
      await patient.getByText(DOCTOR.name).first().waitFor();
      await patient.getByPlaceholder(/Briefly describe your current symptoms/).fill('Follow-up on sleep and stress');
      await patient.getByRole('button', { name: /Send Appointment Request/ }).click();
      await patient.getByText(/Appointment request sent/).waitFor();
      await patient.getByText('Follow-up on sleep and stress').first().waitFor();
    });

    await r.step('patient sends a secure message to the doctor', async () => {
      await nav(patient, 'Care Team Messages');
      await patient.getByPlaceholder(/Type a secure message/).fill('Hello doctor, looking forward to our session.');
      await patient.getByRole('button', { name: /^Send$/ }).click();
      await patient.getByText('Hello doctor, looking forward to our session.').waitFor();
    });

    await r.step('doctor signs in and sees the consenting patient on the dashboard', async () => {
      await signIn(doctor, DOCTOR);
      await doctor.getByText('Doctor Care Dashboard').waitFor();
      await doctor.getByText(PATIENT.name).first().waitFor();
      await shot(doctor, '02-doctor-dashboard');
    });

    await r.step('doctor reads the shared journal entry', async () => {
      await nav(doctor, 'Shared Journals');
      await doctor.getByText('sleep improved this week').waitFor();
    });

    await r.step('doctor confirms the appointment and a video link is issued', async () => {
      await nav(doctor, 'Appointments');
      await doctor.getByRole('button', { name: /Confirm Request/ }).click();
      await doctor.getByText('Appointment Confirmed').waitFor();
    });

    await r.step('doctor proposes a new time for a second request; patient accepts it', async () => {
      await nav(patient, 'Appointments');
      await patient.getByRole('button', { name: /Schedule Consultation/ }).click();
      await patient.getByPlaceholder(/Briefly describe your current symptoms/).fill('Second check-in');
      await patient.getByRole('button', { name: /Send Appointment Request/ }).click();
      await patient.getByText(/Appointment request sent/).waitFor();

      await nav(doctor, 'Doctor Consultations');
      await nav(doctor, 'Appointments');
      const card = doctor.locator('.card', { hasText: 'Second check-in' }).last();
      await card.getByRole('button', { name: 'Reschedule' }).click();
      const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
      await doctor.locator('input[type="date"]').last().fill(tomorrow);
      await doctor.getByRole('button', { name: /Send Reschedule Request/ }).click();
      await doctor.getByText('Reschedule Sent').waitFor();

      await nav(patient, 'Dashboard');
      await nav(patient, 'Appointments');
      await patient.getByRole('button', { name: /Accept New Time/ }).click();
      await patient.getByText('Time Accepted').waitFor();
      await nav(patient, 'Doctor Consultations');
      const joins = patient.getByRole('link').filter({ hasText: 'Join Video Call' });
      await joins.nth(1).waitFor(); // wait for the list to load before counting
      H.expect(await joins.count(), 'two confirmed consultations').toBe(2);
    });

    await r.step('doctor reads and replies to the message', async () => {
      await nav(doctor, 'Secure Messaging');
      await doctor.getByText('Hello doctor, looking forward to our session.').waitFor();
      await doctor.getByPlaceholder(/Type a secure message/).fill('Hello Asha, see you at the session.');
      await doctor.getByRole('button', { name: /^Send$/ }).click();
      await doctor.getByText('Hello Asha, see you at the session.').waitFor();
    });

    await r.step('doctor issues a care instruction', async () => {
      await nav(doctor, 'Care Instructions');
      await doctor.getByRole('button', { name: /Issue Reminder Instruction/ }).click();
      await doctor.getByPlaceholder(/Magnesium Glycinate 200mg/).fill('Evening breathing exercise');
      await doctor.getByRole('button', { name: /Issue Care Instruction/ }).click();
      await doctor.getByText('Reminder Created').waitFor();
      await doctor.getByText('Evening breathing exercise').first().waitFor();
    });

    await r.step('patient sees the confirmed consultation, reminder and reply', async () => {
      await nav(patient, 'Doctor Consultations');
      const join = patient.getByRole('link').filter({ hasText: 'Join Video Call' }).first();
      await join.waitFor();
      const href = await join.getAttribute('href');
      H.expect(href, 'meeting link').toContain('https://meet.jit.si/SentiMed-');
      await nav(patient, 'Reminders');
      await patient.getByText('Evening breathing exercise').waitFor();
      await nav(patient, 'Care Team Messages');
      await patient.getByText('Hello Asha, see you at the session.').waitFor();
      await shot(patient, '03-patient-messages');
    });

    await r.step('a crisis journal entry alerts the doctor, who documents and resolves it', async () => {
      await nav(patient, 'Journal & Diary');
      await patient.getByRole('button', { name: /Private Only/ }).click();
      await patient.getByPlaceholder(/What is on your mind today/).fill('Some days I feel there is no reason to live.');
      await patient.getByRole('button', { name: /Save Entry/ }).click();
      await patient.getByText('Support Is Available').waitFor();

      await nav(doctor, 'Doctor Safety Center');
      await doctor.getByText(`Patient: ${PATIENT.name}`).waitFor();
      const pageText = await doctor.locator('body').innerText();
      H.expect(pageText, 'private journal text not in alert').notToContain('no reason to live');
      await doctor.getByRole('button', { name: /Mark Reviewed/ }).click();
      await doctor.getByPlaceholder(/Document the follow-up/).fill('Called patient, safety plan reviewed.');
      await doctor.getByRole('button', { name: /Confirm Reviewed/ }).click();
      await doctor.getByText('Alert Reviewed').waitFor();
      await shot(doctor, '04-safety-resolved');
    });

    await r.step('admin dashboard, clinic registration and the role audit log', async () => {
      await signIn(admin, ADMIN);
      await admin.getByText('System Administrator Hub').waitFor();
      await nav(admin, 'Clinic Network');
      await admin.getByRole('button', { name: /Register New Clinic/ }).click();
      const inputs = admin.locator('.modal-content input.input-field');
      await inputs.nth(0).fill('SentiMed Central Clinic');
      await inputs.nth(1).fill('Mumbai, India');
      await inputs.nth(2).fill('+91 22 4000 0000');
      await admin.getByRole('button', { name: /Register Clinic/ }).click();
      await admin.getByText('Clinic Registered').waitFor();
      await nav(admin, 'Doctor Management');
      await admin.getByText(DOCTOR.name).first().waitFor();
      await nav(admin, 'Audit & Security Logs');
      await admin.getByText('SET_ROLE').first().waitFor();
      await admin.getByText('ADD_CLINIC').first().waitFor();
      await shot(admin, '05-admin-audit');
    });

    await r.step('admin promotes a newly registered account to doctor through the UI', async () => {
      const newDoc = await newSession(browser, errors, 'new-doctor');
      await newDoc.goto(FRONTEND_URL);
      await newDoc.getByText('Create an account').click();
      await newDoc.getByPlaceholder('e.g. Alex Morgan').fill(NEW_DOCTOR.name);
      await newDoc.getByPlaceholder('alex@example.com').fill(NEW_DOCTOR.email);
      await newDoc.getByPlaceholder('Create a strong password').fill(PW);
      await newDoc.locator('form button[type="submit"]').click();
      await newDoc.getByRole('button', { name: /Continue/ }).waitFor(); // registered as a patient by default
      await newDoc.context().close();

      await nav(admin, 'Doctor Management');
      await admin.getByRole('button', { name: /Credential New Doctor/ }).click();
      await admin.locator('.modal-content input[type="email"]').fill(NEW_DOCTOR.email);
      await admin.getByRole('button', { name: /^Add Doctor$/ }).click();
      await admin.getByText('Doctor Credentialed').waitFor();
      await admin.getByText(NEW_DOCTOR.name).first().waitFor();

      const promoted = await newSession(browser, errors, 'promoted-doctor');
      await signIn(promoted, NEW_DOCTOR);
      await promoted.getByText('Doctor Care Dashboard').waitFor(); // role comes from the server claim
      await promoted.context().close();
    });

    await r.step('every doctor and admin tab loads without errors or failed requests', async () => {
      await visitAllTabs(doctor);
      await visitAllTabs(admin);
    });

    await r.step('patient revokes access and the doctor immediately loses the patient', async () => {
      await nav(patient, 'Profile & Settings');
      await patient.getByRole('button', { name: /Revoke/ }).click();
      await patient.getByText('Access Revoked').waitFor();
      await nav(doctor, 'Doctor Consultations');
      await nav(doctor, 'Shared Journals');
      await doctor.getByText('No consenting patients').waitFor();
    });

    await r.step('no console errors, failed requests or HTTP errors in any session', async () => {
      H.expect(errors.join(' | '), 'page errors').toBe('');
      monitors.forEach((m) => m.expectClean());
    });
  } catch (err) {
    console.error('Setup failed:', err.message);
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

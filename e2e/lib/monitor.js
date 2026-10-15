/**
 * Records browser problems during a UI test: uncaught exceptions, console errors,
 * failed network requests, and API responses with status >= 400.
 * Tests call `expectClean()` at the end; deliberately provoked failures are excluded by
 * wrapping them in `expectedFailures(async () => ...)`.
 */
function monitor(page, label) {
  const problems = [];
  let allowFailures = 0;

  page.on('pageerror', (e) => problems.push(`${label} pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error' || allowFailures) return;
    const text = msg.text();
    // The browser also logs every 4xx/5xx response as a console error; those are tracked below.
    if (/Failed to load resource/.test(text)) return;
    problems.push(`${label} console.error: ${text.slice(0, 300)}`);
  });
  page.on('requestfailed', (req) => {
    if (allowFailures) return;
    const failure = req.failure()?.errorText || '';
    // Navigations/reloads cancel in-flight requests; that is not an application error.
    if (/ERR_ABORTED|NS_BINDING_ABORTED/.test(failure)) return;
    problems.push(`${label} request failed: ${req.method()} ${req.url()} (${failure})`);
  });
  page.on('response', (res) => {
    if (allowFailures) return;
    if (res.url().includes('/api/') && res.status() >= 400) {
      problems.push(`${label} HTTP ${res.status()}: ${res.request().method()} ${new URL(res.url()).pathname}`);
    }
  });

  return {
    problems,
    async expectedFailures(fn) {
      allowFailures += 1;
      try {
        return await fn();
      } finally {
        allowFailures -= 1;
      }
    },
    expectClean() {
      if (problems.length) throw new Error(`browser problems:\n      - ${problems.join('\n      - ')}`);
    }
  };
}

/** Clicks every navigation item in the app shell and waits for each view to settle. */
async function visitAllTabs(page, { settleMs = 600 } = {}) {
  const nav = page.locator('aside nav[aria-label="Main Navigation"] button');
  const labels = (await nav.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  const unique = [...new Set(labels)];
  for (const label of unique) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(settleMs);
  }
  return unique;
}

module.exports = { monitor, visitAllTabs };

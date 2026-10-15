/**
 * Runs every E2E suite in sequence. Start the emulators first: `npm run emulators`.
 */
const { spawnSync } = require('child_process');

const suites = ['api.e2e.js', 'ui.e2e.js', 'ui-care.e2e.js', 'ui-sandbox.e2e.js'];
const results = suites.map((file) => {
  console.log(`\n===== ${file} =====`);
  const run = spawnSync(process.execPath, [file], { cwd: __dirname, stdio: 'inherit' });
  return { file, ok: run.status === 0 };
});
console.log('\n===== summary =====');
results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.file}`));
process.exit(results.every((r) => r.ok) ? 0 : 1);

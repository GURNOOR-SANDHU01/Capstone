#!/usr/bin/env node
/**
 * Assigns a canonical role (patient | doctor | admin) to an existing Firebase Auth account.
 * Intended for bootstrapping the first admin; afterwards use POST /api/admin/users/:uid/role.
 *
 * Uses the same code path as the admin API (src/services/roleService.js): sets the custom
 * claim (preserving other claims), mirrors users/{uid}.role, revokes refresh tokens, and writes
 * an admin_audit_logs record.
 *
 *   node scripts/set-role.js --uid <uid> --role admin            # dry run
 *   node scripts/set-role.js --uid <uid> --role admin --apply    # LIVE WRITE
 *   node scripts/set-role.js --email person@example.com --role doctor --apply
 */
const { parseArgs, loadFirebase, banner } = require('./lib/common');

(async () => {
  const args = parseArgs();
  const apply = Boolean(args.apply);
  try {
    const { ALL_ROLES, normalizeRole } = require('../src/config/roles');
    if (!args.role || !ALL_ROLES.includes(args.role)) throw new Error(`--role must be one of: ${ALL_ROLES.join(', ')}`);
    if (!args.uid && !args.email) throw new Error('--uid <uid> or --email <email> is required');

    banner('Set role', apply);
    const { auth } = loadFirebase();
    const record = args.uid ? await auth.getUser(args.uid) : await auth.getUserByEmail(args.email);
    const current = normalizeRole(record.customClaims?.role);
    console.log(`Account: ${record.uid}  current role: ${current}  requested role: ${args.role}`);

    if (current === args.role) {
      console.log('No change needed.');
      process.exit(0);
    }
    if (!apply) {
      console.log('Dry run only. Re-run with --apply to set the claim, mirror it, and revoke sessions.');
      process.exit(0);
    }

    const { setUserRole } = require('../src/services/roleService');
    const result = await setUserRole({ uid: 'bootstrap-script', role: 'system' }, record.uid, args.role);
    console.log('Done:', result, '\nThe user must sign in again for the new role to take effect.');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.code || '', err.message);
    process.exit(1);
  }
})();

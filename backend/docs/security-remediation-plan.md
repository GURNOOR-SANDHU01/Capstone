# Security & Authorization Remediation Plan (Stage 2)

> **Status: PROPOSAL ONLY — no code has been changed.** Line references are to the current working tree (2026-10-15).
> Applies to the Express backend in `backend/` and the React app in `frontend/`.

## 1. Canonical role model

| Canonical role (app-wide) | Legacy backend term | Where legacy term survives |
|---|---|---|
| `patient` | `user` (default in `authenticate.js:32`, `authorize.js:14`) | nowhere after the change |
| `doctor` | `therapist` (`safety.routes.js:18`, `safetyService.js:6`) | **data field names only**: `therapist_id`, `therapist_bridges`, `therapist_viewed_at`, … (schema unchanged) |
| `admin` | `admin` | — |

**Change:** add `backend/src/config/roles.js` exporting `ROLES`, `normalizeRole(raw)` (`user→patient`, `therapist→doctor`, unknown/missing → `patient`, i.e. least privilege) and `isPrivileged(role)`. `authenticate.js` sets `req.user.role = normalizeRole(decodedToken.role)`; every `requireRole(...)` and role comparison uses `ROLES.*`. This is the **only** place the terminology is translated.

**Source of truth:** Firebase custom claim `role`, set only by the Admin SDK. `users.role` becomes a backend-written mirror for display. The frontend's role (from the Firestore doc, the login tab, or Google sign-in — `frontend/src/services/firebase.js:129, :181, :318`) is never trusted; after integration it reads `role` from `GET /api/users/me`.

**Role assignment:**
- Bootstrap: `backend/scripts/set-role.js --uid <uid> --role admin` run locally by the project owner with the service account (one-time, approval required).
- Thereafter: `POST /api/admin/users/:uid/role` guarded by `requireRole(ROLES.ADMIN)`, validated with Zod (`patient|doctor|admin`), refuses self-demotion of the last admin, writes the claim, mirrors `users.role`, calls `auth.revokeRefreshTokens(uid)` so the new role takes effect, and appends an audit record.
- `authenticate.js:28` → `verifyIdToken(idToken, true)` (check revocation) so demoted users lose access immediately. Adds one Auth lookup per request; acceptable at this scale.

**Audit result (live, read-only):** 0 Auth users, 0 role claims, 0 `role` fields — nothing to migrate.

## 2. Findings and proposed fixes

| # | Severity | Issue (file:line) | Proposed fix | Verification |
|---|---|---|---|---|
| S1 | **High** | Client can set `safety_flags`, `detected_emotions`, `intent_object`, `reflection_prompt` and pre-masked `masked_content` on create (`journal.schema.js:54-67`, `journalService.js:21-41`) → can suppress red-flag alerts and bypass PII scrubbing | Remove these from `createJournalEntrySchema` (keep `content`, `input_source`, `entry_type`, `extracted_themes`, `entry_date`, `biometrics`, `visibility`). Always scrub and analyse server-side. Make the schema `.strict()` so unknown keys 400. | New tests: payload with `safety_flags:{severity_flag:'normal'}` + crisis text still produces `high` and an alert; `masked_content` input rejected |
| S2 | **High** | PATCH allows rewriting `masked_content`, `safety_flags`, `detected_emotions` (`journal.schema.js:73-79`) | PATCH limited to `extracted_themes`, `visibility`, `reflection_prompt.{user_response,was_helpful}`, `detected_emotions.{corrected_emotion,correction_reason}` (the unused `correctEmotionSchema` covers the latter). Text edits, if wanted, re-run scrub + analysis. | Tests: forbidden fields → 400 |
| S3 | **High** | Therapist access ignores `access_level` and the entry's privacy (`journalService.js:135-149`); `emergency_only` / `longitudinal_summary_only` still return full text | Central `canDoctorRead(entry, bridge)` policy: requires `role === doctor`, active bridge (`consent_granted`), `entry.visibility === 'shared'` (missing ⇒ private), and `access_level`: `full_reflection_access` → full entry; `longitudinal_summary_only` → summary projection (date, primary emotion, sentiment, severity — no `masked_content`, no reflection response); `emergency_only` → no journal access. **Product decision needed on the summary projection.** | Matrix test: 3 access levels × private/shared × consent on/off × role |
| S4 | **High** | No way for a doctor to list a patient's shared entries; frontend "Shared Journals" has no backend | `GET /api/patients/:patientId/journal-entries` using the S3 policy; query `user_id ==, visibility == 'shared', orderBy created_at desc` + new index `(visibility, user_id, created_at DESC)` | Index probe + tests |
| S5 | **High** | Journal privacy toggle has no backend field | Add `visibility: 'private' \| 'shared'`, default `private`; owner-only to change; existing docs without it are private | Tests + reconciliation plan §5 |
| S6 | Medium | `grantConsent` accepts any `therapist_id` (`consentRepository.js:9-23`) — not checked to be a doctor, can be self | Service verifies `auth.getUser(therapist_id)` exists with claim `doctor`, and `therapist_id !== uid`; 404/400 otherwise | Tests with patient-as-therapist and unknown UID |
| S7 | Medium | Alert with empty `therapist_id` updatable by any therapist/admin (`safetyRepository.js:103`); `requireRole('therapist','admin')` lets **any** admin edit any alert | Allow update only if `alert.therapist_id === uid` (doctor) **or** role admin (explicitly logged); empty `therapist_id` → admin only; doctor must also still hold an active bridge with `red_flag_alerts_enabled` | Tests |
| S8 | Medium | `listAlerts` checks the string `'therapist'` (`safetyService.js:6`); after normalization must use `ROLES.DOCTOR`; doctors listing without `patient_id` see alerts even after consent revoked | Filter results by currently-active bridges | Tests: revoke → alerts hidden |
| S9 | Medium | `firestore.rules` (local, never deployed): owner may update own `users` doc incl. `role` (`firestore.rules:22`); therapist rule expects bridge ID `uid_patient` (`:14-17`) but code uses auto-IDs | Since all data access is backend-mediated: **deny-by-default for clients**, except `users/{uid}` read-own during the frontend transition (no client writes). Remove the therapist rule. Test with the Rules emulator or Rules Playground before any deploy. | Rules unit tests; deploy only with approval |
| S10 | Medium | Live rules are expired test-mode (deny-all since 2026-08-09) | Keep as is until S9 rules are approved — current state is safe for the backend (Admin SDK bypasses rules) | — |
| S11 | Medium | Account deletion (`userRepository.js:82-108`): single batch (fails > 500 ops), deletes "immutable" `consent_audit_logs` and safety logs, leaves the Auth account, ignores bridges where the user is the doctor | Chunk deletes ≤ 400/batch; **retain** `consent_audit_logs` (pseudonymize `user_id` → `deleted:<hash>`) and decide retention for `red_flag_alert_logs`; deactivate bridges where `therapist_id == uid`; `auth.deleteUser(uid)` last; require recent sign-in (`auth_time` ≤ 5 min). **Destructive endpoint — design approval needed.** | Tests with > 500 docs in the mock; manual review |
| S12 | Low | `GET /api/users/me` auto-creates a profile on first call (`userService.js`) — a hidden write | Keep, but create with server-controlled defaults only (role mirror `patient`) and document it; frontend calls it once after sign-up | Test |
| S13 | Low | Misleading startup log "initialized with Application Default Credentials" when none exist (`admin.js:62-63`) | Log the real outcome after a credential probe, or "no explicit credential" | Startup log check |
| S14 | Low | Rate limit 100 req/15 min/IP for all `/api` (`env.js:32`) will throttle a normal SPA session | Raise default (e.g. 1000) or key the limiter by UID after auth; keep the stricter AI limiter | Load test |
| S15 | Low | `requirePatientOrAuthorizedTherapist` is defined but unused (`authorize.js:31`) | Replace with the S3 policy module, or wire it into S4 | — |
| S16 | Low | Frontend trusts client-chosen role (`firebase.js:129, :181, :318`) and Sandbox mode fakes auth | Frontend stage: role from `/api/users/me`; Sandbox clearly labelled demo-only and disabled when Live is configured | Frontend tests |
| S17 | Info | Service-account key in use is full-privilege `firebase-adminsdk` | For runtime use a dedicated SA with `roles/datastore.user` + `roles/firebaseauth.admin` (claims) — or keep for the capstone and document | — |
| S18 | Info | 8 moderate prod `npm audit` findings (transitive `uuid` via firebase-admin 13) | Decide: upgrade to firebase-admin 14 (major) in its own stage with full test run, or accept | `npm audit --omit=dev` |

## 3. Token-verification test plan

**Done (read-only, no accounts created):** Auth is configured (Email/Password + Google enabled, authorized domains `localhost`, `sentience-6f40e.firebaseapp.com`, `sentience-6f40e.web.app`); `verifyIdToken` rejects empty, malformed, unsigned and custom tokens with `auth/argument-error`; the HTTP layer returns `401 UNAUTHORIZED / INVALID_TOKEN`.

**Not yet verified — positive path (a real ID token).** Options, each needs approval:
1. **Dedicated test account (recommended):** create `qa-token-test@sentience.invalid` via Admin SDK, exchange a custom token for an ID token through the Auth REST API, call `POST /api/analysis/intent` (authenticated, **no Firestore access**) — *not* `GET /api/users/me`, which writes a profile doc. Then call with a revoked token. Delete the account afterwards. Writes: 1 Auth user create + delete; 0 Firestore writes.
2. **You sign up in the React app** once integration starts and the flow is tested end to end (creates a real account + profile doc).
3. **Firebase Auth emulator** — zero live writes, but adds `firebase-tools` as a new dev dependency.

## 4. Implementation order (after approval)
1. `roles.js` + `authenticate` normalization + revocation check (S13 alongside) — tests first.
2. S1, S2 (client-controlled fields) — highest data-integrity risk.
3. S5 → S3 → S4 (privacy field, policy, doctor list) + index addition.
4. S6, S7, S8 (consent and alert ownership).
5. Admin role endpoint + bootstrap script (writes only when you run them).
6. S9 rules + rules tests (no deploy).
7. S11 deletion redesign (separate approval).
8. S14, S15, S17, S18.

Every step: unit/integration tests against the in-memory mock, `npm test` green, no live writes. Live verification of each step needs the indexes deployed and (for doctor flows) the R2 demo accounts.

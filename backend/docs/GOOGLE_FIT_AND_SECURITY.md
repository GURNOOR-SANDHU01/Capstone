# Google Fit integration, RBAC and security checklist

## ⚠️ Google Fit API status (read first)

Google is retiring the Fit APIs: per Google's migration guide the Fit REST API is supported only
**until the end of 2026**, and new projects have not been able to sign up since May 2024. Google's
recommended replacement for cloud/REST use is the **Google Health API** (Health Connect for
on-device Android). All Google calls live in `src/services/fitness/googleFitClient.js`; swapping
providers means replacing that one module (same exported functions). Storage, encryption, the UI
and the doctor/consent logic stay unchanged.

## Architecture

```
Browser (React)                      Express API                            Google
-----------------                    -----------------------------------    -----------------
POST /api/google-fit/connect  ─────▶ sign state {uid, nonce, exp} (HMAC)
   ◀── { auth_url } ─────────────── store nonce
window.location = auth_url ───────────────────────────────────────────────▶ consent screen
                                     GET /api/google-fit/oauth/callback ◀── ?code&state
                                     verify state + one-time nonce
                                     exchange code ───────────────────────▶ token endpoint
                                     encrypt refresh token (AES-256-GCM)
   ◀── 302 /dashboard/google-fit?google_fit=connected
POST /api/google-fit/sync     ─────▶ refresh access token (memory only) ──▶ Fitness API
                                     upsert fitness_daily_metrics
GET  /api/google-fit/metrics  ─────▶ read own metrics + summary
DELETE /api/google-fit/connection ─▶ revoke at Google, delete token (?purge=true deletes data)
Doctor: GET /api/patients/:id/wellness-summary  → consent check → audit log → summary + intake
```

The browser never receives a Google token.

## Google Cloud setup

1. Google Cloud Console → create or select a project → **APIs & Services → Library** → enable **Fitness API**.
2. **OAuth consent screen**: External, add the app name and support email, and add the scopes
   `.../auth/fitness.activity.read`, `.../auth/fitness.heart_rate.read`, `.../auth/fitness.sleep.read`.
   While in *Testing*, add your Google accounts as test users. Health scopes are *sensitive*:
   publishing requires Google verification.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorized redirect URI: `http://localhost:5000/api/google-fit/oauth/callback` (and your production URL over HTTPS).
   No JavaScript origins are needed (the browser never talks to Google's OAuth API).
4. Put the values in `backend/.env`:

   ```
   GOOGLE_FIT_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_FIT_CLIENT_SECRET=...
   GOOGLE_FIT_REDIRECT_URI=http://localhost:5000/api/google-fit/oauth/callback
   FRONTEND_URL=http://localhost:5173
   TOKEN_ENCRYPTION_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
   ```

Without these values the feature shows "Google Fit unavailable" and the rest of the app keeps working.

## Roles & RBAC (how the spec maps to this codebase)

| Requirement | Implementation |
|---|---|
| Roles `patient` / `doctor` / `admin` | Firebase custom claim `role` (`src/config/roles.js`); only the Admin SDK can set it, so a client cannot escalate. Unknown values fall back to `patient` |
| Role check on every API route | `authenticate` (ID token verified with `checkRevoked=true`) → `requireRole(...)` → zod `validate(...).strict()` |
| Ownership | Services take the user ID from the verified token, never from the request. Doctor access to patient data goes through `accessPolicy` / consent bridges |
| Patient-only intake question | `PatientOnboardingWizard` renders only when `role === patient` and onboarding is incomplete; doctors and admins never see it. Answers are stored server-side (`PUT /api/users/me/onboarding`) |
| Frontend route guard | Each portal renders only for its role; URLs (`/dashboard/*`, `/doctor/*`, `/admin/*`) resolve to the user's own portal (`frontend/src/config/routes.js`). This is UI only: the API is the enforcement point |
| Admin user management | `GET /api/admin/users`, `POST /api/admin/users/:uid/role`, `POST /api/admin/users/:uid/status` (deactivate = Firebase `disabled` + revoke sessions). No self-demotion or self-deactivation. All audit-logged |

## Security checklist

**Authentication & sessions**
- [x] Passwords: Firebase Authentication (salted, memory-hard scrypt hashing; never stored by this app).
- [x] Short-lived tokens: Firebase ID tokens expire after 1 hour; verified on every request with revocation checks.
- [x] Logout invalidates the session server-side (`POST /api/users/me/logout` revokes refresh tokens).
- [x] Role change / deactivation revokes sessions immediately.
- [x] Brute force: Firebase Auth throttles failed sign-ins per account/IP; the API is rate-limited (`apiLimiter`, `analysisLimiter`).
- [ ] *Production:* enable Firebase **App Check** and **Identity Platform** (MFA for doctors/admins, password policy).
- Note: tokens are sent as `Authorization: Bearer` headers, not cookies, so CSRF does not apply. If you
  move to Firebase **session cookies**, set them `HttpOnly; Secure; SameSite=Strict` and add CSRF protection.

**Google Fit OAuth & tokens**
- [x] Minimum read-only scopes (activity, heart rate, sleep). Distance is not requested (it needs location).
- [x] Server-side authorization-code flow; signed, expiring, one-time `state`.
- [x] Refresh tokens AES-256-GCM encrypted at rest, bound to the user ID. Access tokens are kept in memory only.
- [x] Revocation (`invalid_grant`/401) → token deleted, status `revoked`, UI prompts to reconnect.
- [x] Disconnect revokes at Google; optional purge of synced data.
- [ ] *Production:* store `TOKEN_ENCRYPTION_KEY` in a secret manager (e.g. Google Secret Manager); plan key rotation.

**Data & transport**
- [x] All inputs validated with zod `.strict()` (unknown fields rejected); Firestore has no query language to inject into, and values are never concatenated into paths.
- [x] React escapes rendered text (no `dangerouslySetInnerHTML`).
- [x] API responses: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` (helmet).
- [x] 5xx errors never expose internals; logs omit journal text and tokens.
- [x] Firestore rules deny all direct client access.
- [x] Audit log for privileged actions and for every doctor read of a patient's wellness summary.
- [ ] *Production:* serve frontend and API over **HTTPS only** (HSTS is sent by helmet) and set a CSP on the frontend host (e.g. Firebase Hosting headers).
- [ ] *Production:* restrict `CORS_ORIGIN` to the real frontend origin and set `NODE_ENV=production`.

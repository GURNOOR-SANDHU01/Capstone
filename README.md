# SentiMed / Sentience — Capstone

AI-assisted emotional well-being platform with patient, doctor and admin portals.

```
React + Vite (frontend/)
  │  Firebase Authentication in the browser (email/password, Google)
  │  every request: Authorization: Bearer <Firebase ID token>
  ▼
Express API (backend/)  ── verifies the token, reads the role from the custom claim,
  │                        enforces ownership + patient consent, validates input (Zod),
  │                        scrubs PII and runs the safety/emotion model adapter
  ▼
Cloud Firestore (project sentience-6f40e) via the Firebase Admin SDK
```

Browsers never read or write Firestore directly (`backend/firestore.rules` denies all client
access). The Python FastAPI skeleton in `app/` is kept for future AI/NLP work and is not used
at runtime; the Express backend can call such a service through `MODEL_API_BASE_URL`.

| Folder | Contents |
|---|---|
| `frontend/` | React 19 + Vite app. Live mode (Firebase + API) or offline Sandbox demo |
| `backend/` | Express API, Firestore repositories, security rules, index definitions, operational scripts, Jest tests |
| `e2e/` | End-to-end tests (Firebase emulators + real backend + Chrome). Never touches the live project |
| `app/` | Python FastAPI skeleton (unused) |
| `research/`, `reports/` | Capstone documents |

## Running locally

### 1. Backend
```bash
cd backend
npm ci
cp .env.example .env          # set FIREBASE_SERVICE_ACCOUNT_PATH to your key file (git-ignored)
npm test                      # unit/integration tests (in-memory Firebase mock)
npm run dev                   # http://localhost:5000  (health: /api/health, /api/health/firebase)
```

### 2. Frontend
```bash
cd frontend
npm ci
cp .env.example .env.local    # Live mode: VITE_FIREBASE_* web config (already generated locally); empty API key = Sandbox
npm run dev                   # http://localhost:5173  ("/api" is proxied to the backend)
npm run lint && npm run build
```

### 3. End-to-end tests (local emulators only)
```bash
cd e2e
npm ci
npm run emulators             # terminal 1: Auth + Firestore emulators, project "demo-sentience"
npm test                      # terminal 2: API, UI, multi-role UI and Sandbox suites (uses installed Chrome)
```

## Security model (summary)

- **Roles** — `patient` | `doctor` | `admin`, stored only as a Firebase custom claim. Legacy
  claims `user`/`therapist` are mapped in one place (`backend/src/config/roles.js`). Missing or
  unknown roles mean `patient`. Only admins (API) or the owner's bootstrap script
  (`npm run auth:set-role`) can grant roles; sessions are revoked when a role changes.
- **Journal privacy** — entries are `private` by default. A doctor sees an entry only if it is
  `shared` **and** the patient has an active consent bridge to that doctor; `longitudinal_summary_only`
  consent returns trends without text, `emergency_only` returns no journal data.
- **Server-side safety** — masking, emotion/intent/safety analysis and CBT prompts are computed
  by the backend; clients cannot submit or overwrite them. High-severity entries alert consented
  doctors, or the admin triage queue when there is none.
- **Consent** — only to existing doctor accounts, never to yourself; every grant/revoke is audited.

Teammate handoff (AI service contract, supporting-feature interfaces): `backend/docs/INTEGRATION_HANDOFF.md`.

Details: `backend/docs/security-remediation-plan.md`, `backend/SCHEMA.md`,
`backend/docs/data-reconciliation-plan.md`.

## Operational scripts (backend/, dry-run by default)

| Command | Purpose | Writes |
|---|---|---|
| `npm run db:backup -- --out <file outside repo>` | Typed JSON export of every document | none (read-only) |
| `npm run db:reconcile` | Repairs malformed legacy fields (plan R3) | only with `--apply --backup <file>` |
| `npm run auth:set-role -- --uid <uid> --role admin` | Bootstrap the first admin | only with `--apply` |
| `npm run auth:demo-accounts` | Auth accounts for existing demo personas (plan R2) | only with `--apply` |

| `npm run smoke:live -- --apply` | Live check with a temporary account (real ID token, journal CRUD), always cleaned up | temporary data only |

## Live Firebase status (2026-10-15)

- **Security rules:** deployed — `backend/firestore.rules` (deny all direct client access).
- **Composite indexes:** **not yet deployed** (the service-account key lacks index permissions).
  Until they are, list screens (journal list, alerts, memories, consent history, …) return
  "temporarily unavailable" on the live project. Deploy with your own Google login:
  ```bash
  cd e2e
  npx firebase login
  npx firebase deploy --only firestore:indexes --project sentience-6f40e --config ../backend/firebase.json
  ```
  Building takes a few minutes; then run `cd backend && npm run smoke:live -- --apply` (with the API running)
  to confirm the list step passes.
- **First admin:** sign up in the app, then `cd backend && npm run auth:set-role -- --email <you> --role admin --apply`.

# SentiMed — Integration Handoff (October 2026)

For teammates working on AI integration and supporting features. Describes the interfaces the
current React + Express + Firestore application already exposes, so new work plugs in without
changing existing contracts.

## 1. Architecture rules (please keep)

- Browser → **Express API only**. Firestore security rules deny all direct client access
  (deployed). New data must go through a backend route.
- Every route: `authenticate` (Firebase ID token, revocation checked) → `requireRole(...)` →
  `validate(zodSchema)` (prefer `.strict()`) → service → repository. Roles come only from the
  custom claim (`src/config/roles.js`); never from request bodies or Firestore fields.
- Response envelope: `{ success: true, data, pagination }` / `{ success: false, error: { code, message } }`.
  5xx responses never include internal messages (`src/middleware/errorHandler.js`).
- Patient data visible to a doctor only through `src/services/accessPolicy.js`
  (active consent bridge + `visibility: 'shared'` + access level).
- New Firestore queries that combine a filter with `orderBy` need a composite index: add it to
  `firestore.indexes.json` **and** a query shape to `tests/indexes.test.js`.
- Frontend: call the API through `frontend/src/services/apiClient.js` (`api.get/post/...`), keep the
  Sandbox branch (`isRealFirebaseConfigured === false`) working with local demo data.

## 2. AI / model service (external HTTP service, e.g. the Python app)

The backend already calls an external model service through `HttpModelAdapter`
(`src/services/modelService.js`). No backend code changes are needed to connect one.

### Configuration (`backend/.env`)

| Variable | Value |
|---|---|
| `USE_MOCK_MODELS` | `false` (when `true` — the template default — the built-in rule-based analysis is used) |
| `MODEL_API_BASE_URL` | Service root, e.g. `http://localhost:8000` (the adapter appends the paths below) |
| `MODEL_API_KEY` | Optional; sent as `Authorization: Bearer <key>` |
| `MODEL_API_TIMEOUT_MS` | Default `15000` |

### Endpoints the service must implement

All `POST` with JSON. Text has **already been PII-scrubbed** by the backend. Return the result
object directly (an `{ success, data }` envelope is also accepted). Extra fields are kept.

| Path | Request | Required response fields |
|---|---|---|
| `GET /health` | — | any JSON (shown at `/api/health/model`) |
| `/api/analysis/emotions` | `{ content, input_source: "text"\|"audio", vocal_prosody: {pitch_std, energy_level}\|null }` | `primary_state` (string), `confidence` (0–1), `sentiment_score` (−1…1); optional `all_28_states` (map label→score) |
| `/api/analysis/intent` | `{ content }` | `intent` (string); optional `clarified_to`, `triggers[]`, `coping_attempts[]` |
| `/api/analysis/safety` | `{ content, detected_emotions, biometrics\|null }` | `severity_flag` (`normal`\|`moderate`\|`high`), `red_zone_triggered` (bool), `crisis_language_detected` (bool) |
| `/api/analysis/reflection` | `{ content, primary_emotion, sentiment_score, intent, extracted_themes[] }` | `prompt_text` (string); optional `prompt_type`, `cbt_technique_used` |
| `/api/analysis/memories` | `{ content, primary_emotion }` | array of `{ text, type, score (0–1) }` |

### Behaviour already built in

- Results are validated against these contracts (`RESULT_SCHEMAS`). On timeout, HTTP error or an
  invalid result, the backend logs it and uses the built-in rule-based analysis for that call
  (`provenance.adapter = "fallback"`), so journaling never fails because the model is down.
- **Safety floor:** the safety result is never less severe than the built-in crisis-language
  check (`high` if crisis phrases are present). Severity `high` on a journal entry raises a
  red-flag alert to consented doctors, or the admin triage queue.
- `src/services/modelService.js` — `MockModelAdapter` shows example outputs for every call.
- Contract tests: `backend/tests/modelAdapter.test.js`.

Where results are used: `journalService.createEntry / updateEntry` (stored on the entry),
`POST /api/analysis/*` (AI Companion in the frontend: emotions → safety → reflection),
memories (`GET /api/memories`, feedback `POST /api/memories/:id/feedback`, shown on Insights).

## 3. Supporting-feature interfaces that already exist

| Feature | Existing interface | Status / where to connect |
|---|---|---|
| Wearables / biometrics | `POST /api/biometrics/sync` `{ provider: google_fit\|apple_health, metrics{resting_hr, hr_variability, sleep_hours, sleep_quality_score, steps, stress_level}, date_range }`; `GET /api/biometrics`; journal entries accept `biometrics` (same fields) and pass them to the safety model | Backend done (sync log only stores a metric count). Frontend "Pair Device" toggle in Profile is local-only — connect it to these endpoints |
| Notifications (SMS/email/push) | All risk alerts are created in `safetyService.raiseAlert(userId, { severity, alertType, reason })` | No provider configured. Dispatch from there (alerts contain no journal text; keep it that way). `frontend/src/services/notificationService.js` is Sandbox-only demo code |
| Video calls | Appointments get a unique `https://meet.jit.si/SentiMed-<random>` link on confirmation (`appointmentService.newMeetingUrl`) | Public Jitsi rooms with unguessable names; replace the function to use another provider |
| PII masking | Server: `scrubPII` in `src/services/journalService.js` (regex). Client demo: `frontend/src/components/privacy/PiiMaskingView.jsx` | Regex has false positives (long numbers → phone). A Presidio-based scrubber can replace `scrubPII` (keep it synchronous or make callers await it) |

## 4. Environments

| Mode | How | Data |
|---|---|---|
| Live | `backend/.env` (service-account path) + `frontend/.env.local` (web config) | Project `sentience-6f40e` |
| Emulators (tests) | `cd e2e && npm run emulators` (project `demo-sentience`) | Local only; the harness refuses to run if the frontend points at the live project |
| Sandbox | Login page → "Switch Mode", or empty `VITE_FIREBASE_API_KEY` | Browser localStorage only; no API calls |

## 5. Live Firebase status

- Rules: deployed (deny all client access).
- **Composite indexes: not deployed** — list endpoints return `503 SERVICE_NOT_READY` on live until
  they are. Requires a Google account with Firebase/Firestore index admin rights
  (`roles/datastore.indexAdmin`, or project Owner/Editor):
  `cd e2e && npx firebase login && npx firebase deploy --only firestore:indexes --project sentience-6f40e --config ../backend/firebase.json`
  Verify: `npx firebase firestore:indexes --project sentience-6f40e` lists 26 indexes as READY, then
  `cd backend && npm run smoke:live -- --apply` with the API running (temporary account, auto-cleanup).
- No live user accounts exist yet; bootstrap the first admin with `npm run auth:set-role`.

## 6. Tests

- Backend: `cd backend && npm test` (in-memory Firebase mock).
- End-to-end: `cd e2e && npm run emulators` then `npm test` (API, patient UI, multi-role UI, Sandbox; uses installed Chrome).

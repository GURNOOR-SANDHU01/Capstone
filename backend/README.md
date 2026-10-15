# Sentience — AI-Assisted Emotional Well-Being Backend & Firebase Architecture

> **Firebase Project ID:** `sentience-6f40e`  
> **Intended Firestore Region:** `asia-south1` (Mumbai)  
> **Runtime:** Node.js 22+ & Express.js  
> **Database:** Cloud Firestore (9 Standard Collections aligned with `SCHEMA.md`)  
> **AI Inference:** Adapter Pattern (HTTP Microservice or built-in Development Mock)  

---

## 1. Project Overview

**Sentience** is a secure, privacy-first emotional well-being application designed to process:
- Journal entries and user-written text with **Presidio PII scrubbing**.
- Emotion classification across 28 states (GoEmotions taxonomy) and sentiment scores (-1.0 to 1.0).
- Intent classification and identified triggers (e.g. `deadline_pressure`, `exam_anxiety`).
- Personalized CBT reflection prompts and user responses.
- Longitudinal extracted memories and user feedback loops.
- Biometric sync logs (Google Fit / Apple Health).
- Sovereign therapist consent bridges and red flag safety monitoring.

> **Mental Health Safety Disclaimer:**  
> Sentience is an emotional well-being support tool. Automated model outputs are probabilistic signals, **not clinical diagnoses**. Automated treatment recommendations never replace a licensed mental-health professional. Emergency escalation pathways (e.g., 988 or Tele-MANAS 14416) are clearly accessible.

---

## 2. Architecture & Directory Structure

```
c:\Users\tanis\lock\Capstone\
├── src/
│   ├── app.js                          # Express application configuration & security middleware
│   ├── server.js                       # Server entrypoint and lifecycle handling
│   ├── config/
│   │   ├── env.js                      # Centralized environment configuration
│   │   └── firebase/
│   │       ├── admin.js                # Single-instance Firebase Admin SDK initializer
│   │       └── firestore.js            # Firestore client, FieldValue, Timestamp, collections
│   ├── middleware/
│   │   ├── authenticate.js             # Firebase ID token verification
│   │   ├── authorize.js                # Role and therapist consent checks
│   │   ├── validate.js                 # Zod request schema validation
│   │   ├── errorHandler.js             # Sanitized error response handler
│   │   └── rateLimiter.js              # Rate limiters (general & AI inference)
│   ├── schemas/
│   │   ├── user.schema.js              # User profiles & account deletion schemas
│   │   ├── journal.schema.js           # Journal entries, emotions, and intent schemas
│   │   ├── memory.schema.js            # Extracted memories and user feedback schemas
│   │   ├── reflection.schema.js        # CBT prompts and response schemas
│   │   ├── consent.schema.js           # Therapist bridges & consent schemas
│   │   ├── safety.schema.js            # Red flag alert management schemas
│   │   ├── biometric.schema.js         # Biometrics sync schemas
│   │   └── analysis.schema.js          # Direct AI model analysis schemas
│   ├── repositories/                   # Data access layer for all 9 Firestore collections
│   │   ├── userRepository.js
│   │   ├── journalRepository.js
│   │   ├── memoryRepository.js
│   │   ├── reflectionRepository.js
│   │   ├── consentRepository.js
│   │   ├── safetyRepository.js
│   │   └── biometricRepository.js
│   ├── services/                       # Business logic layer
│   │   ├── userService.js
│   │   ├── journalService.js
│   │   ├── modelService.js             # AI adapter pattern (HttpModelAdapter & MockModelAdapter)
│   │   ├── memoryService.js
│   │   ├── reflectionService.js
│   │   ├── consentService.js
│   │   ├── safetyService.js
│   │   └── biometricService.js
│   ├── controllers/                    # HTTP request handlers
│   │   ├── healthController.js
│   │   ├── userController.js
│   │   ├── journalController.js
│   │   ├── analysisController.js
│   │   ├── memoryController.js
│   │   ├── reflectionController.js
│   │   ├── consentController.js
│   │   ├── safetyController.js
│   │   └── biometricController.js
│   ├── routes/                         # Express route definitions
│   │   ├── health.routes.js
│   │   ├── users.routes.js
│   │   ├── journal.routes.js
│   │   ├── analysis.routes.js
│   │   ├── memories.routes.js
│   │   ├── reflections.routes.js
│   │   ├── consent.routes.js
│   │   ├── safety.routes.js
│   │   └── biometrics.routes.js
│   └── utils/
│       ├── apiResponse.js              # Standardized API response formatter
│       └── logger.js                   # PII- and token-redacting application logger
├── public/                             # Frontend client
│   ├── index.html                      # Single-page interface for journaling, CBT & consent
│   ├── css/style.css                   # Glassmorphic dark theme stylesheet
│   └── js/
│       ├── firebase-config.js          # Shared singleton Firebase Client SDK module
│       └── app.js                      # Client app logic connecting to /api and Firebase
├── tests/                              # Comprehensive test suite
│   ├── mocks/firebaseAdminMock.js      # In-memory Firebase Admin & Firestore mock
│   ├── health.test.js
│   ├── auth.test.js
│   ├── users.test.js
│   ├── journal.test.js
│   ├── consent.test.js
│   ├── memories.test.js
│   ├── reflections.test.js
│   ├── model.test.js
│   └── safety.test.js
├── firestore.rules                     # Cloud Firestore production security rules
├── seed.js                             # Database seeding script for development
├── SCHEMA.md                           # Authoritative database schema definition
├── .env.example                        # Environment variable template
├── .gitignore
└── package.json
```

---

## 3. Database Schema (`SCHEMA.md` Conformance)

The database schema strictly adheres to `SCHEMA.md` across 9 collections:

| Collection | Document ID | Purpose |
|---|---|---|
| `users` | Firebase Auth UID | User profile, preferences (`theme`, `cbt_alignment`, `emergency_contacts`), `structured_memory`, `resilience_streaks` |
| `therapist_bridges` | Auto-generated UUID | Sovereign consent relationships (`consent_granted`, `access_level`, `red_flag_alerts_enabled`) |
| `memories` | Auto-generated UUID | Long-term AI-extracted patterns (`memory_text`, `importance_score`, `metadata`) |
| `journal_entries` | Auto-generated UUID | PII-masked entries, 28 emotion states, intent, reflection prompts, biometrics, safety flags |
| `reflection_prompts_and_responses`| Auto-generated UUID | Standalone CBT prompt log, responses, helpfulness ratings |
| `red_flag_alert_logs` | Auto-generated UUID | Automated safety alerts for acute distress or sustained decline |
| `consent_audit_logs` | Auto-generated UUID | Immutable audit trail for all consent grants and revocations |
| `biometric_sync_logs` | Auto-generated UUID | Google Fit / Apple Health sync attempts and metrics count |
| `memory_feedback` | Auto-generated UUID | User feedback on memories with dynamic confidence boost |

---

## 4. Setup & Installation

### Prerequisites
- Node.js `22.x` or later (tested on Node v24.21.0)
- npm `10.x` or later

### Installation
```bash
# Clone or navigate to the repository
cd Capstone

# Install all backend dependencies
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key variables:
```env
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=sentience-6f40e
FIREBASE_DATABASE_LOCATION=asia-south1
FIREBASE_AUTH_DOMAIN=sentience-6f40e.firebaseapp.com
FIREBASE_STORAGE_BUCKET=sentience-6f40e.firebasestorage.app

# Firebase Web API Key (from Firebase Console Project Settings)
FIREBASE_WEB_API_KEY=your_firebase_web_api_key_here

# Service Account credentials for Firebase Admin:
# Option A: Place serviceAccountKey.json in project root
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
# Option B: Use Application Default Credentials (ADC) in cloud environments

# AI Model Inference Service
USE_MOCK_MODELS=true
MODEL_API_BASE_URL=
MODEL_API_KEY=
MODEL_API_TIMEOUT_MS=15000
```

---

## 5. Running the Application

### Start Backend & Static Frontend
```bash
npm start
```
Or with automatic reload during development:
```bash
npm run dev
```

- **Frontend Application:** [http://localhost:5000](http://localhost:5000)
- **Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **Firebase Status:** [http://localhost:5000/api/health/firebase](http://localhost:5000/api/health/firebase)
- **AI Models Status:** [http://localhost:5000/api/health/model](http://localhost:5000/api/health/model)

---

## 6. Running Tests

The test suite runs with in-memory isolation, guaranteeing that tests execute fast and **never mutate production Firestore data**:

```bash
# Run all automated tests
npm test

# Run tests with code coverage report
npm run test:coverage
```

Test coverage includes:
- ✅ Health checks & service status
- ✅ Firebase ID token verification (valid, missing, expired, and invalid tokens)
- ✅ User profile CRUD & complete account deletion workflow
- ✅ Journal entry creation, PII scrub, retrieval, and pagination
- ✅ Cross-user data isolation (HTTP 403 Forbidden on unauthorized access)
- ✅ Therapist consent gates (blocked without consent, allowed with consent, blocked upon revocation)
- ✅ Extracted memories & user feedback with confidence adjustments
- ✅ CBT reflection prompts and helpfulness ratings
- ✅ AI model adapters (28-emotion classification, intent, safety signals, reflection prompts)
- ✅ Rate limiting & payload size limits

---

## 7. REST API Documentation

All protected routes require:
```
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

### Standard Response Format

**Success (HTTP 200 / 201):**
```json
{
  "success": true,
  "data": {},
  "pagination": null
}
```

**Error (HTTP 4xx / 5xx):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid: ..."
  }
}
```

### Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service uptime and status |
| `GET` | `/api/health/firebase` | Firestore connectivity check |
| `GET` | `/api/health/model` | Model adapter status |
| `GET` | `/api/users/me` | Retrieve authenticated user profile |
| `PATCH` | `/api/users/me` | Update permitted user profile fields |
| `DELETE` | `/api/users/me` | Purge user profile & related data |
| `POST` | `/api/journal-entries` | Create journal entry (PII scrubbed, AI evaluated) |
| `GET` | `/api/journal-entries` | List entries with pagination (`?page=1&limit=20`) |
| `GET` | `/api/journal-entries/:id`| Retrieve specific entry (owner or authorized therapist) |
| `PATCH` | `/api/journal-entries/:id`| Update entry (e.g. reflection response) |
| `DELETE` | `/api/journal-entries/:id`| Delete entry |
| `POST` | `/api/analysis/emotions` | 28 GoEmotions classification |
| `POST` | `/api/analysis/intent` | Intent & trigger detection |
| `POST` | `/api/analysis/safety` | Distress & safety signal check |
| `POST` | `/api/analysis/reflection`| CBT prompt generation |
| `GET` | `/api/memories` | Retrieve long-term memories |
| `POST` | `/api/memories` | Create custom memory pattern |
| `POST` | `/api/memories/:id/feedback` | Submit Agree/Disagree feedback on memory |
| `GET` | `/api/reflection-prompts`| List reflection prompts |
| `POST` | `/api/reflection-prompts`| Create reflection prompt |
| `PATCH` | `/api/reflection-prompts/:id` | Submit response to prompt |
| `GET` | `/api/consent` | List active therapist bridges & audit trail |
| `POST` | `/api/consent/therapist` | Grant/update therapist consent bridge |
| `DELETE` | `/api/consent/therapist`| Revoke therapist consent bridge |
| `GET` | `/api/safety-alerts` | View red flag alerts (patient or therapist) |
| `PATCH` | `/api/safety-alerts/:id` | Therapist marks alert as viewed/resolved |
| `POST` | `/api/biometrics/sync` | Sync Apple Health / Google Fit data |
| `GET` | `/api/biometrics` | Retrieve biometric sync logs |

---

## 8. Curl Examples

### 1. Create a Journal Entry
```bash
curl -X POST http://localhost:5000/api/journal-entries \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Work deadlines are piling up. I felt anxious during our sprint review, but taking a walk in the evening helped.",
    "input_source": "text",
    "extracted_themes": ["work", "deadlines", "exercise"]
  }'
```

### 2. Grant Therapist Consent
```bash
curl -X POST http://localhost:5000/api/consent/therapist \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "therapist_id": "therapist_auth_uid_abc123",
    "access_level": "longitudinal_summary_only",
    "red_flag_alerts_enabled": true
  }'
```

### 3. Submit Memory Feedback
```bash
curl -X POST http://localhost:5000/api/memories/<MEMORY_ID>/feedback \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_feedback": "agree",
    "user_notes": "Very accurate pattern for me"
  }'
```

---

## 9. Security & Production Deployment

1. **Firestore Security Rules:**  
   Deploy the provided rules file:
   ```bash
   firebase deploy --only firestore:rules
   ```
2. **Service Account Credentials:**  
   In GCP Cloud Run / App Engine, assign a Service Account with the `Cloud Datastore User` and `Firebase Authentication Viewer` IAM roles; Application Default Credentials will be used automatically.
3. **Environment Security:**  
   Ensure `serviceAccountKey.json` and `.env` are never committed to version control. They are strictly ignored in `.gitignore`.

---

## 10. SentiMed Integration Additions (October 2026)

The React app in `../frontend` now uses this API. Additional endpoints (all require a Firebase ID token):

| Method | Endpoint | Who | Description |
|---|---|---|---|
| `PUT` | `/api/users/me/onboarding` | patient | Save intake; risk evaluated server-side; alerts raised if needed |
| `GET` | `/api/doctors` | any | Doctor directory (display fields only) |
| `GET` | `/api/patients` | doctor | Patients currently consenting to the caller |
| `GET` | `/api/patients/:id/journal-entries` | doctor | That patient's **shared** entries, projected by consent level |
| `GET/POST` | `/api/appointments` | patient, doctor (admin: read) | Patient requests (PENDING); doctor schedules with consenting patients (CONFIRMED) |
| `POST` | `/api/appointments/:id/actions` | participants | `confirm`, `reject`, `reschedule`, `accept_reschedule`, `cancel`, `complete` |
| `GET/POST/PATCH` | `/api/care-instructions` | doctor (patient: read) | Reminders for consenting patients |
| `GET/POST` | `/api/messages` | patient, doctor | Secure messaging while consent is active |
| `GET/POST` | `/api/clinics` | any / admin | Clinic network |
| `GET` | `/api/admin/users`, `/api/admin/stats`, `/api/admin/audit-logs` | admin | Administration |
| `POST` | `/api/admin/users/:uid/role`, `/api/admin/doctors` | admin | Role assignment (claims + audit + session revocation) |
| `PATCH` | `/api/admin/doctors/:uid` | admin | Doctor directory details |

Behavioural changes to existing endpoints:
- `POST /api/journal-entries` accepts user input only (`content`, `visibility`, `self_reported_emotion`,
  `reflection_response`, `extracted_themes`, ...); `masked_content`, `safety_flags`, `detected_emotions`,
  `intent_object`, `reflection_prompt` are rejected (computed server-side).
- `PATCH /api/journal-entries/:id` may change only `visibility`, `extracted_themes`, the reflection
  response/helpfulness and the user's emotion correction.
- `GET /api/journal-entries/:id` for doctors requires `visibility: shared` + active consent; returns a summary for
  `longitudinal_summary_only`.
- `POST /api/consent/therapist` requires the target to be a doctor account (verified claim), not yourself.
- `PATCH /api/safety-alerts/:id`: assigned doctor with active alert consent, or an admin.
- Roles are canonical (`patient`/`doctor`/`admin`); legacy `user`/`therapist` claims still work.
- Tokens are verified with revocation checks.
- Reads normalize known malformed legacy fields (e.g. keys with trailing spaces) without modifying stored data.

Firestore: `firestore.indexes.json` (26 composite indexes) and the deny-all client `firestore.rules`
are **not deployed** yet. `seed.js` now refuses to run unless `FIRESTORE_EMULATOR_HOST` is set (or `--force-live`).

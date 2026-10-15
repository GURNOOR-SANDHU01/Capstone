# Sentience App — Firestore Database Schema

> **DBMS:** Firebase Cloud Firestore (NoSQL)
> **Location:** asia-south1 (Mumbai)
> **Mode:** Standard Edition
> **Last Updated:** October 2026

---

## Overview

Firestore uses **Collections** (like tables) containing **Documents** (like rows), each holding **Fields** (like columns). There are no automatic relations — documents reference each other via stored IDs.

---

## Collections

### 1. `users`

Stores core user profile, preferences, and engagement data.

**Document ID:** Firebase Auth UID (set manually, e.g. `user_001_arjun`)

| Field | Type | Description |
|---|---|---|
| `full_name` | string | User's full name |
| `email` | string | User's email address |
| `created_at` | timestamp | Account creation time |
| `updated_at` | timestamp | Last profile update time |
| `preferences` | map | User app preferences (see below) |
| `structured_memory` | map | Long-term personalization data (see below) |
| `resilience_streaks` | map | Streak and engagement tracking (see below) |

**`preferences` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `theme` | string | UI theme — `"light"` or `"dark"` |
| `cbt_alignment` | boolean | Whether CBT prompts are enabled |
| `daily_reminder_time` | string | Time for daily nudge e.g. `"08:00"` |
| `emergency_contacts` | array (string) | List of emergency phone numbers |

**`structured_memory` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `sleep_goal` | string | User's target sleep e.g. `"8 hours"` |
| `preferred_coping_strategies` | array (string) | e.g. `["deep_breathing", "journaling"]` |

**`resilience_streaks` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `current_streak` | number | Current consecutive check-in days |
| `longest_streak` | number | All-time best streak |
| `last_check_in` | timestamp | Timestamp of last check-in |

---

### 2. `therapist_bridges`

Stores consent and access relationships between users and therapists.

**Document ID:** Auto-generated UUID

| Field | Type | Description |
|---|---|---|
| `therapist_id` | string | Therapist's Firebase Auth UID |
| `user_id` | string | Patient's Firebase Auth UID → ref: `users` |
| `consent_granted` | boolean | Whether user has given consent |
| `consent_updated_at` | timestamp | When consent was last updated |
| `access_level` | string | e.g. `"longitudinal_summary_only"` |
| `red_flag_alerts_enabled` | boolean | Whether therapist receives red flag alerts |

---

### 3. `memories`

Stores AI-extracted long-term patterns per user, used for RAG and semantic search.

**Document ID:** Auto-generated UUID

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Owner user → ref: `users` |
| `memory_text` | string | Extracted pattern in natural language |
| `memory_type` | string | Category e.g. `"work_stress"`, `"coping_pattern"` |
| `importance_score` | number | Confidence/importance score (0.0–1.0) |
| `created_at` | timestamp | When memory was extracted |
| `updated_at` | timestamp | Last update time |
| `metadata` | map | Additional extraction metadata (see below) |

**`metadata` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `associated_entry_id` | string | Linked journal entry → ref: `journal_entries` |
| `extraction_confidence` | number | AI confidence score (0.0–1.0) |

---

### 4. `journal_entries`

Core collection. Stores each journaling session with full emotional, biometric, and safety data.

**Document ID:** Auto-generated UUID

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Owner user → ref: `users` |
| `masked_content` | string | PII-scrubbed journal text (via Presidio) |
| `entry_type` | string | e.g. `"daily_journal"` |
| `input_source` | string | `"text"` or `"audio"` |
| `audio_transcript_confidence` | number | Wav2Vec confidence score (null if text) |
| `extracted_themes` | array (string) | e.g. `["work", "sleep", "exams"]` |
| `entry_date` | string | Date string e.g. `"2026-06-16"` |
| `created_at` | timestamp | Entry creation time |
| `detected_emotions` | map | Emotion analysis output (see below) |
| `intent_object` | map | Intent classification output (see below) |
| `reflection_prompt` | map | CBT prompt shown and user response (see below) |
| `biometrics` | map | Health metrics at time of entry (see below) |
| `safety_flags` | map | Crisis and safety detection output (see below) |

**`detected_emotions` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `primary_state` | string | Top detected emotion e.g. `"anxiety"` |
| `confidence` | number | Confidence of primary state (0.0–1.0) |
| `sentiment_score` | number | Overall sentiment (-1.0 to 1.0) |
| `all_28_states` | map | Scores for all 28 emotional states |
| `vocal_prosody` | map | `pitch_std` and `energy_level` (null if text) |
| `corrected_emotion` | string | User-corrected emotion (null if not corrected) |
| `correction_reason` | string | Why user corrected (null if not corrected) |
| `user_correction_timestamp` | timestamp | When correction was made |

**`intent_object` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `intent` | string | Raw detected intent e.g. `"vague_stress"` |
| `clarified_to` | string | Refined intent e.g. `"work_overload_stress"` |
| `triggers` | array (string) | Identified trigger factors |
| `coping_attempts` | array (string) | Coping strategies user mentioned |

**`reflection_prompt` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `prompt_text` | string | CBT prompt shown to user |
| `prompt_type` | string | e.g. `"cbt_clarification"` |
| `generated_at` | timestamp | When prompt was generated |
| `user_response` | string | User's written response |
| `user_response_timestamp` | timestamp | When user responded |
| `was_helpful` | boolean | Whether user marked it helpful |

**`biometrics` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `resting_hr` | number | Resting heart rate (bpm) |
| `hr_variability` | number | Heart rate variability (ms) |
| `sleep_hours` | number | Hours of sleep last night |
| `sleep_quality_score` | number | Sleep quality (0.0–1.0) |
| `steps` | number | Step count for the day |
| `stress_level` | number | Self-reported stress (1–10) |
| `sync_timestamp` | timestamp | When biometrics were synced |

**`safety_flags` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `severity_flag` | string | `"normal"`, `"moderate"`, or `"high"` |
| `red_zone_triggered` | boolean | Whether red zone was activated |
| `crisis_language_detected` | boolean | Whether crisis keywords were found |

---

### 5. `reflection_prompts_and_responses`

Standalone log of all CBT prompts and user responses, separate from journal entries.

**Document ID:** Auto-generated UUID

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Owner user → ref: `users` |
| `entry_id` | string | Linked journal entry → ref: `journal_entries` |
| `prompt_text` | string | CBT prompt text |
| `prompt_type` | string | e.g. `"cbt_clarification"`, `"cbt_positive_reinforcement"` |
| `generated_at` | timestamp | When prompt was generated |
| `user_response` | string | User's response text |
| `user_response_timestamp` | timestamp | When user responded |
| `was_helpful` | boolean | Whether user marked it helpful |
| `helpful_rating` | number | Rating 1–5 |
| `cbt_technique_used` | string | e.g. `"cognitive_exploration"` |

---

### 6. `red_flag_alert_logs`

Logs automated safety alerts triggered by sustained emotional decline.

**Document ID:** Auto-generated UUID

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Affected user → ref: `users` |
| `therapist_id` | string | Notified therapist → ref: `therapist_bridges` |
| `alert_type` | string | e.g. `"sustained_emotional_decline"` |
| `severity` | string | `"moderate"`, `"high"`, or `"critical"` |
| `triggered_at` | timestamp | When alert was triggered |
| `trigger_reason` | string | Human-readable reason for alert |
| `alert_status` | string | `"pending"`, `"viewed"`, or `"resolved"` |
| `therapist_viewed_at` | timestamp | When therapist opened alert (null if not yet) |
| `therapist_action_taken` | string | Action description (null if none yet) |
| `action_timestamp` | timestamp | When action was taken (null if none yet) |
| `resolved_at` | timestamp | When alert was resolved (null if open) |

---

### 7. `consent_audit_logs`

Immutable audit trail of all consent and privacy actions taken by users.

**Document ID:** Auto-generated UUID

| Field | Type | Description |
|---|---|---|
| `user_id` | string | User who performed the action → ref: `users` |
| `consent_type` | string | e.g. `"therapist_access"` |
| `action` | string | `"granted"` or `"revoked"` |
| `action_timestamp` | timestamp | When action occurred |
| `feature_affected` | string | e.g. `"therapist_longitudinal_view"` |
| `access_level` | string | e.g. `"longitudinal_summary_only"` |
| `metadata` | map | Additional context (see below) |

**`metadata` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `therapist_id` | string | Therapist involved → ref: `therapist_bridges` |
| `ip_address` | string | User's IP at time of action |
| `user_agent` | string | Browser/device info |

---

### 8. `biometric_sync_logs`

Logs each sync attempt from Google Fit / Apple Health.

**Document ID:** Auto-generated UUID

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Owner user → ref: `users` |
| `sync_timestamp` | timestamp | When sync was attempted |
| `provider` | string | `"google_fit"` or `"apple_health"` |
| `status` | string | `"success"` or `"failed"` |
| `error_message` | string | Error details (null if success) |
| `next_retry_at` | timestamp | Next retry time (null if success) |
| `data_synced` | map | Summary of synced data (see below) |

**`data_synced` map fields:**

| Sub-field | Type | Description |
|---|---|---|
| `metrics_count` | number | Number of metrics synced |
| `date_range` | string | Date range of synced data |

---

### 9. `memory_feedback`

Stores user feedback on AI-extracted memories to improve accuracy over time.

**Document ID:** Auto-generated UUID

| Field | Type | Description |
|---|---|---|
| `user_id` | string | Owner user → ref: `users` |
| `memory_id` | string | Linked memory → ref: `memories` |
| `memory_text` | string | Copy of the memory text being reviewed |
| `user_feedback` | string | `"agree"`, `"disagree"`, or `"partially"` |
| `feedback_timestamp` | timestamp | When feedback was given |
| `confidence_boost` | number | Score adjustment applied (e.g. `0.05`) |
| `is_accurate` | boolean | Whether memory was marked accurate |
| `user_notes` | string | Optional user comment |

---

## Collection Interaction Flow

```
1. User creates journal entry
        ↓
   [journal_entries] — new document created

2. System generates CBT prompt
        ↓
   [reflection_prompts_and_responses] — new document created

3. User responds to prompt
        ↓
   [reflection_prompts_and_responses] — document updated

4. AI extracts patterns from entry
        ↓
   [memories] — new document created with confidence score

5. User reviews extracted memory
        ↓
   [memory_feedback] — new document created

6. Safety check runs on entry
        ↓
   [red_flag_alert_logs] — new document created IF severity triggers

7. User grants/revokes therapist access
        ↓
   [therapist_bridges] — updated
   [consent_audit_logs] — new immutable log document created

8. Biometrics sync runs periodically
        ↓
   [biometric_sync_logs] — new document created per sync attempt
```

---

## ID Reference Map

| Field | Lives In | References |
|---|---|---|
| `user_id` | all collections | `users` document ID |
| `therapist_id` | `therapist_bridges`, `red_flag_alert_logs`, `consent_audit_logs` | `users` document ID (therapist) |
| `entry_id` | `reflection_prompts_and_responses` | `journal_entries` document ID |
| `memory_id` | `memory_feedback` | `memories` document ID |

---

## Notes

- All `_at` and `_timestamp` fields use Firestore **Timestamp** type, not strings
- Firestore has **no enforced foreign keys** — referential integrity is handled by application logic
- Document IDs for `users` should match **Firebase Auth UIDs** in production
- All other collections use **Auto-generated IDs**
- Database is currently in **Test Mode** — security rules must be added before production launch (expires 30 days from setup)

---

## SentiMed Integration Additions (October 2026)

Additive only: no existing field was renamed or removed. Documents written before these
additions remain valid; the backend treats missing fields safely (see notes).

### New fields on existing collections

| Collection | Field | Type | Notes |
|---|---|---|---|
| `users` | `role` | string | `patient` \| `doctor` \| `admin`. **Display mirror only**, written by the backend. The authoritative role is the Firebase Auth custom claim `role` (legacy claims `user`/`therapist` are read as `patient`/`doctor`). |
| `users` | `phone`, `language` | string | Profile / onboarding |
| `users` | `emergency_contact` | map | `{ name, relation, phone }` |
| `users` | `onboarding` | map | `{ completed, completed_at, sections{basic_info, emergency_contact, wellness_screening, safety_screening, privacy_consent}, privacy_consent, privacy_consent_at, risk_category (LOW\|MODERATE\|HIGH_URGENT), screening{wellness, safety} }` — risk is computed server-side |
| `users` | `doctor_profile` | map | `{ specialization, clinic_id, clinic_name, status (Active\|On Leave\|Inactive) }` — set by admins |
| `journal_entries` | `visibility` | string | `private` \| `shared`. **Missing = private.** Doctors can read only `shared` entries of patients with an active consent bridge, projected by `access_level` |
| `red_flag_alert_logs` | `therapist_id` = `''` | — | Unassigned alert (no consented doctor): admin triage queue |
| `red_flag_alert_logs` | `last_actor_id`, `last_actor_role` | string | Who last changed the alert status |

### New collections

| Collection | Document ID | Key fields | Access |
|---|---|---|---|
| `appointments` | auto | `patient_id`, `patient_name`, `doctor_id`, `doctor_name`, `specialization`, `clinic_name`, `date` (YYYY-MM-DD), `time`, `type`, `reason`, `notes`, `status` (PENDING\|CONFIRMED\|REJECTED\|RESCHEDULE_REQUESTED\|CANCELLED\|COMPLETED), `created_by`, `meeting_provider` (`jitsi`), `meeting_url`, `rescheduled_date/time/note`, `rejection_reason`, `cancelled_by`, `created_at`, `updated_at` | Participants only; state changes via a server-side transition table in a transaction |
| `care_instructions` | auto | `patient_id`, `patient_name`, `doctor_id`, `doctor_name`, `type`, `medication_name`, `schedule`, `start_date`, `end_date`, `notes`, `status` (Active\|Paused\|Completed) | Created by a doctor for a consenting patient |
| `messages` | auto | `patient_id`, `doctor_id`, `sender_id`, `sender_role`, `sender_name`, `text`, `created_at` | Both parties, while consent is active |
| `clinics` | auto | `name`, `location`, `contact`, `status` | Read: signed-in users; write: admins |
| `admin_audit_logs` | auto | `actor_id`, `actor_role`, `action` (SET_ROLE, UPDATE_DOCTOR_PROFILE, ADD_CLINIC), `target_id`, `details`, `timestamp` | Admin read; append-only |

All new queries are equality-only (automatic single-field indexes) except the doctor's
shared-journal list, which uses composite index `journal_entries (user_id, visibility, created_at DESC)`.
See `firestore.indexes.json` (26 composite indexes, verified against Firestore's own suggestions).

### Undocumented legacy collection

`chat_sessions` exists in the live database (1 document: `chat_id`, `title`, `user_id`,
`updated_at` stored as a **string**) but is not used by any code. Left untouched; see
`docs/data-reconciliation-plan.md` (A14).

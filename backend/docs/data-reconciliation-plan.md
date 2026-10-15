# Firestore Data Reconciliation Plan — `sentience-6f40e`

> **Status: PROPOSAL ONLY — nothing in this document has been executed.**
> Every step that writes to live Firestore or Firebase Auth requires explicit approval.
> Prepared 2026-10-15 from read-only inspection (Admin SDK reads, `limit`/`count` queries, Admin REST `GET`s).

---

## 1. Verified facts (live, read-only)

| Fact | Evidence |
|---|---|
| Database `(default)`, `FIRESTORE_NATIVE`, Standard edition, `asia-south1` | Firestore Admin API `GET database` |
| **Point-in-time recovery: DISABLED. Delete protection: DISABLED** | same |
| 10 root collections, **26 documents total**, no subcollections anywhere | `listCollections`, `count()`, `listCollections()` on every doc |
| **All 4 `users` documents use `@example.*` email addresses** → demo/seed data, not real patients | field check (boolean only; values not printed) |
| **Firebase Auth has 0 users.** None of the 4 `users` doc IDs is an Auth UID | `auth.listUsers()` |
| `users` doc IDs are custom (`aaaaaa_aaaa_999`, `aaaa_999_aaaaa` patterns, 14–15 chars), consistent with `seed.js` IDs | ID shape only |
| No `role` field on any `users` doc; no custom claims (no Auth users) | field + Auth audit |
| Every `user_id` in every collection resolves to one of the 4 `users` docs | reference check |
| The only `therapist_id` value (1 bridge + 2 alerts) is the seed placeholder `therapist_auth_uid_abc123`, which has no `users` doc and no Auth account | reference check |
| `chat_sessions`: 1 doc, owned by an existing user (U1), `chat_id == doc ID`, `updated_at` is a **string** (not ISO-8601, not a Timestamp), no messages subcollection | field types |
| No composite indexes exist; only the default single-field config | Firestore Admin API `GET indexes` / `fields` |

Users are referred to below as **U1–U4** (stable labels from the inspection order) so that custom IDs containing names are not reproduced here.

## 2. Anomaly inventory

| # | Collection / document | Problem | Effect on current code |
|---|---|---|---|
| A1 | `users` U1–U4 | Doc IDs are not Auth UIDs; no Auth accounts | Nobody can sign in as these users; `GET /api/users/me` for a real user creates a *new* profile |
| A2 | `users` U1–U4 | No role anywhere | All future roles would come only from claims; demo data has no doctor/admin |
| A3 | `therapist_bridges`, `red_flag_alert_logs` (2) | `therapist_id = therapist_auth_uid_abc123` — no such user | Bridge and alerts are unreachable by any real doctor |
| A4 | `users` U1 | `structured_memory` nested under `preferences` instead of top level | `userRepository.update` merges the wrong map; UI would show defaults |
| A5 | `users` U1 | key `"theme "` (trailing space) inside `preferences`; no `theme` | Theme preference read as missing |
| A6 | `memories/WAZyWJugLKr8h4AAFVwy` | key `"metadata "`; no `metadata` | `metadata.associated_entry_id` read as missing |
| A7 | `consent_audit_logs/pKTv1xd8E7XKnJKi8Ej3` (only doc) | key `"metadata "`; no `metadata` | `metadata.therapist_id` read as missing in consent history |
| A8 | `biometric_sync_logs/vhSRYQpBkUAv56DooaT8` | key `"data_synced "`; no `data_synced` | Sync summary read as missing |
| A9 | `journal_entries/CPFLAGNslVPzpKHtSElp` | Safety flags stored in a top-level map named `sync_timestamp`; `safety_flags` missing | **Safety severity filter ignores this entry**; `severity` query never matches it |
| A10 | `journal_entries/CPFLAGNslVPzpKHtSElp` | Scores stored in `detected_emotions.detected_emotions` (keys `anxiety`, `fatigue`, `rumination`); `all_28_states` missing | Emotion breakdown read as empty |
| A11 | `journal_entries` (4 of 5) | `primary_state` values `anxiety`, `stress`, `loneliness` are not in the backend's GoEmotions-28 list; `all_28_states` has 3–4 free-form keys | No crash (schema is free-form), but vocabulary differs from the mock model and the frontend's 6 moods |
| A12 | `memory_feedback` (2 of 2) | `memory_id` does not resolve to any `memories` doc | Orphaned feedback |
| A13 | `reflection_prompts_and_responses` (1 of 1) | `entry_id` does not resolve to any `journal_entries` doc | Orphaned prompt |
| A14 | `chat_sessions` (1) | Not in code, `SCHEMA.md`, or rules; `updated_at` is a string | Unused today; would sort incorrectly if adopted |
| A15 | `journal_entries` (5 of 5) | No `visibility` (private/shared) field | Handled in code (missing ⇒ private); no backfill needed |

## 3. Guiding decisions

1. **Treat existing data as demo fixtures.** Evidence: example.com emails, seed-script ID patterns, placeholder therapist ID, zero Auth users. This lowers risk but does not remove the backup requirement.
2. **Never rewrite document IDs.** Firestore cannot rename documents; "renaming" means copy + delete across 9 collections. Instead, **give each demo user an Auth account whose UID equals the existing doc ID** (`auth.createUser({ uid })` accepts custom UIDs up to 128 chars). All `user_id` references then become valid with **zero Firestore writes**.
3. **Same trick for the therapist mismatch (A3):** create one demo doctor Auth account with `uid = therapist_auth_uid_abc123`, plus its `users` profile doc. Bridge and alerts become valid without editing them.
4. **Fix malformed keys in place** with per-document, idempotent, precondition-checked updates — no deletes of documents.
5. **Do not delete orphans** (A12, A13). Make readers tolerate them; revisit after the demo.
6. **Leave `chat_sessions` untouched** until its owner/purpose is confirmed; document it.
7. **Code must tolerate the old shapes anyway** (missing `visibility` ⇒ private, missing `safety_flags` ⇒ treated as unknown, not "normal"), so the app is correct even if no migration ever runs.

## 4. Proposed steps

Each step lists the write it performs. Steps R0–R1 are **read-only** and can run on approval of this plan; R2+ each need their own explicit approval.

### R0 — Backup (read-only on Firestore)
- **Local JSON export** of all 26 docs with type tags (Timestamps, nulls, nested maps) via a read-only Admin SDK script → `Santiance/_backups/firestore-2026-10-15.json` (outside the repo; contains demo personal data, never committed).
- Record each document's `updateTime` for use as a write precondition in R3.
- **Recommended config changes (your approval, project-level, non-destructive):** enable PITR (7-day recovery window) and delete protection on `(default)`. A managed `gcloud firestore export` to Cloud Storage is the production-grade alternative but needs a bucket and the `datastore.importExportAdmin` role; for 26 docs the local export is sufficient.
- *Verify:* re-read export, compare doc counts per collection (26) and a per-document content hash.

### R1 — Dry-run report (read-only)
- `backend/scripts/reconcile-2026-10.js` (to be written) runs in `--dry-run` mode by default, printing the exact field-level diff for R3 per document ID, without values of personal fields.
- *Verify:* reviewed by you before any `--apply`.

### R2 — Auth accounts for demo personas (Auth writes, **no Firestore writes**)
| Account | UID | Role claim | Purpose |
|---|---|---|---|
| Demo patients ×4 | existing `users` doc IDs (U1–U4) | `patient` | Makes existing journals/memories/alerts reachable |
| Demo doctor ×1 | `therapist_auth_uid_abc123` | `doctor` | Resolves A3 |
| Bootstrap admin ×1 | new Auth UID (your real account, or a dedicated one) | `admin` | Only path to grant privileged roles afterwards |
- Emails: reuse the docs' example.com addresses for patients only if you approve; otherwise use `*@sentience.invalid`. Passwords generated locally and handed to you, never logged.
- Doctor profile doc `users/therapist_auth_uid_abc123` — **one Firestore create** (new doc, no overwrite; `create()` fails if it exists).
- *Verify:* `listUsers` shows 6 accounts with expected claims; reference check shows 0 unresolved `therapist_id`s.
- *Rollback:* `auth.deleteUser(uid)` for the 6 accounts; delete the one created doctor doc.

### R3 — Fix malformed fields (Firestore updates, 5 documents)
All updates use `docRef.update(..., { lastUpdateTime })` so they abort if the document changed since R0, and `FieldValue.delete()` only on the malformed key being moved.

| Fix | Document | Operation |
|---|---|---|
| A4 | `users/U1` | set `structured_memory` = value of `preferences.structured_memory`; delete `preferences.structured_memory` |
| A5 | `users/U1` | set `preferences.theme` = value of `preferences["theme "]`; delete `preferences["theme "]` |
| A6 | `memories/WAZyWJugLKr8h4AAFVwy` | set `metadata` = `["metadata "]`; delete `["metadata "]` |
| A7 | `consent_audit_logs/pKTv1xd8E7XKnJKi8Ej3` | same rename. ⚠️ Audit logs are meant to be immutable; this is acceptable **only because it is seed data**. Alternative: leave it and handle the legacy key in the reader. **Decision needed.** |
| A8 | `biometric_sync_logs/vhSRYQpBkUAv56DooaT8` | set `data_synced` = `["data_synced "]`; delete `["data_synced "]` |
| A9 | `journal_entries/CPFLAGNslVPzpKHtSElp` | set `safety_flags` = value of `sync_timestamp` (map); delete `sync_timestamp` |
| A10 | same doc | set `detected_emotions.all_28_states` = `detected_emotions.detected_emotions`; delete the nested map |

- Conflict pre-checks already verified read-only: none of these documents contains both the malformed and the correct key.
- Field paths containing spaces must be addressed with `new FieldPath('preferences', 'theme ')`, not dotted strings.
- *Verify:* re-run the inspection script: zero whitespace keys, `safety_flags` present on 5/5 journal entries, severity-filtered query returns the expected entry.
- *Rollback:* restore each affected document from the R0 export with `set()` (exact original content), guarded by the post-migration `updateTime`.

### R4 — Optional, cosmetic (each separately approved)
- A11: **no data change.** Map vocabularies in code (frontend adapter: `anxiety|nervousness|fear → Anxious`, `sadness|grief|loneliness → Sad`, `relief|joy|gratitude → Joyful`/`Calm`, `annoyance|anger|stress → Angry`/`Anxious`, …) — exact table to be agreed in the journal stage.
- A12/A13: leave orphans; UI must tolerate. Deletion only if you request it.
- A14: document `chat_sessions` in `SCHEMA.md` as "undocumented legacy, owner unknown". If the AI companion adopts it later, convert `updated_at` to a Timestamp at that time.
- A15: no backfill; code treats missing `visibility` as `private`.

## 5. Schema additions (needed by later stages, listed here for completeness)
Not part of this reconciliation; each will be proposed with its feature stage.
- `users.role` — **mirror only**, written exclusively by the backend when a claim changes; the custom claim is authoritative.
- `users.phone`, `users.onboarding { completed, sections{…}, updated_at }`, `users.emergency_contact { name, relation, phone }` (frontend onboarding), keeping existing `preferences.emergency_contacts` for compatibility.
- `journal_entries.visibility: 'private' | 'shared'` (default `private`) — requires one new composite index `(visibility, user_id, created_at DESC)` for the doctor list query; it will be added to `firestore.indexes.json` together with that query.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Data loss during updates | R0 export + `lastUpdateTime` preconditions + per-doc rollback; no document deletes |
| Concurrent edits from the console | Preconditions abort the write; script reports and stops |
| Demo accounts usable by others | `.invalid` emails or strong generated passwords; accounts disabled after the demo |
| Mutating an audit record (A7) | Explicit decision; alternative reader-side handling |
| Custom UIDs leak names in tokens/URLs | They already exist as doc IDs; acceptable for demo data, never used for real patients |
| No PITR today | Enable PITR before R2/R3 (recommended) |

## 7. Approval checklist
- [ ] R0 local export (read-only)
- [ ] Enable PITR + delete protection (project config)
- [ ] R1 dry-run script written and reviewed
- [ ] R2 create 6 Auth accounts + 1 doctor profile doc
- [ ] R3 apply 7 field fixes on 5 documents (and decide A7)
- [ ] R4 items individually

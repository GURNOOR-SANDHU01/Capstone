/**
 * Read-side normalization for legacy/hand-entered Firestore documents.
 *
 * The live demo data contains keys with stray whitespace ("metadata ", "data_synced ",
 * "theme ") and a few misplaced maps. Normalizing on read makes the API return the
 * documented schema without migrating stored data; scripts/reconcile-data.js can fix
 * the stored documents once approved. Stored documents are never modified here.
 */

const isPlainMap = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && typeof v.toDate !== 'function' && !Buffer.isBuffer(v);

/** Moves values from whitespace-padded keys to their trimmed key when that key is absent. */
function trimKeys(value) {
  if (!isPlainMap(value)) return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    const trimmed = key.trim();
    const normalizedChild = trimKeys(child);
    if (trimmed === key) {
      out[key] = normalizedChild;
    } else if (!(trimmed in value)) {
      out[trimmed] = normalizedChild;
    }
    // When both "x" and "x " exist the canonical key wins and the padded one is dropped.
  }
  return out;
}

const SAFETY_FLAG_KEYS = ['severity_flag', 'red_zone_triggered', 'crisis_language_detected'];

function normalizeData(data) {
  if (!isPlainMap(data)) return data;
  const doc = trimKeys(data);

  // journal_entries: safety flags saved under `sync_timestamp`
  if (!doc.safety_flags && isPlainMap(doc.sync_timestamp) && SAFETY_FLAG_KEYS.some((k) => k in doc.sync_timestamp)) {
    doc.safety_flags = doc.sync_timestamp;
    delete doc.sync_timestamp;
  }

  // journal_entries: emotion scores nested as detected_emotions.detected_emotions
  if (isPlainMap(doc.detected_emotions)) {
    const emotions = doc.detected_emotions;
    if (!emotions.all_28_states && isPlainMap(emotions.detected_emotions)) {
      doc.detected_emotions = { ...emotions, all_28_states: emotions.detected_emotions };
      delete doc.detected_emotions.detected_emotions;
    }
  }

  // users: structured_memory nested inside preferences
  if (!doc.structured_memory && isPlainMap(doc.preferences) && isPlainMap(doc.preferences.structured_memory)) {
    doc.structured_memory = doc.preferences.structured_memory;
    doc.preferences = { ...doc.preferences };
    delete doc.preferences.structured_memory;
  }

  return doc;
}

/** Converts a Firestore DocumentSnapshot into `{ id, ...data }` with legacy shapes normalized. */
function fromDoc(doc) {
  return { id: doc.id, ...normalizeData(doc.data()) };
}

module.exports = { fromDoc, normalizeData, trimKeys };

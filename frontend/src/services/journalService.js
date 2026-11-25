import { INITIAL_JOURNAL_ENTRIES, MOOD_DEFINITIONS } from "../data/mockData";
import { isRealFirebaseConfigured } from "./firebase";
import { api } from "./apiClient";

const STORAGE_KEY = "sentimed_journal_entries";
const UI_MOODS = MOOD_DEFINITIONS.map((m) => m.label);

/* ------------------------------------------------------------------ */
/* Backend <-> UI mapping (live mode)                                 */
/* ------------------------------------------------------------------ */

// Model emotion labels (GoEmotions-28 plus legacy demo labels) -> the six UI moods
const EMOTION_TO_MOOD = {
  joy: "Joyful", amusement: "Joyful", excitement: "Joyful", gratitude: "Joyful", love: "Joyful",
  pride: "Joyful", admiration: "Joyful", optimism: "Joyful",
  relief: "Calm", approval: "Calm", caring: "Calm", realization: "Calm", neutral: "Calm", curiosity: "Calm",
  nervousness: "Anxious", fear: "Anxious", confusion: "Anxious", anxiety: "Anxious", stress: "Anxious",
  embarrassment: "Anxious", desire: "Anxious", surprise: "Anxious",
  sadness: "Sad", grief: "Sad", disappointment: "Sad", remorse: "Sad", loneliness: "Sad",
  anger: "Angry", annoyance: "Angry", disapproval: "Angry", disgust: "Angry",
  fatigue: "Tired", tired: "Tired", exhaustion: "Tired"
};

export const moodFromEmotions = (detected = {}) => {
  if (UI_MOODS.includes(detected.corrected_emotion)) return detected.corrected_emotion;
  const mapped = EMOTION_TO_MOOD[(detected.corrected_emotion || detected.primary_state || "").toLowerCase()];
  return mapped || "Calm";
};

const toMillis = (ts) => {
  if (!ts) return Date.now();
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") return Date.parse(ts) || Date.now();
  if (typeof ts._seconds === "number") return ts._seconds * 1000;
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return Date.now();
};

export const formatEntryDate = (millis) => {
  const d = new Date(millis);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
};

/** -1..1 sentiment -> 0..100 score used by the UI */
const toScore = (s) => (typeof s === "number" ? Math.round(((Math.max(-1, Math.min(1, s)) + 1) / 2) * 100) : 50);

/**
 * Converts an API journal entry into the shape the existing UI components render.
 * Doctor "summary" views have no text; `text` is then empty and `access` is "summary".
 */
const NEGATIVE_EKMAN = ["anger", "disgust", "fear", "sadness"];

/** 7-class voice probabilities -> -1..1 sentiment (same rule as the model service) */
const voiceSentiment = (scores) => {
  if (!scores || typeof scores !== "object") return null;
  const s = (scores.joy || 0) - NEGATIVE_EKMAN.reduce((sum, k) => sum + (scores[k] || 0), 0);
  return Math.max(-1, Math.min(1, s));
};

/** How the voice and text models were combined for a voice entry (null for typed entries). */
const toVoiceAnalysis = (e) => {
  const va = e.detected_emotions?.voice_analysis;
  if (e.input_source !== "audio" || !va) return null;
  return {
    decision: va.decision || null, // agree | conflict | voice_neutral | no_speech | voice_only_no_text_model
    voiceSays: va.voice_raw || va.voice_says || null,
    textSays: va.text_says || null,
    voiceScores: va.voice_scores || null,
    fusedScores: va.fused_scores || null,
    secondsAnalysed: typeof va.seconds_analysed === "number" ? va.seconds_analysed : null,
    model: e.detected_emotions?.provenance?.model || null
  };
};

/**
 * Fine-grained emotions (GoEmotions, 27 labels) the model found above its per-label thresholds,
 * strongest first. Older entries saved before this field existed fall back to the top scores in
 * all_28_states. Built-in/mock analysis has no real fine-grained output, so it returns [].
 */
const toFineGrained = (de) => {
  if (!de || de.provenance?.is_mock) return [];
  const valid = (x) => x && typeof x.label === "string" && typeof x.score === "number";
  if (Array.isArray(de.fine_grained_emotions) && de.fine_grained_emotions.length) {
    return de.fine_grained_emotions.filter(valid).slice(0, 5);
  }
  return Object.entries(de.all_28_states || {})
    .filter(([label, score]) => label !== "neutral" && typeof score === "number" && score >= 0.1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, score]) => ({ label, score }));
};

export const fromApiEntry = (e) => {
  const millis = toMillis(e.created_at);
  const score = toScore(e.detected_emotions?.sentiment_score);
  const voiceAvailable = e.input_source === "audio";
  const voiceAnalysis = toVoiceAnalysis(e);
  const vs = voiceSentiment(voiceAnalysis?.voiceScores);
  return {
    id: e.id,
    patientId: e.user_id,
    date: formatEntryDate(millis),
    timestamp: millis,
    entryDate: e.entry_date,
    mood: moodFromEmotions(e.detected_emotions),
    detectedEmotion: e.detected_emotions?.primary_state || null,
    emotionConfidence: typeof e.detected_emotions?.confidence === "number" ? e.detected_emotions.confidence : null,
    isMockAnalysis: Boolean(e.detected_emotions?.provenance?.is_mock),
    inputSource: e.input_source || "text",
    voiceAnalysis,
    fineGrained: toFineGrained(e.detected_emotions),
    intent: e.intent_object?.intent
      ? {
          intent: e.intent_object.intent,
          triggers: e.intent_object.triggers || [],
          coping: e.intent_object.coping_attempts || []
        }
      : null,
    ekmanScores: e.detected_emotions?.provenance?.is_mock ? null : e.detected_emotions?.ekman_scores || null,
    text: e.masked_content || "",
    tags: e.extracted_themes || [],
    sentiment: score,
    privacy: e.visibility === "shared" ? "shared" : "private",
    multimodal: { text: score, voice: voiceAvailable ? (vs !== null ? toScore(vs) : score) : null, video: null },
    reflection: e.reflection_prompt?.user_response || "",
    reflectionPrompt: e.reflection_prompt?.prompt_text || "",
    severity: e.safety_flags?.severity_flag || null,
    access: e.access || "owner"
  };
};

/* ------------------------------------------------------------------ */
/* Sandbox (offline demo) persistence                                 */
/* ------------------------------------------------------------------ */

export const getJournalEntries = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to load journal entries from localStorage", err);
  }
  return INITIAL_JOURNAL_ENTRIES;
};

export const saveJournalEntries = (entries) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn("Failed to persist journal entries to localStorage", err);
  }
};

export const createJournalEntry = (newEntryData) => {
  const currentEntries = getJournalEntries();
  const moodDef = MOOD_DEFINITIONS.find(m => m.label === newEntryData.mood) || MOOD_DEFINITIONS[1];

  // Simple heuristic sentiment scoring based on mood if not specified
  let estimatedSentiment = 60;
  if (newEntryData.mood === "Joyful") estimatedSentiment = 90;
  if (newEntryData.mood === "Calm") estimatedSentiment = 75;
  if (newEntryData.mood === "Anxious") estimatedSentiment = 35;
  if (newEntryData.mood === "Sad") estimatedSentiment = 25;
  if (newEntryData.mood === "Angry") estimatedSentiment = 20;
  if (newEntryData.mood === "Tired") estimatedSentiment = 45;

  const now = new Date();
  const formattedDate = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const createdEntry = {
    id: `entry-${Date.now()}`,
    date: formattedDate,
    timestamp: Date.now(),
    mood: newEntryData.mood || "Calm",
    moodEmoji: moodDef.emoji,
    text: newEntryData.text || "",
    tags: newEntryData.tags || ["reflection"],
    sentiment: estimatedSentiment,
    privacy: newEntryData.privacy === "shared" ? "shared" : "private",
    multimodal: {
      text: estimatedSentiment,
      voice: Math.min(100, estimatedSentiment + Math.floor(Math.random() * 6 - 3)),
      video: Math.min(100, estimatedSentiment + Math.floor(Math.random() * 8 - 4))
    },
    reflection: newEntryData.reflection || moodDef.cbt
  };

  const updated = [createdEntry, ...currentEntries];
  saveJournalEntries(updated);
  return { updatedEntries: updated, createdEntry };
};

export const deleteJournalEntry = (entryId) => {
  const currentEntries = getJournalEntries();
  const updated = currentEntries.filter(e => e.id !== entryId);
  saveJournalEntries(updated);
  return updated;
};

/* ------------------------------------------------------------------ */
/* Unified async API used by the UI (live -> Express, sandbox -> local) */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 50;

export async function listJournalEntries() {
  if (!isRealFirebaseConfigured) return getJournalEntries();
  const { data } = await api.get("/journal-entries", { limit: PAGE_SIZE });
  return (data || []).map(fromApiEntry);
}

export async function addJournalEntry({ mood, text, privacy, tags, reflection }) {
  if (!isRealFirebaseConfigured) return createJournalEntry({ mood, text, privacy, tags, reflection }).createdEntry;
  const body = {
    content: text,
    visibility: privacy === "shared" ? "shared" : "private",
    self_reported_emotion: mood,
    extracted_themes: (tags || []).map((t) => t.trim()).filter(Boolean).slice(0, 20)
  };
  if (reflection && reflection.trim()) body.reflection_response = reflection.trim();
  const { data } = await api.post("/journal-entries", body);
  return fromApiEntry(data);
}

/** True when voice journaling can be used (needs the live backend + model service). */
export const voiceJournalSupported = () =>
  isRealFirebaseConfigured && typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Voice entry: uploads the recording; the server transcribes it (Whisper), scores voice + text
 * emotion (WavLM + SoulScribe fusion), and saves the PII-scrubbed transcript. Audio is not stored.
 */
export async function addVoiceJournalEntry({ audio, privacy, tags, reflection }) {
  if (!isRealFirebaseConfigured) {
    throw new Error("Voice journaling needs the live backend. Switch out of Sandbox mode to use it.");
  }
  const query = {
    visibility: privacy === "shared" ? "shared" : "private",
    tags: (tags || []).map((t) => t.trim().replace(/,/g, " ")).filter(Boolean).slice(0, 20).join(",") || undefined,
    reflection_response: reflection && reflection.trim() ? reflection.trim() : undefined
  };
  const { data } = await api.upload("/journal-entries/audio", audio, {
    query,
    contentType: (audio.type || "audio/webm").split(";")[0],
    timeoutMs: 180000 // first run loads Whisper + WavLM; transcription can take a while
  });
  return fromApiEntry(data);
}

/** Which AI models the backend is actually using (shown as a status chip). */
export async function getModelStatus() {
  if (!isRealFirebaseConfigured) return { mode: "sandbox" };
  try {
    const { data } = await api.get("/health/model", undefined, { timeoutMs: 5000 });
    if (data?.adapter === "mock") return { mode: "builtin" };
    if (data?.status !== "healthy") return { mode: "offline" };
    const m = data.upstream?.models || {};
    return {
      mode: "live",
      voice: Boolean(m.audio_wavlm && m.whisper),
      voiceModel: Boolean(m.audio_wavlm),
      whisper: Boolean(m.whisper),
      text: Boolean(m.text_soulscribe),
      textModel: m.text_model || null,
      llm: Boolean(m.llm),
      llmModel: m.llm_model || null,
      audioClasses: data.upstream?.audio_classes || [],
      device: data.upstream?.device || null
    };
  } catch {
    return { mode: "offline" };
  }
}

export async function removeJournalEntry(entryId) {
  if (!isRealFirebaseConfigured) {
    deleteJournalEntry(entryId);
    return;
  }
  await api.delete(`/journal-entries/${encodeURIComponent(entryId)}`);
}

export async function setJournalEntryVisibility(entryId, privacy) {
  const visibility = privacy === "shared" ? "shared" : "private";
  if (!isRealFirebaseConfigured) {
    const updated = getJournalEntries().map((e) => (e.id === entryId ? { ...e, privacy: visibility } : e));
    saveJournalEntries(updated);
    return updated.find((e) => e.id === entryId);
  }
  const { data } = await api.patch(`/journal-entries/${encodeURIComponent(entryId)}`, { visibility });
  return fromApiEntry(data);
}

/** Doctor: entries a consenting patient shared (projected by consent level on the server). */
export async function listPatientSharedEntries(patientId) {
  if (!isRealFirebaseConfigured) {
    return { entries: getJournalEntries().filter((e) => e.privacy === "shared"), access: "full" };
  }
  const { data, pagination } = await api.get(`/patients/${encodeURIComponent(patientId)}/journal-entries`, { limit: PAGE_SIZE });
  return { entries: (data || []).map(fromApiEntry), access: pagination?.access || "summary" };
}

/**
 * Edits an entry. Live: new text is masked and re-analysed by the server (emotion, safety);
 * the user's self-reported mood and reflection are updated as their own fields.
 */
export async function editJournalEntry(entryId, { text, reflection, mood }) {
  if (!isRealFirebaseConfigured) {
    let edited;
    const updated = getJournalEntries().map((e) => {
      if (e.id !== entryId) return e;
      edited = { ...e, text, reflection, mood: mood || e.mood };
      return edited;
    });
    saveJournalEntries(updated);
    return edited;
  }
  const body = { content: text };
  if (reflection && reflection.trim()) body.reflection_prompt = { user_response: reflection.trim() };
  if (mood) body.detected_emotions = { corrected_emotion: mood };
  const { data } = await api.patch(`/journal-entries/${encodeURIComponent(entryId)}`, body);
  return fromApiEntry(data);
}

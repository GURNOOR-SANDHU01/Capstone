/**
 * SentiMed AI Companion Service
 * Mock response generator with CBT principles and wellness guidance.
 * Note: Non-medical, educational/reflection wellness companion only.
 */

import { isRealFirebaseConfigured } from "./firebase";
import { api } from "./apiClient";

const MOCK_AI_RESPONSES = [
  "Thank you for sharing that with me. It takes courage to put your thoughts into words. When you notice that feeling, what physical sensations do you experience first?",
  "That sounds like a heavy situation to navigate. If a close friend came to you describing this exact experience, what compassionate advice would you offer them?",
  "I hear you. Let's take a quick breath together: Inhale for 4 seconds, hold for 4, and exhale for 6. How does your posture and chest feel right now?",
  "Reflecting on what you described, notice if there are any binary 'all-or-nothing' assumptions in your mind. Is there a more balanced perspective you can consider?",
  "I'm here to listen. Taking a moment to log how you feel is an empowering step toward emotional awareness."
];

export const generateCompanionReply = async (userMessage) => {
  // Simulate natural assistant thinking delay
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 600));

  const lower = userMessage.toLowerCase();
  
  if (lower.includes("stressed") || lower.includes("anxious") || lower.includes("tight")) {
    return "I notice you mentioned feeling stressed or anxious. Try grounding yourself using the 5-4-3-2-1 technique: Name 5 things you can see around you right now, 4 things you can physically touch, 3 things you hear, 2 things you smell, and 1 slow breath.";
  }
  
  if (lower.includes("pattern") || lower.includes("reflect")) {
    return "Looking at your recent reflections, your mood tends to elevate after spending time outdoors or connecting with friends. Building short 15-minute breaks into your day might help sustain that stability.";
  }

  if (lower.includes("exercise") || lower.includes("mindfulness")) {
    return "Here is a simple 2-minute box breathing exercise:\n1. Inhale deeply through your nose for 4 seconds.\n2. Hold your breath gently for 4 seconds.\n3. Exhale smoothly through your mouth for 4 seconds.\n4. Rest for 4 seconds.\nRepeat this 3 times.";
  }

  // Fallback response from pool
  const randomIndex = Math.floor(Math.random() * MOCK_AI_RESPONSES.length);
  return MOCK_AI_RESPONSES[randomIndex];
};

/* ------------------------------------------------------------------ */
/* Live mode: backend analysis pipeline (PII-scrubbed server-side)     */
/* ------------------------------------------------------------------ */

const CRISIS_REPLY =
  "I'm really glad you told me. What you're describing sounds serious, and you deserve support right now. " +
  "If you might act on these thoughts or are in danger, please call your local emergency number or a crisis line " +
  "(for example 988 in the US, or Tele-MANAS 14416 in India). You can also reach out to someone you trust. " +
  "I'm a reflection companion, not a substitute for professional care.";

/** Voice input is available only in the live portal (it needs the model service) on a browser that can record. */
export const companionVoiceSupported = () =>
  isRealFirebaseConfigured && typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Transcribes a spoken companion message and scores its emotion (voice tone + words).
 * Uses the no-storage preview endpoint: neither the audio nor the transcript is saved.
 * Resolves { transcript, emotion, voiceSays, textSays, decision, detectedEmotions }.
 */
export async function transcribeCompanionVoice(audio) {
  const { data } = await api.upload("/analysis/audio", audio, {
    contentType: (audio.type || "audio/webm").split(";")[0],
    timeoutMs: 180000
  });
  return {
    transcript: (data.transcript || "").trim(),
    emotion: data.emotion || data.detected_emotions?.primary_state || null,
    voiceSays: data.voice_raw || data.voice_says || null,
    textSays: data.text_says || null,
    decision: data.decision || null,
    detectedEmotions: data.detected_emotions || null
  };
}

/**
 * Companion reply. Live: emotion -> safety -> CBT reflection via the backend (no chat text is stored).
 * Sandbox: the local rule-based replies above.
 */
export const getCompanionReply = async (userMessage, { voiceEmotions = null } = {}) => {
  if (!isRealFirebaseConfigured) return generateCompanionReply(userMessage);

  // A spoken message already has an emotion from the voice + text models; typed text is analysed here.
  // The safety check below always runs on the words (and keeps the server's crisis-language floor).
  const emotions = voiceEmotions || (await api.post("/analysis/emotions", { content: userMessage })).data;
  const { data: safety } = await api.post("/analysis/safety", {
    content: userMessage,
    detected_emotions: {
      primary_state: emotions.primary_state,
      confidence: emotions.confidence,
      sentiment_score: emotions.sentiment_score
    }
  });
  if (safety.severity_flag === "high" || safety.crisis_language_detected) return CRISIS_REPLY;

  const { data: reflection } = await api.post("/analysis/reflection", {
    content: userMessage,
    primary_emotion: emotions.primary_state,
    sentiment_score: emotions.sentiment_score
  });
  return reflection.prompt_text;
};

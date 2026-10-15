// ============================================================
// Sentience App — Firestore Seed Script
// Run: node seed.js
// Requires: npm install firebase-admin
// Place your serviceAccountKey.json in the same folder
// ============================================================

// Safety guard: seeding uses set(), which OVERWRITES existing documents. Only run it against the
// local emulator unless the live project is targeted deliberately with --force-live.
if (!process.env.FIRESTORE_EMULATOR_HOST && !process.argv.includes("--force-live")) {
  console.error(
    "Refusing to seed: FIRESTORE_EMULATOR_HOST is not set. Seeding overwrites existing documents.\n" +
      "Run against the emulator, or pass --force-live only if you intend to overwrite live data."
  );
  process.exit(1);
}

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const ts = (daysAgo = 0, hoursAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return Timestamp.fromDate(d);
};

async function seedUsers() {
  const users = [
    {
      id: "user_001_arjun",
      data: {
        full_name: "Arjun Sharma",
        email: "arjun.sharma@example.com",
        created_at: ts(30),
        updated_at: ts(1),
        preferences: {
          theme: "dark",
          cbt_alignment: true,
          daily_reminder_time: "08:00",
          emergency_contacts: ["+919876543210"],
        },
        structured_memory: {
          sleep_goal: "7 hours",
          preferred_coping_strategies: ["deep_breathing", "journaling", "walking"],
        },
        resilience_streaks: {
          current_streak: 12,
          longest_streak: 21,
          last_check_in: ts(1),
        },
      },
    },
    {
      id: "user_002_priya",
      data: {
        full_name: "Priya Nair",
        email: "priya.nair@example.com",
        created_at: ts(20),
        updated_at: ts(0),
        preferences: {
          theme: "light",
          cbt_alignment: true,
          daily_reminder_time: "21:00",
          emergency_contacts: ["+919812345678"],
        },
        structured_memory: {
          sleep_goal: "8 hours",
          preferred_coping_strategies: ["mindful_walking", "meditation", "journaling"],
        },
        resilience_streaks: {
          current_streak: 5,
          longest_streak: 14,
          last_check_in: ts(0),
        },
      },
    },
    {
      id: "user_003_karan",
      data: {
        full_name: "Karan Mehta",
        email: "karan.mehta@example.com",
        created_at: ts(10),
        updated_at: ts(2),
        preferences: {
          theme: "dark",
          cbt_alignment: false,
          daily_reminder_time: "20:00",
          emergency_contacts: ["+919898765432"],
        },
        structured_memory: {
          sleep_goal: "6 hours",
          preferred_coping_strategies: ["exercise", "music", "deep_breathing"],
        },
        resilience_streaks: {
          current_streak: 3,
          longest_streak: 7,
          last_check_in: ts(2),
        },
      },
    },
  ];

  for (const user of users) {
    await db.collection("users").doc(user.id).set(user.data);
    console.log(`✅ User created: ${user.data.full_name}`);
  }
}

async function seedJournalEntries() {
  const entries = [
    {
      user_id: "user_001_arjun",
      masked_content: "Had a really tough day with project deadlines piling up. Couldn't focus during the team meeting.",
      entry_type: "daily_journal",
      input_source: "text",
      audio_transcript_confidence: null,
      extracted_themes: ["work", "focus", "stress"],
      entry_date: "2026-06-14",
      created_at: ts(3),
      detected_emotions: {
        primary_state: "stress",
        confidence: 0.88,
        sentiment_score: -0.62,
        all_28_states: { stress: 0.88, frustration: 0.71, fatigue: 0.55, anxiety: 0.40 },
        vocal_prosody: null,
        corrected_emotion: null,
        correction_reason: null,
        user_correction_timestamp: null,
      },
      intent_object: {
        intent: "vague_stress",
        clarified_to: "work_overload_stress",
        triggers: ["deadline_pressure", "team_conflict"],
        coping_attempts: ["deep_breathing"],
      },
      reflection_prompt: {
        prompt_text: "What specifically about the deadlines feels most overwhelming right now?",
        prompt_type: "cbt_clarification",
        generated_at: ts(3),
        user_response: "I feel like I am the only one doing the work and no one notices.",
        user_response_timestamp: ts(3),
        was_helpful: true,
      },
      biometrics: {
        resting_hr: 81,
        hr_variability: 38,
        sleep_hours: 5.0,
        sleep_quality_score: 0.3,
        steps: 4200,
        stress_level: 8,
        sync_timestamp: ts(3),
      },
      safety_flags: {
        severity_flag: "moderate",
        red_zone_triggered: false,
        crisis_language_detected: false,
      },
    },
    {
      user_id: "user_001_arjun",
      masked_content: "Went for a long walk in the evening. Felt much better. Called my friend and talked things out.",
      entry_type: "daily_journal",
      input_source: "audio",
      audio_transcript_confidence: 0.94,
      extracted_themes: ["recovery", "social_support", "exercise"],
      entry_date: "2026-06-15",
      created_at: ts(2),
      detected_emotions: {
        primary_state: "relief",
        confidence: 0.82,
        sentiment_score: 0.58,
        all_28_states: { relief: 0.82, contentment: 0.65, gratitude: 0.50 },
        vocal_prosody: { pitch_std: 32, energy_level: 0.7 },
        corrected_emotion: null,
        correction_reason: null,
        user_correction_timestamp: null,
      },
      intent_object: {
        intent: "positive_reflection",
        clarified_to: "social_recovery",
        triggers: [],
        coping_attempts: ["walking", "social_connection"],
      },
      reflection_prompt: {
        prompt_text: "What made talking to your friend feel helpful today?",
        prompt_type: "cbt_positive_reinforcement",
        generated_at: ts(2),
        user_response: "He just listened without judging. That helped a lot.",
        user_response_timestamp: ts(2),
        was_helpful: true,
      },
      biometrics: {
        resting_hr: 70,
        hr_variability: 52,
        sleep_hours: 7.0,
        sleep_quality_score: 0.72,
        steps: 9800,
        stress_level: 3,
        sync_timestamp: ts(2),
      },
      safety_flags: {
        severity_flag: "normal",
        red_zone_triggered: false,
        crisis_language_detected: false,
      },
    },
    {
      user_id: "user_002_priya",
      masked_content: "Exams are next week and I haven't slept properly in 3 days. My mind just won't stop.",
      entry_type: "daily_journal",
      input_source: "text",
      audio_transcript_confidence: null,
      extracted_themes: ["exams", "sleep", "anxiety"],
      entry_date: "2026-06-15",
      created_at: ts(2),
      detected_emotions: {
        primary_state: "anxiety",
        confidence: 0.95,
        sentiment_score: -0.78,
        all_28_states: { anxiety: 0.95, rumination: 0.85, fear: 0.60, fatigue: 0.70 },
        vocal_prosody: null,
        corrected_emotion: null,
        correction_reason: null,
        user_correction_timestamp: null,
      },
      intent_object: {
        intent: "vague_anxious_feeling",
        clarified_to: "exam_anxiety_sleep_deprivation",
        triggers: ["upcoming_exam", "poor_sleep", "rumination"],
        coping_attempts: ["meditation"],
      },
      reflection_prompt: {
        prompt_text: "When you say your mind won't stop, what thoughts keep coming back?",
        prompt_type: "cbt_clarification",
        generated_at: ts(2),
        user_response: "I keep thinking about failing and letting my parents down.",
        user_response_timestamp: ts(2),
        was_helpful: true,
      },
      biometrics: {
        resting_hr: 88,
        hr_variability: 28,
        sleep_hours: 4.0,
        sleep_quality_score: 0.2,
        steps: 2100,
        stress_level: 9,
        sync_timestamp: ts(2),
      },
      safety_flags: {
        severity_flag: "high",
        red_zone_triggered: false,
        crisis_language_detected: false,
      },
    },
    {
      user_id: "user_003_karan",
      masked_content: "Had a fight with my roommate. Feeling really isolated today. Music is the only thing helping.",
      entry_type: "daily_journal",
      input_source: "audio",
      audio_transcript_confidence: 0.91,
      extracted_themes: ["conflict", "isolation", "coping"],
      entry_date: "2026-06-16",
      created_at: ts(1),
      detected_emotions: {
        primary_state: "loneliness",
        confidence: 0.87,
        sentiment_score: -0.55,
        all_28_states: { loneliness: 0.87, sadness: 0.72, anger: 0.45 },
        vocal_prosody: { pitch_std: 55, energy_level: 0.4 },
        corrected_emotion: null,
        correction_reason: null,
        user_correction_timestamp: null,
      },
      intent_object: {
        intent: "social_conflict",
        clarified_to: "roommate_conflict_isolation",
        triggers: ["interpersonal_conflict", "social_withdrawal"],
        coping_attempts: ["music"],
      },
      reflection_prompt: {
        prompt_text: "What would you want your roommate to understand about how you're feeling?",
        prompt_type: "cbt_perspective_shift",
        generated_at: ts(1),
        user_response: "That I need space sometimes and it doesn't mean I am angry at them.",
        user_response_timestamp: ts(1),
        was_helpful: true,
      },
      biometrics: {
        resting_hr: 75,
        hr_variability: 44,
        sleep_hours: 6.5,
        sleep_quality_score: 0.55,
        steps: 5600,
        stress_level: 6,
        sync_timestamp: ts(1),
      },
      safety_flags: {
        severity_flag: "normal",
        red_zone_triggered: false,
        crisis_language_detected: false,
      },
    },
  ];

  for (const entry of entries) {
    const ref = await db.collection("journal_entries").add(entry);
    console.log(`✅ Journal entry created for: ${entry.user_id} (ID: ${ref.id})`);
  }
}

async function seedMemories() {
  const memories = [
    {
      user_id: "user_001_arjun",
      memory_text: "Arjun feels overwhelmed when project deadlines pile up and team communication breaks down.",
      memory_type: "work_stress",
      importance_score: 0.88,
      created_at: ts(3),
      updated_at: ts(3),
      metadata: { associated_entry_id: "auto_linked", extraction_confidence: 0.91 },
    },
    {
      user_id: "user_001_arjun",
      memory_text: "Social connection and physical activity (walking) are Arjun's most effective recovery strategies.",
      memory_type: "coping_pattern",
      importance_score: 0.76,
      created_at: ts(2),
      updated_at: ts(2),
      metadata: { associated_entry_id: "auto_linked", extraction_confidence: 0.85 },
    },
    {
      user_id: "user_002_priya",
      memory_text: "Priya experiences acute anxiety when exams are near, combined with less than 5 hours of sleep.",
      memory_type: "exam_anxiety",
      importance_score: 0.95,
      created_at: ts(2),
      updated_at: ts(2),
      metadata: { associated_entry_id: "auto_linked", extraction_confidence: 0.93 },
    },
    {
      user_id: "user_003_karan",
      memory_text: "Karan tends to withdraw socially after interpersonal conflicts and uses music as a primary coping tool.",
      memory_type: "social_pattern",
      importance_score: 0.80,
      created_at: ts(1),
      updated_at: ts(1),
      metadata: { associated_entry_id: "auto_linked", extraction_confidence: 0.87 },
    },
  ];

  for (const memory of memories) {
    const ref = await db.collection("memories").add(memory);
    console.log(`✅ Memory created for: ${memory.user_id} (ID: ${ref.id})`);
  }
}

async function seedRedFlagAlerts() {
  await db.collection("red_flag_alert_logs").add({
    user_id: "user_002_priya",
    therapist_id: "therapist_auth_uid_abc123",
    alert_type: "sustained_emotional_decline",
    severity: "high",
    triggered_at: ts(1),
    trigger_reason: "Two consecutive entries with anxiety score above 0.90 and sleep below 5 hours",
    alert_status: "pending",
    therapist_viewed_at: null,
    therapist_action_taken: null,
    action_timestamp: null,
    resolved_at: null,
  });
  console.log("✅ Red flag alert created for: user_002_priya");
}

async function seedMemoryFeedback() {
  const feedbacks = [
    {
      user_id: "user_001_arjun",
      memory_id: "auto_linked",
      memory_text: "Arjun feels overwhelmed when project deadlines pile up.",
      user_feedback: "agree",
      feedback_timestamp: ts(2),
      confidence_boost: 0.07,
      is_accurate: true,
      user_notes: "Yes, this is very true for me.",
    },
    {
      user_id: "user_002_priya",
      memory_id: "auto_linked",
      memory_text: "Priya experiences acute anxiety when exams are near.",
      user_feedback: "agree",
      feedback_timestamp: ts(1),
      confidence_boost: 0.05,
      is_accurate: true,
      user_notes: "Happens every semester without fail.",
    },
  ];

  for (const fb of feedbacks) {
    await db.collection("memory_feedback").add(fb);
    console.log(`✅ Memory feedback created for: ${fb.user_id}`);
  }
}

async function seedBiometricLogs() {
  const logs = [
    { user_id: "user_001_arjun", provider: "google_fit", status: "success" },
    { user_id: "user_002_priya", provider: "apple_health", status: "success" },
    { user_id: "user_003_karan", provider: "google_fit", status: "failed" },
  ];

  for (const log of logs) {
    await db.collection("biometric_sync_logs").add({
      ...log,
      sync_timestamp: ts(0),
      error_message: log.status === "failed" ? "Connection timeout" : null,
      next_retry_at: log.status === "failed" ? ts(-1) : null,
      data_synced: log.status === "success"
        ? { metrics_count: 12, date_range: "last 24 hours" }
        : null,
    });
    console.log(`✅ Biometric log created for: ${log.user_id}`);
  }
}

async function main() {
  console.log("\n🌱 Starting Sentience DB seed...\n");
  await seedUsers();
  await seedJournalEntries();
  await seedMemories();
  await seedRedFlagAlerts();
  await seedMemoryFeedback();
  await seedBiometricLogs();
  console.log("\n✅ All done! Sentience database seeded successfully.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});

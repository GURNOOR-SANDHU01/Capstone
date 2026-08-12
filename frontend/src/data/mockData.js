/**
 * SentiMed Centralized Mock Data
 * Clean, structured mock data supporting Patient, Doctor, and Admin roles with zero emojis.
 */

export const MOOD_DEFINITIONS = [
  {
    label: "Joyful",
    color: "#F5A623",
    bg: "#FFF8EC",
    cbt: "Celebrate this moment! What specific action or environment triggered this positive feeling? How can you cultivate more of this?"
  },
  {
    label: "Calm",
    color: "#4CAF91",
    bg: "#EAF7F2",
    cbt: "A quiet mind is a strength. What details in your environment are helping you feel steady right now?"
  },
  {
    label: "Anxious",
    color: "#5C8DD6",
    bg: "#EAF1FB",
    cbt: "Notice where anxiety lives in your body (tight chest, rapid breathing). Can you state the absolute worst-case scenario and evaluate its realistic probability?"
  },
  {
    label: "Sad",
    color: "#9B6DD6",
    bg: "#F4EEF9",
    cbt: "It is okay to feel heavy. Treat yourself with compassion right now. What is one small, low-energy thing you can do for yourself today?"
  },
  {
    label: "Angry",
    color: "#E05C5C",
    bg: "#FBF0F0",
    cbt: "Anger is information about boundaries. Pause for 3 slow breaths. What boundary of yours felt threatened or ignored?"
  },
  {
    label: "Tired",
    color: "#8A9BB0",
    bg: "#F2F4F6",
    cbt: "Your body is asking for recovery. Is this physical exhaustion, or emotional burnout? What is the smallest restful action you can take?"
  }
];

export const INITIAL_JOURNAL_ENTRIES = [
  {
    id: "entry-1",
    date: "Today, 9:41 AM",
    timestamp: Date.now() - 3600000 * 2,
    mood: "Calm",
    text: "Woke up feeling surprisingly clear-headed despite the rough week. Did a short walk and noticed how the morning light filtered through the trees. It helped quiet my thoughts.",
    tags: ["morning", "nature", "walk"],
    sentiment: 72,
    privacy: "shared", // 'private' or 'shared'
    multimodal: { text: 72, voice: 68, video: 75 },
    reflection: "Focusing on physical sensations in the morning helped prevent my mind from racing about the day's to-do list."
  },
  {
    id: "entry-2",
    date: "Yesterday, 11:20 PM",
    timestamp: Date.now() - 86400000,
    mood: "Anxious",
    text: "Can't stop thinking about the clinician presentation tomorrow. My chest feels tight. I keep running the worst-case scenarios in my head, worrying I will stumble over my words.",
    tags: ["work", "stress", "presentation"],
    sentiment: 28,
    privacy: "private", // Private: Doctor CANNOT see this entry
    multimodal: { text: 25, voice: 30, video: 30 },
    reflection: "I recognized that my thoughts are running worst-case scenarios. Realistically, I am prepared and a few stumbles are normal."
  },
  {
    id: "entry-3",
    date: "May 21, 8:05 PM",
    timestamp: Date.now() - 86400000 * 3,
    mood: "Joyful",
    text: "Had dinner with the whole family. Laughed more than I have in months. These are the moments I want to hold on to. Grateful for their support.",
    tags: ["family", "connection", "gratitude"],
    sentiment: 91,
    privacy: "shared",
    multimodal: { text: 92, voice: 88, video: 94 },
    reflection: "Making intentional time for family dinners directly boosts my sense of connection and grounding."
  }
];

export const INITIAL_BADGES = [
  { id: "consistent", name: "Consistent Mind", desc: "Log mood for 3 consecutive days", active: true },
  { id: "thinker", name: "Deep Thinker", desc: "Save 3 CBT journal reflections", active: true },
  { id: "sync", name: "Sensor Sync", desc: "Pair your first wearable device", active: true },
  { id: "release", name: "Wind Releaser", desc: "Write and release an Unsent Letter", active: false },
  { id: "explorer", name: "Pattern Finder", desc: "Perform a search in the Memory Bank", active: false }
];

export const CLINICIAN_PATIENTS_DEMO = [
  {
    id: "P-0041",
    name: "Patient A (Demo User)",
    fullName: "Gurnoor Sandhu (Decrypted)",
    age: 26,
    streak: 12,
    baselineWellness: 74,
    status: "stable",
    biometrics: { hrv: "48ms", sleep: "6.8 hrs", steps: "7,800 avg" },
    flags: [],
    sessionNotes: [
      { date: "May 18, 2026", text: "Discussed social performance anxiety. Practiced breathing grounding exercises. Patient is responsive." }
    ]
  },
  {
    id: "P-0039",
    name: "Patient B (Anonymized)",
    fullName: "Patient B (PII Masked)",
    age: 34,
    streak: 3,
    baselineWellness: 31,
    status: "danger",
    biometrics: { hrv: "30ms", sleep: "5.1 hrs", steps: "3,200 avg" },
    flags: ["Prolonged low mood (6 days)", "Sleep dip > 18%"],
    sessionNotes: [
      { date: "May 12, 2026", text: "Expressed sleep onset issues. Recommended sleep hygiene worksheet. Flagged for review." }
    ]
  },
  {
    id: "P-0052",
    name: "Patient C (Anonymized)",
    fullName: "Patient C (PII Masked)",
    age: 41,
    streak: 8,
    baselineWellness: 58,
    status: "monitor",
    biometrics: { hrv: "42ms", sleep: "6.2 hrs", steps: "5,400 avg" },
    flags: ["Increasing tired tags"],
    sessionNotes: []
  }
];

export const AI_SUGGESTED_PROMPTS = [
  "Help me reflect on my day",
  "I've been feeling stressed lately",
  "Help me reframe an anxious thought",
  "Give me a short 2-minute mindfulness exercise"
];

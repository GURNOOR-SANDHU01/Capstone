import { INITIAL_JOURNAL_ENTRIES, MOOD_DEFINITIONS } from "../data/mockData";

const STORAGE_KEY = "sentimed_journal_entries";

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

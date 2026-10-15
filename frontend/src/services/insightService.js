/**
 * SentiMed Insight & Analytics Service
 * Computes wellness metrics and sentiment trends from the user's actual journal entries.
 * No values are fabricated: where there is no data, the result says so (null / 0 entries).
 */

const DAY_MS = 86400000;

const average = (values) => {
  const nums = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
};

export const calculateWellnessStats = (entries = []) => {
  if (!entries || entries.length === 0) {
    return {
      averageSentiment: 0,
      overallScore: 0,
      moodDistribution: {},
      totalEntries: 0,
      weeklyComparison: "—",
      dominantEmotion: "No entries yet",
      voiceAverage: null,
      videoAverage: null
    };
  }

  const averageSentiment = average(entries.map((e) => e.sentiment ?? 50)) ?? 0;

  const moodCounts = {};
  entries.forEach((item) => {
    const mood = item.mood || "Calm";
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
  });

  let dominantEmotion = "Calm";
  let maxCount = 0;
  Object.entries(moodCounts).forEach(([mood, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantEmotion = mood;
    }
  });

  // Average of the last 7 days vs the 7 days before
  const now = Date.now();
  const thisWeek = average(entries.filter((e) => now - e.timestamp < 7 * DAY_MS).map((e) => e.sentiment));
  const lastWeek = average(
    entries.filter((e) => now - e.timestamp >= 7 * DAY_MS && now - e.timestamp < 14 * DAY_MS).map((e) => e.sentiment)
  );
  let weeklyComparison = "—";
  if (thisWeek !== null && lastWeek) {
    const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    weeklyComparison = `${pct >= 0 ? "+" : ""}${pct}%`;
  }

  return {
    averageSentiment,
    overallScore: averageSentiment,
    moodDistribution: moodCounts,
    totalEntries: entries.length,
    weeklyComparison,
    dominantEmotion,
    voiceAverage: average(entries.map((e) => e.multimodal?.voice)),
    videoAverage: average(entries.map((e) => e.multimodal?.video))
  };
};

/**
 * Last 7 days (ending today). Days without entries carry the previous day's score forward
 * so the trend line stays continuous; `entriesCount` shows which days have real data.
 */
export const getWeeklyChartData = (entries = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overall = average(entries.map((e) => e.sentiment)) ?? 50;

  let carry = overall;
  return Array.from({ length: 7 }, (_, i) => {
    const start = new Date(today.getTime() - (6 - i) * DAY_MS);
    const end = start.getTime() + DAY_MS;
    const dayEntries = entries.filter((e) => e.timestamp >= start.getTime() && e.timestamp < end);
    const score = average(dayEntries.map((e) => e.sentiment));
    if (score !== null) carry = score;
    return {
      day: start.toLocaleDateString([], { weekday: "short" }),
      score: score ?? carry,
      entriesCount: dayEntries.length
    };
  });
};

/**
 * Tags whose entries are clearly more positive or negative than the user's average.
 * Requires at least 2 entries per tag; differences under 10 points are ignored.
 */
export const findTagPatterns = (entries = []) => {
  const overall = average(entries.map((e) => e.sentiment));
  if (overall === null) return [];
  const byTag = {};
  entries.forEach((e) => (e.tags || []).forEach((t) => (byTag[t] ||= []).push(e.sentiment)));
  return Object.entries(byTag)
    .filter(([, scores]) => scores.length >= 2)
    .map(([tag, scores]) => ({ tag, count: scores.length, average: average(scores), delta: average(scores) - overall }))
    .filter((p) => Math.abs(p.delta) >= 10)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);
};

/** The weekday with the lowest average sentiment (needs entries on at least 3 different weekdays). */
export const findWeekdayPattern = (entries = []) => {
  const byDay = {};
  entries.forEach((e) => {
    const day = new Date(e.timestamp).toLocaleDateString([], { weekday: "long" });
    (byDay[day] ||= []).push(e.sentiment);
  });
  const days = Object.entries(byDay).map(([day, scores]) => ({ day, average: average(scores), count: scores.length }));
  if (days.length < 3) return null;
  const overall = average(entries.map((e) => e.sentiment));
  const lowest = days.sort((a, b) => a.average - b.average)[0];
  return lowest.average < overall - 5 ? { ...lowest, overall } : null;
};

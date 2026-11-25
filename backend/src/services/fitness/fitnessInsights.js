/**
 * Fitness analysis: pure functions over daily metrics (+ optional daily mood), no I/O.
 *
 *   analyze({ days, mood, today, periodDays }) -> { trends, streaks, mood_links, alerts, insights }
 *
 * days : [{ date:'YYYY-MM-DD', steps, active_minutes, calories, heart_rate_avg, sleep_minutes }]
 *        (may cover more than the period; the previous period is used for comparisons)
 * mood : { 'YYYY-MM-DD': 0..100 }  daily mood score from journal entries (optional)
 *
 * Statistics are deliberately conservative: comparisons need a minimum number of days with
 * data, and mood links are reported only with enough paired days. Links are associations,
 * never causes; the wording says so.
 */

const DAY_MS = 86400000;
const STEP_GOAL = 7000;
const SLEEP_GOAL_MIN = 420; // 7 h
const SHORT_SLEEP_MIN = 300; // 5 h
const LOW_STEPS = 1500;
const MIN_DAYS_FOR_AVG = 3;
const MIN_PAIRS_FOR_LINK = 6;
const MIN_PER_GROUP = 3;

const METRICS = {
  steps: { label: 'steps', unit: '', higherIsBetter: true },
  sleep_minutes: { label: 'sleep', unit: 'min', higherIsBetter: true },
  active_minutes: { label: 'active minutes', unit: 'min', higherIsBetter: true },
  heart_rate_avg: { label: 'average heart rate', unit: 'bpm', higherIsBetter: null },
  calories: { label: 'calories', unit: 'kcal', higherIsBetter: null }
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
// steps = 0 usually means "phone not carried", not a real zero: treat as no data
const valueOf = (day, key) => (isNum(day?.[key]) && !(key === 'steps' && day[key] === 0) ? day[key] : null);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (v, d = 0) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
const shiftDate = (iso, deltaDays) => new Date(Date.parse(`${iso}T00:00:00Z`) + deltaDays * DAY_MS).toISOString().slice(0, 10);
const fmtHours = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;
const fmtValue = (key, v) =>
  key === 'sleep_minutes' ? fmtHours(v) : key === 'steps' || key === 'calories' ? Math.round(v).toLocaleString('en-US') : `${Math.round(v)}${METRICS[key].unit ? ` ${METRICS[key].unit}` : ''}`;

function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) out.push(d);
  return out;
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

const strength = (r) => {
  const a = Math.abs(r);
  return a < 0.2 ? 'none' : a < 0.4 ? 'weak' : a < 0.6 ? 'moderate' : 'strong';
};

/* ------------------------------------------------------------------ trends */
function computeTrends(byDate, current, previous) {
  const trends = {};
  for (const key of Object.keys(METRICS)) {
    const cur = current.map((d) => valueOf(byDate[d], key)).filter(isNum);
    const prev = previous.map((d) => valueOf(byDate[d], key)).filter(isNum);
    const curAvg = cur.length >= MIN_DAYS_FOR_AVG ? avg(cur) : null;
    const prevAvg = prev.length >= MIN_DAYS_FOR_AVG ? avg(prev) : null;
    const change = curAvg !== null && prevAvg ? (curAvg - prevAvg) / prevAvg : null;

    let best = null;
    let worst = null;
    for (const d of current) {
      const v = valueOf(byDate[d], key);
      if (!isNum(v)) continue;
      if (!best || v > best.value) best = { date: d, value: v };
      if (!worst || v < worst.value) worst = { date: d, value: v };
    }
    trends[key] = {
      avg: round(curAvg),
      previous_avg: round(prevAvg),
      change_pct: change === null ? null : round(change * 100),
      days_with_data: cur.length,
      best,
      worst
    };
  }
  return trends;
}

/* ----------------------------------------------------------------- streaks */
function streak(byDate, dates, key, test) {
  // current = consecutive qualifying days ending at the most recent day WITH data
  let current = 0;
  let longest = 0;
  let run = 0;
  for (const d of dates) {
    const v = valueOf(byDate[d], key);
    if (!isNum(v)) continue; // missing days don't break or extend a streak
    run = test(v) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  for (let i = dates.length - 1; i >= 0; i -= 1) {
    const v = valueOf(byDate[dates[i]], key);
    if (!isNum(v)) continue;
    if (!test(v)) break;
    current += 1;
  }
  return { current, longest };
}

function computeStreaks(byDate, current) {
  return {
    step_goal: { goal: STEP_GOAL, ...streak(byDate, current, 'steps', (v) => v >= STEP_GOAL) },
    sleep_goal: { goal_minutes: SLEEP_GOAL_MIN, ...streak(byDate, current, 'sleep_minutes', (v) => v >= SLEEP_GOAL_MIN) }
  };
}

/* -------------------------------------------------------------- mood links */
function computeMoodLinks(byDate, current, mood) {
  if (!mood) return { available: false, reason: 'no_mood_data', links: [] };
  const moodDays = current.filter((d) => isNum(mood[d])).length;
  if (moodDays < MIN_PAIRS_FOR_LINK) {
    return { available: false, reason: 'not_enough_journal_days', mood_days: moodDays, links: [] };
  }
  const links = [];
  for (const key of ['sleep_minutes', 'steps', 'active_minutes']) {
    const pairs = current
      .map((d) => [valueOf(byDate[d], key), mood[d]])
      .filter(([v, m]) => isNum(v) && isNum(m));
    if (pairs.length < MIN_PAIRS_FOR_LINK) continue;
    const xs = pairs.map((p) => p[0]);
    const ys = pairs.map((p) => p[1]);
    const r = pearson(xs, ys);

    // Group split: a meaningful fixed cut for sleep, the median otherwise
    const sorted = [...xs].sort((a, b) => a - b);
    const cut = key === 'sleep_minutes' ? SLEEP_GOAL_MIN : sorted[Math.floor(sorted.length / 2)];
    const high = pairs.filter(([v]) => v >= cut).map((p) => p[1]);
    const low = pairs.filter(([v]) => v < cut).map((p) => p[1]);
    const groups =
      high.length >= MIN_PER_GROUP && low.length >= MIN_PER_GROUP
        ? { cut: round(cut), high_mood: round(avg(high)), low_mood: round(avg(low)), high_days: high.length, low_days: low.length }
        : null;

    links.push({ metric: key, r: round(r, 2), strength: strength(r), direction: r >= 0 ? 'positive' : 'negative', paired_days: pairs.length, groups });
  }
  return { available: links.length > 0, mood_days: moodDays, links };
}

/* ------------------------------------------------------------------ alerts */
function computeAlerts(byDate, today, mood) {
  const alerts = [];
  const lastN = (n, end = today) => dateRange(shiftDate(end, -(n - 1)), end);
  const recentMood = avg(lastN(7).map((d) => mood?.[d]).filter(isNum));
  const lowMood = recentMood !== null && recentMood < 35;

  // 1. Consecutive short nights (most recent nights with data)
  const sleepDates = lastN(14);
  let shortRun = 0;
  for (let i = sleepDates.length - 1; i >= 0; i -= 1) {
    const v = valueOf(byDate[sleepDates[i]], 'sleep_minutes');
    if (!isNum(v)) continue;
    if (v < SHORT_SLEEP_MIN) shortRun += 1;
    else break;
  }
  if (shortRun >= 3) {
    alerts.push({
      type: 'short_sleep_streak',
      severity: shortRun >= 5 || lowMood ? 'moderate' : 'low',
      message: `${shortRun} nights in a row with under 5 hours of sleep.`,
      value: shortRun
    });
  }

  // 2. Week-over-week activity drop
  const thisWeek = lastN(7).map((d) => valueOf(byDate[d], 'steps')).filter(isNum);
  const lastWeek = lastN(7, shiftDate(today, -7)).map((d) => valueOf(byDate[d], 'steps')).filter(isNum);
  if (thisWeek.length >= 4 && lastWeek.length >= 4) {
    const a = avg(thisWeek);
    const b = avg(lastWeek);
    if (b >= 3000 && a <= b * 0.5) {
      alerts.push({
        type: 'activity_drop',
        severity: lowMood ? 'moderate' : 'low',
        message: `Daily steps fell ${Math.round((1 - a / b) * 100)}% compared with the previous week (${Math.round(b).toLocaleString('en-US')} to ${Math.round(a).toLocaleString('en-US')}).`,
        value: round(((a - b) / b) * 100)
      });
    }
  }

  // 3. Several very inactive days in a row
  let lowRun = 0;
  const actDates = lastN(14);
  for (let i = actDates.length - 1; i >= 0; i -= 1) {
    const v = valueOf(byDate[actDates[i]], 'steps');
    if (!isNum(v)) continue;
    if (v < LOW_STEPS) lowRun += 1;
    else break;
  }
  if (lowRun >= 5) {
    alerts.push({ type: 'low_activity_streak', severity: lowMood ? 'moderate' : 'low', message: `${lowRun} days in a row with fewer than ${LOW_STEPS.toLocaleString('en-US')} steps.`, value: lowRun });
  }

  // 4. Heart rate above the person's own baseline
  const hrRecent = lastN(7).map((d) => valueOf(byDate[d], 'heart_rate_avg')).filter(isNum);
  const hrBase = lastN(21, shiftDate(today, -7)).map((d) => valueOf(byDate[d], 'heart_rate_avg')).filter(isNum);
  if (hrRecent.length >= 4 && hrBase.length >= 7) {
    const diff = avg(hrRecent) - avg(hrBase);
    if (diff >= 10) {
      alerts.push({ type: 'elevated_heart_rate', severity: 'low', message: `Average heart rate is ${Math.round(diff)} bpm above your usual level this week.`, value: round(diff) });
    }
  }

  if (lowMood && alerts.length) {
    alerts.forEach((a) => {
      a.with_low_mood = true;
    });
  }
  return { alerts, recent_mood: round(recentMood) };
}

/* ---------------------------------------------------------------- insights */
function buildInsights({ trends, streaks, moodLinks, alerts, periodDays }) {
  const out = [];
  for (const a of alerts) {
    out.push({ kind: 'alert', severity: a.severity, text: a.message + (a.with_low_mood ? ' Your recent journal mood has also been low.' : '') });
  }

  const names = { sleep_minutes: 'you slept 7 hours or more', steps: 'you were more active', active_minutes: 'you had more active minutes' };
  for (const l of moodLinks.links || []) {
    if (l.strength === 'none' || !l.groups) continue;
    const diff = l.groups.high_mood - l.groups.low_mood;
    if (Math.abs(diff) < 5) continue;
    out.push({
      kind: 'mood_link',
      metric: l.metric,
      text: `On days ${names[l.metric]}, your journal mood was ${Math.abs(Math.round(diff))} points ${diff > 0 ? 'higher' : 'lower'} (${l.groups.high_mood} vs ${l.groups.low_mood} out of 100, ${l.paired_days} days). This is a pattern, not proof of cause.`
    });
  }

  for (const key of ['steps', 'sleep_minutes', 'active_minutes']) {
    const t = trends[key];
    if (t.change_pct === null || Math.abs(t.change_pct) < 10) continue;
    out.push({
      kind: 'trend',
      metric: key,
      text: `Your average ${METRICS[key].label} ${t.change_pct > 0 ? 'rose' : 'fell'} ${Math.abs(t.change_pct)}% vs the previous ${periodDays} days (${fmtValue(key, t.previous_avg)} to ${fmtValue(key, t.avg)}).`
    });
  }

  if (streaks.step_goal.current >= 3) out.push({ kind: 'streak', text: `${streaks.step_goal.current}-day streak of ${STEP_GOAL.toLocaleString('en-US')}+ steps. Keep it going!` });
  if (streaks.sleep_goal.current >= 3) out.push({ kind: 'streak', text: `${streaks.sleep_goal.current} nights in a row with 7+ hours of sleep.` });

  const bestSteps = trends.steps.best;
  if (bestSteps) out.push({ kind: 'highlight', text: `Most active day: ${bestSteps.date} with ${fmtValue('steps', bestSteps.value)} steps.` });

  if (!out.length) out.push({ kind: 'info', text: 'Not enough data yet for insights. Keep your phone with you and sync again in a few days.' });
  return out.slice(0, 8);
}

function analyze({ days = [], mood = null, today, periodDays = 14 }) {
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const end = today || new Date().toISOString().slice(0, 10);
  const current = dateRange(shiftDate(end, -(periodDays - 1)), end);
  const previous = dateRange(shiftDate(end, -(2 * periodDays - 1)), shiftDate(end, -periodDays));

  const trends = computeTrends(byDate, current, previous);
  const streaks = computeStreaks(byDate, current);
  const moodLinks = computeMoodLinks(byDate, current, mood);
  const { alerts, recent_mood } = computeAlerts(byDate, end, mood);
  const coverage = current.filter((d) => Object.keys(METRICS).some((k) => isNum(valueOf(byDate[d], k)))).length;

  return {
    period: { from: current[0], to: end, days: periodDays, days_with_data: coverage },
    trends,
    streaks,
    mood_links: moodLinks,
    recent_mood,
    alerts,
    insights: buildInsights({ trends, streaks, moodLinks, alerts, periodDays })
  };
}

/* ----------------------------------------------------------- journal mood */
// Self-reported UI moods are the user's own truth and win over the model's guess
const SELF_REPORT_SCORE = { Joyful: 90, Calm: 70, Tired: 40, Anxious: 25, Sad: 20, Angry: 20 };

/** Journal entries -> { date: 0..100 } (daily average). */
function moodByDate(entries) {
  const acc = {};
  for (const e of entries) {
    const date = e.entry_date;
    if (!date) continue;
    const de = e.detected_emotions || {};
    let score = SELF_REPORT_SCORE[de.corrected_emotion];
    if (score === undefined && isNum(de.sentiment_score)) score = ((Math.max(-1, Math.min(1, de.sentiment_score)) + 1) / 2) * 100;
    if (score === undefined) continue;
    (acc[date] = acc[date] || []).push(score);
  }
  return Object.fromEntries(Object.entries(acc).map(([d, xs]) => [d, round(avg(xs))]));
}

module.exports = { analyze, moodByDate, pearson, shiftDate, STEP_GOAL, SLEEP_GOAL_MIN };

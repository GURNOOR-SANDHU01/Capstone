import { useState, useEffect, useRef } from "react";

const MOODS = [
  { label: "Joyful", emoji: "😄", color: "#F5A623", bg: "#FFF8EC" },
  { label: "Calm", emoji: "😌", color: "#4CAF91", bg: "#EAF7F2" },
  { label: "Anxious", emoji: "😰", color: "#5C8DD6", bg: "#EAF1FB" },
  { label: "Sad", emoji: "😢", color: "#9B6DD6", bg: "#F4EEF9" },
  { label: "Angry", emoji: "😤", color: "#E05C5C", bg: "#FBF0F0" },
  { label: "Tired", emoji: "😴", color: "#8A9BB0", bg: "#F2F4F6" },
];

const JOURNAL_ENTRIES = [
  {
    id: 1, date: "Today, 9:41 AM", mood: "Calm", moodEmoji: "😌",
    preview: "Woke up feeling surprisingly clear-headed despite the rough week. Did a short walk and noticed how the morning light...",
    tags: ["morning", "nature"], sentiment: 72,
  },
  {
    id: 2, date: "Yesterday, 11:20 PM", mood: "Anxious", moodEmoji: "😰",
    preview: "Can't stop thinking about the presentation. My chest feels tight. I keep running the worst-case scenarios in my head...",
    tags: ["work", "stress"], sentiment: 28,
  },
  {
    id: 3, date: "May 21, 8:05 PM", mood: "Joyful", moodEmoji: "😄",
    preview: "Had dinner with the whole family. Laughed more than I have in months. These are the moments I want to hold on to...",
    tags: ["family", "connection"], sentiment: 91,
  },
];

const INSIGHTS = [
  { label: "7-Day Avg Mood", value: "68%", icon: "📈", sub: "+4% from last week" },
  { label: "Streak", value: "12 days", icon: "🔥", sub: "Personal best!" },
  { label: "Dominant Emotion", value: "Calm", icon: "🌊", sub: "Past 7 days" },
  { label: "Check-ins", value: "26", icon: "📓", sub: "This month" },
];

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "journal", label: "Journal", icon: "📓" },
  { id: "insights", label: "Insights", icon: "📊" },
  { id: "companion", label: "Companion", icon: "🤖" },
  { id: "clinician", label: "Clinician", icon: "🩺" },
];

const CHART_DATA = [
  { day: "Mo", score: 55 }, { day: "Tu", score: 40 }, { day: "We", score: 62 },
  { day: "Th", score: 48 }, { day: "Fr", score: 70 }, { day: "Sa", score: 78 }, { day: "Su", score: 68 },
];

const COMPANION_MSGS = [
  { from: "ai", text: "Hi Gurnoor 👋 How are you feeling right now? Take a moment — no rush." },
  { from: "user", text: "A bit anxious actually. Have a big deadline tomorrow." },
  { from: "ai", text: "I hear you. Deadlines can feel like a weight. What part feels most overwhelming — the task itself, or the uncertainty around it?" },
];

function MoodRing({ score }) {
  const r = 42, c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = score > 65 ? "#4CAF91" : score > 40 ? "#F5A623" : "#E05C5C";
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#F0F0F0" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 55 55)" style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x="55" y="52" textAnchor="middle" style={{ fontSize: 22, fontWeight: 600, fill: color }}>{score}</text>
      <text x="55" y="68" textAnchor="middle" style={{ fontSize: 10, fill: "#999" }}>Wellness</text>
    </svg>
  );
}

function MoodChart() {
  const max = Math.max(...CHART_DATA.map(d => d.score));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, padding: "0 4px" }}>
      {CHART_DATA.map((d, i) => {
        const h = (d.score / max) * 68;
        const isToday = i === CHART_DATA.length - 1;
        const color = d.score > 65 ? "#4CAF91" : d.score > 45 ? "#F5A623" : "#E05C5C";
        return (
          <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", height: h, background: isToday ? color : color + "60",
              borderRadius: 4, transition: "height 0.6s ease" + i * 0.05 + "s" }} />
            <span style={{ fontSize: 10, color: isToday ? "#222" : "#999", fontWeight: isToday ? 600 : 400 }}>{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

function Tag({ label }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#F0F0F0", color: "#666" }}>
      #{label}
    </span>
  );
}

function SentimentBar({ value }) {
  const color = value > 65 ? "#4CAF91" : value > 40 ? "#F5A623" : "#E05C5C";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "#F0F0F0", borderRadius: 4 }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600, minWidth: 28 }}>{value}%</span>
    </div>
  );
}

export default function Sentimed() {
  const [tab, setTab] = useState("home");
  const [selectedMood, setSelectedMood] = useState(null);
  const [journalText, setJournalText] = useState("");
  const [recording, setRecording] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMsgs, setChatMsgs] = useState(COMPANION_MSGS);
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, typing]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMsgs(prev => [...prev, { from: "user", text: userMsg }]);
    setTyping(true);
    try {
      const history = [...chatMsgs, { from: "user", text: userMsg }];
      const messages = history.map(m => ({
        role: m.from === "user" ? "user" : "assistant",
        content: m.text,
      }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "You are Sentimed's AI Companion — an empathetic, warm mental wellness assistant. You help users reflect on their emotions using CBT-aligned prompts. Keep responses concise (2-3 sentences max), warm, and never prescriptive. Never diagnose or replace professional care. Use reflective questions to help users explore their feelings.",
          messages,
        }),
      });
      const data = await res.json();
      const reply = data.content?.map(b => b.text || "").join("") || "I'm here with you. Take a breath.";
      setTyping(false);
      setChatMsgs(prev => [...prev, { from: "ai", text: reply }]);
    } catch {
      setTyping(false);
      setChatMsgs(prev => [...prev, { from: "ai", text: "I'm here with you. Take a breath and try again." }]);
    }
  };

  const styles = {
    shell: {
      fontFamily: "'Instrument Sans', 'Georgia', sans-serif",
      background: "#FAFAF8",
      minHeight: "100vh",
      maxWidth: 420,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      position: "relative",
    },
    header: {
      padding: "20px 20px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    logo: {
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: "-0.5px",
      color: "#1A1A2E",
    },
    logoAccent: { color: "#4CAF91" },
    avatar: {
      width: 36, height: 36, borderRadius: "50%",
      background: "linear-gradient(135deg,#4CAF91,#2E7D62)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 15, fontWeight: 600, color: "#fff",
    },
    content: { flex: 1, padding: "16px 20px 100px", overflowY: "auto" },
    card: {
      background: "#fff",
      borderRadius: 16,
      padding: "16px",
      marginBottom: 14,
      border: "1px solid #F0F0F0",
    },
    sectionTitle: { fontSize: 13, fontWeight: 600, color: "#999", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 12 },
    h2: { fontSize: 22, fontWeight: 700, color: "#1A1A2E", marginBottom: 4 },
    sub: { fontSize: 13, color: "#888", marginBottom: 16 },
    navBar: {
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 420,
      background: "#fff", borderTop: "1px solid #F0F0F0",
      display: "flex", justifyContent: "space-around", padding: "8px 0 16px",
      zIndex: 100,
    },
    navItem: (active) => ({
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "4px 12px", borderRadius: 10, cursor: "pointer",
      background: active ? "#EAF7F2" : "transparent",
      transition: "background 0.2s",
    }),
    navLabel: (active) => ({
      fontSize: 10, fontWeight: active ? 700 : 500,
      color: active ? "#4CAF91" : "#AAA",
    }),
    btn: {
      background: "#1A1A2E", color: "#fff",
      border: "none", borderRadius: 12, padding: "12px 24px",
      fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
      letterSpacing: "0.2px",
    },
    btnOutline: {
      background: "transparent", color: "#1A1A2E",
      border: "1.5px solid #1A1A2E", borderRadius: 12, padding: "11px 24px",
      fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
    },
    input: {
      width: "100%", border: "1.5px solid #E8E8E8", borderRadius: 12,
      padding: "12px 14px", fontSize: 14, outline: "none",
      background: "#FAFAF8", resize: "none", boxSizing: "border-box",
    },
  };

  return (
    <div style={styles.shell}>
      <div style={styles.header}>
        <div style={styles.logo}>Senti<span style={styles.logoAccent}>med</span></div>
        <div style={styles.avatar}>G</div>
      </div>

      <div style={styles.content}>

        {tab === "home" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={styles.h2}>Good morning, Gurnoor ✨</div>
              <div style={styles.sub}>How are you feeling today?</div>
            </div>

            <div style={styles.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={styles.sectionTitle}>Today's Wellness</div>
                  <div style={{ fontSize: 13, color: "#555", maxWidth: 170 }}>Based on your recent entries and patterns</div>
                </div>
                <MoodRing score={68} />
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>Quick Check-in</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {MOODS.map(m => (
                  <button key={m.label} onClick={() => setSelectedMood(m.label)}
                    style={{ background: selectedMood === m.label ? m.bg : "#F8F8F8",
                      border: selectedMood === m.label ? `2px solid ${m.color}` : "1.5px solid #EEE",
                      borderRadius: 12, padding: "8px 12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6, fontSize: 13,
                      color: selectedMood === m.label ? m.color : "#555",
                      fontWeight: selectedMood === m.label ? 600 : 400,
                      transition: "all 0.18s",
                    }}>
                    <span>{m.emoji}</span>{m.label}
                  </button>
                ))}
              </div>
              {selectedMood && (
                <div style={{ marginTop: 12, padding: 12, background: "#F5FBF8", borderRadius: 10, fontSize: 13, color: "#3D7A60" }}>
                  💬 Want to tell me more about feeling <strong>{selectedMood}</strong>? <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => setTab("journal")}>Start a journal entry →</span>
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>This Week's Mood</div>
              <MoodChart />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {INSIGHTS.map(ins => (
                <div key={ins.label} style={{ ...styles.card, marginBottom: 0, padding: 14 }}>
                  <div style={{ fontSize: 22 }}>{ins.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1A1A2E", margin: "6px 0 2px" }}>{ins.value}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{ins.label}</div>
                  <div style={{ fontSize: 11, color: "#4CAF91", fontWeight: 600, marginTop: 2 }}>{ins.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ ...styles.card, background: "linear-gradient(135deg,#1A1A2E,#2D4068)", border: "none" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>🤖 Companion is ready</div>
              <div style={{ fontSize: 13, color: "#8899CC", marginBottom: 14 }}>Your AI has noticed you've been stressed lately. Want to talk through it?</div>
              <button style={{ ...styles.btn, background: "#4CAF91", width: "auto", padding: "10px 20px" }}
                onClick={() => setTab("companion")}>Open Companion →</button>
            </div>
          </>
        )}

        {tab === "journal" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={styles.h2}>Journal 📓</div>
              <div style={styles.sub}>Your private space to reflect and express</div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>New Entry</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {["✍️ Text", "🎙️ Voice", "🎥 Video"].map((mode, i) => (
                  <button key={mode} onClick={() => i === 1 && setRecording(r => !r)}
                    style={{ flex: 1, padding: "8px 4px", borderRadius: 10, border: "1.5px solid #EEE",
                      background: (i === 1 && recording) ? "#FFF0F0" : "#FAFAFA",
                      color: (i === 1 && recording) ? "#E05C5C" : "#555",
                      fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                    {i === 1 && recording ? "⏹ Stop" : mode}
                  </button>
                ))}
              </div>
              {recording && (
                <div style={{ padding: 12, background: "#FFF0F0", borderRadius: 10, marginBottom: 12, fontSize: 13, color: "#E05C5C", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, background: "#E05C5C", borderRadius: "50%", display: "inline-block", animation: "pulse 1s infinite" }} />
                  Recording… speak naturally
                </div>
              )}
              <textarea value={journalText} onChange={e => setJournalText(e.target.value)}
                placeholder="What's on your mind today? There's no right or wrong way to begin..."
                rows={5} style={styles.input} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button style={{ ...styles.btn, flex: 1 }}>Save Entry</button>
                <button style={{ ...styles.btnOutline, flex: 1 }}>Add Mood Tag</button>
              </div>
            </div>

            <div style={styles.sectionTitle}>Recent Entries</div>
            {JOURNAL_ENTRIES.map(e => (
              <div key={e.id} style={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#AAA" }}>{e.date}</div>
                    <div style={{ fontSize: 15, marginTop: 2 }}>{e.moodEmoji} {e.mood}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#AAA", background: "#F5F5F5", padding: "4px 8px", borderRadius: 8 }}>View</div>
                </div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6, marginBottom: 10 }}>{e.preview}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {e.tags.map(t => <Tag key={t} label={t} />)}
                </div>
                <div style={{ fontSize: 11, color: "#AAA", marginBottom: 4 }}>Emotional tone</div>
                <SentimentBar value={e.sentiment} />
              </div>
            ))}
          </>
        )}

        {tab === "insights" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={styles.h2}>Insights 📊</div>
              <div style={styles.sub}>Patterns from your emotional journey</div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>30-Day Emotion Distribution</div>
              {MOODS.map(m => {
                const pct = m.label === "Calm" ? 45 : m.label === "Joyful" ? 28 : m.label === "Anxious" ? 17 : m.label === "Sad" ? 10 : m.label === "Angry" ? 5 : 15;
                return (
                  <div key={m.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{m.emoji} {m.label}</span>
                      <span style={{ fontSize: 12, color: "#888" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "#F0F0F0", borderRadius: 4 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: m.color, borderRadius: 4, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>Wearable Data</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Avg Heart Rate", value: "72 bpm", icon: "❤️", trend: "Stable" },
                  { label: "Sleep Last Night", value: "6.8 hrs", icon: "🌙", trend: "-0.4 from avg" },
                  { label: "Steps Today", value: "4,210", icon: "👟", trend: "Below goal" },
                  { label: "HRV", value: "48 ms", icon: "📡", trend: "+2 ms" },
                ].map(d => (
                  <div key={d.label} style={{ padding: 12, background: "#F8F8F8", borderRadius: 12 }}>
                    <div style={{ fontSize: 20 }}>{d.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E", margin: "6px 0 2px" }}>{d.value}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{d.label}</div>
                    <div style={{ fontSize: 11, color: "#4CAF91", marginTop: 2 }}>{d.trend}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>Predictive Forecast</div>
              <div style={{ padding: 14, background: "#FFF8EC", borderRadius: 12, border: "1px solid #F5A623" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#B8690A", marginBottom: 4 }}>⚠️ Mild stress trend detected</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>Based on your sleep patterns and journal entries over the past 5 days, you may experience heightened anxiety mid-week. Consider scheduling a short journaling session on Tuesday.</div>
              </div>
            </div>

            <div style={styles.card}>
              <div style={styles.sectionTitle}>Memory Bank Search</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input placeholder='Try "when was I last truly happy?"' style={{ ...styles.input, flex: 1 }} />
                <button style={{ ...styles.btn, width: "auto", padding: "0 16px", borderRadius: 12 }}>→</button>
              </div>
            </div>
          </>
        )}

        {tab === "companion" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={styles.h2}>Companion 🤖</div>
              <div style={styles.sub}>Your empathetic AI — always here to listen</div>
            </div>

            <div style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "#1A1A2E", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#4CAF91", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Sentimed Companion</div>
                  <div style={{ fontSize: 11, color: "#4CAF91" }}>● Online · CBT-aligned · Private</div>
                </div>
              </div>

              <div style={{ height: 360, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {chatMsgs.map((msg, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: msg.from === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "78%", padding: "10px 14px", borderRadius: msg.from === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                      background: msg.from === "user" ? "#1A1A2E" : "#F4F4F4",
                      color: msg.from === "user" ? "#fff" : "#333",
                      fontSize: 13, lineHeight: 1.6,
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {typing && (
                  <div style={{ display: "flex" }}>
                    <div style={{ background: "#F4F4F4", borderRadius: "4px 16px 16px 16px", padding: "12px 16px" }}>
                      <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{ width: 6, height: 6, background: "#AAA", borderRadius: "50%",
                            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div style={{ padding: 12, borderTop: "1px solid #F0F0F0", display: "flex", gap: 8 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="Share what's on your mind..."
                  style={{ ...styles.input, flex: 1 }} />
                <button onClick={sendChat}
                  style={{ ...styles.btn, width: "auto", padding: "0 16px", borderRadius: 12, flexShrink: 0 }}>→</button>
              </div>
            </div>

            <div style={{ ...styles.card, background: "#FFF8EC", border: "1px solid #F5A623" }}>
              <div style={{ fontSize: 12, color: "#B8690A", fontWeight: 600, marginBottom: 4 }}>⚕️ Reminder</div>
              <div style={{ fontSize: 12, color: "#666" }}>This companion supports self-reflection only. If you're in distress, please reach out to a mental health professional or crisis line.</div>
            </div>
          </>
        )}

        {tab === "clinician" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={styles.h2}>Clinician Portal 🩺</div>
              <div style={styles.sub}>Anonymized patient trend overview</div>
            </div>

            <div style={{ ...styles.card, background: "#F0FDF4", border: "1px solid #4CAF91" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2E7D62", marginBottom: 4 }}>🔐 Secure access enabled</div>
              <div style={{ fontSize: 12, color: "#555" }}>Viewing with patient consent. Data is anonymized per privacy framework (MS Presidio).</div>
            </div>

            <div style={styles.sectionTitle}>Patients at a Glance</div>
            {[
              { id: "P-0041", label: "Patient A", streak: 14, avgMood: 72, flag: null },
              { id: "P-0039", label: "Patient B", streak: 3, avgMood: 31, flag: "red" },
              { id: "P-0052", label: "Patient C", streak: 8, avgMood: 58, flag: "amber" },
            ].map(p => (
              <div key={p.id} style={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A2E" }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: "#AAA" }}>{p.id} · {p.streak}-day streak</div>
                  </div>
                  {p.flag === "red" && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "#FBF0F0", color: "#E05C5C", fontWeight: 600 }}>🔴 Red Zone</span>}
                  {p.flag === "amber" && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "#FFF8EC", color: "#B8690A", fontWeight: 600 }}>🟡 Monitor</span>}
                  {!p.flag && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "#F0FDF4", color: "#2E7D62", fontWeight: 600 }}>🟢 Stable</span>}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#AAA", marginBottom: 4 }}>7-Day Mood Avg: {p.avgMood}%</div>
                  <SentimentBar value={p.avgMood} />
                </div>
              </div>
            ))}

            <div style={styles.card}>
              <div style={styles.sectionTitle}>Alerts</div>
              <div style={{ padding: 12, background: "#FBF0F0", borderRadius: 10, border: "1px solid #F0CBCB", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#E05C5C" }}>🔴 Patient B — Red Zone triggered</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Prolonged low mood detected for 6 consecutive days. Recommend immediate outreach.</div>
                <button style={{ ...styles.btn, marginTop: 10, background: "#E05C5C", width: "auto", padding: "8px 16px" }}>Review & Contact</button>
              </div>
            </div>
          </>
        )}
      </div>

      <nav style={styles.navBar}>
        {NAV_ITEMS.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)}
            style={{ ...styles.navItem(tab === n.id), border: "none", background: tab === n.id ? "#EAF7F2" : "transparent", cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span style={styles.navLabel(tab === n.id)}>{n.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        * { box-sizing: border-box; }
        textarea:focus, input:focus { border-color: #4CAF91 !important; outline: none; }
        button:active { transform: scale(0.97); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #E8E8E8; border-radius: 4px; }
      `}</style>
    </div>
  );
}

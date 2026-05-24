import { useState, useEffect, useRef, useCallback } from "react";

// Default initial data
const INITIAL_ENTRIES = [
  {
    id: 1,
    date: "Today, 9:41 AM",
    mood: "Calm",
    moodEmoji: "😌",
    text: "Woke up feeling surprisingly clear-headed despite the rough week. Did a short walk and noticed how the morning light filtered through the trees. It helped quiet my thoughts.",
    tags: ["morning", "nature"],
    sentiment: 72,
    multimodal: { text: 72, voice: 68, video: 75 },
    reflection: "Focusing on physical sensations in the morning helped prevent my mind from racing about the day's to-do list."
  },
  {
    id: 2,
    date: "Yesterday, 11:20 PM",
    mood: "Anxious",
    moodEmoji: "😰",
    text: "Can't stop thinking about the clinician presentation tomorrow. My chest feels tight. I keep running the worst-case scenarios in my head, worrying I will stumble over my words.",
    tags: ["work", "stress"],
    sentiment: 28,
    multimodal: { text: 25, voice: 30, video: 30 },
    reflection: "I recognized that my thoughts are running worst-case scenarios. Realistically, I am prepared and a few stumbles are normal."
  },
  {
    id: 3,
    date: "May 21, 8:05 PM",
    mood: "Joyful",
    moodEmoji: "😄",
    text: "Had dinner with the whole family. Laughed more than I have in months. These are the moments I want to hold on to. Grateful for their support.",
    tags: ["family", "connection"],
    sentiment: 91,
    multimodal: { text: 92, voice: 88, video: 94 },
    reflection: "Making intentional time for family dinners directly boosts my sense of connection and grounding."
  }
];

const INITIAL_BADGES = [
  { id: "consistent", name: "Consistent Mind", icon: "🔥", desc: "Log mood for 3 consecutive days", active: true },
  { id: "thinker", name: "Deep Thinker", icon: "📝", desc: "Save 3 CBT journal reflections", active: true },
  { id: "sync", name: "Sensor Sync", icon: "⌚", desc: "Pair your first wearable device", active: true },
  { id: "release", name: "Wind Releaser", icon: "🍃", desc: "Write and release an Unsent Letter", active: false },
  { id: "explorer", name: "Pattern Finder", icon: "🧭", desc: "Perform a search in the Memory Bank", active: false }
];

const MOOD_DATA = [
  { label: "Joyful", emoji: "😄", color: "#F5A623", bg: "#FFF8EC", cbt: "Celebrate this moment! What specific action or environment triggered this positive feeling? How can you cultivate more of this?" },
  { label: "Calm", emoji: "😌", color: "#4CAF91", bg: "#EAF7F2", cbt: "A quiet mind is a strength. What details in your environment are helping you feel steady right now?" },
  { label: "Anxious", emoji: "😰", color: "#5C8DD6", bg: "#EAF1FB", cbt: "Notice where anxiety lives in your body (tight chest, rapid breathing). Can you state the absolute worst-case scenario and evaluate its realistic probability?" },
  { label: "Sad", emoji: "😢", color: "#9B6DD6", bg: "#F4EEF9", cbt: "It is okay to feel heavy. Treat yourself with compassion right now. What is one small, low-energy thing you can do for yourself today?" },
  { label: "Angry", emoji: "😤", color: "#E05C5C", bg: "#FBF0F0", cbt: "Anger is information about boundaries. Pause for 3 slow breaths. What boundary of yours felt threatened or ignored?" },
  { label: "Tired", emoji: "😴", color: "#8A9BB0", bg: "#F2F4F6", cbt: "Your body is asking for recovery. Is this physical exhaustion, or emotional burnout? What is the smallest restful action you can take?" }
];

export default function PatientPortal({
  entries,
  setEntries,
  onNotification,
  wearableConnected,
  setWearableConnected,
  currentUser
}) {
  const [onboarded, setOnboarded] = useState(() => {
    return localStorage.getItem("sentimed_onboarded") === "true";
  });
  const [onboardStep, setOnboardStep] = useState(1);
  const [goals, setGoals] = useState({
    anxiety: false,
    sleep: false,
    trends: false,
    resilience: false
  });
  const [consentCollection, setConsentCollection] = useState(true);
  const [piiMasking, setPiiMasking] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState("fitbit");
  const [pairingState, setPairingState] = useState("idle"); // idle, pairing, paired
  
  // Sidebar tabs navigation
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, journal, insights, companion, badges, memory, settings, crisis
  
  // Journaling state
  const [journalMode, setJournalMode] = useState("text"); // text, voice, video
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [entryText, setEntryText] = useState("");
  const [selectedMood, setSelectedMood] = useState("Calm");
  const [entryTags, setEntryTags] = useState([]);
  
  // Post-entry Analysis Modal
  const [analysisEntry, setAnalysisEntry] = useState(null);
  const [cbtReflection, setCbtReflection] = useState("");

  // Memory Bank State
  const [searchQuery, setSearchQuery] = useState("");

  // Companion Chat State
  const [chatMsgs, setChatMsgs] = useState(() => [
    { from: "ai", text: `Hi ${currentUser?.profile?.name ? currentUser.profile.name.split(" ")[0] : "there"}. I'm your SentiMed Companion. I'm here to support you with CBT-guided reflection. What's on your mind today?` }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [letterText, setLetterText] = useState("");
  const [isDissolving, setIsDissolving] = useState(false);
  const [letterStatus, setLetterStatus] = useState("");

  // Gamification
  const [badges, setBadges] = useState(INITIAL_BADGES);
  const [resilienceScore, setResilienceScore] = useState(74);

  // Crisis state
  const [crisisAlertSent, setCrisisAlertSent] = useState(false);

  const timerRef = useRef(null);
  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMsgs, isTyping]);

  // Recording timer effect (without setState inside body)
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 6) {
            clearInterval(timerRef.current);
            setIsRecording(false);
            const mockTranscripts = {
              voice: "Honestly, I've been feeling quite overwhelmed. The stress is compiling in my back and shoulders, and I feel like I'm running on empty, but I'm trying to take deep breaths.",
              video: "I am feeling a little nervous but trying to keep a smile on my face. It's difficult to focus when there are so many things piling up today."
            };
            setEntryText(mockTranscripts[journalMode]);
            onNotification("🎤 Audio/Video Processed", "Multimodal text transcription generated successfully!");
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, journalMode, onNotification]);

  // Unlock badges hook (wrapped in useCallback to satisfy dependency checks)
  const unlockBadge = useCallback((id) => {
    setBadges(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx !== -1 && !prev[idx].active) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], active: true };
        
        // Side effects
        setResilienceScore(s => Math.min(s + 5, 100));
        onNotification("🏆 New Badge Unlocked!", `You earned: ${prev[idx].name}!`);
        return copy;
      }
      return prev;
    });
  }, [onNotification]);

  // Derive filtered entries on render rather than inside useEffect
  const q = searchQuery.trim().toLowerCase();
  const filteredEntries = q
    ? entries.filter(e => {
        return (
          e.text.toLowerCase().includes(q) ||
          e.mood.toLowerCase().includes(q) ||
          e.tags.some(t => t.toLowerCase().includes(q)) ||
          (q === "hopeful" && e.sentiment > 60) ||
          (q === "stressed" && e.sentiment < 40)
        );
      })
    : entries;

  const handlePairing = () => {
    setPairingState("pairing");
    setTimeout(() => {
      setPairingState("paired");
      setWearableConnected(true);
      unlockBadge("sync");
      onNotification("⌚ Wearable Sync", `${selectedDevice.toUpperCase()} paired successfully. Active metrics synchronized.`);
    }, 2000);
  };

  const handleAddTag = (tag) => {
    if (tag && !entryTags.includes(tag)) {
      setEntryTags([...entryTags, tag]);
    }
  };


  const handleSaveEntry = () => {
    if (!entryText.trim()) return;

    const baseSentiment = Math.floor(Math.random() * 50) + (selectedMood === "Joyful" || selectedMood === "Calm" ? 50 : 10);
    const cappedSentiment = Math.max(5, Math.min(baseSentiment, 98));

    // PII masking simulation
    let processedText = entryText;
    if (piiMasking) {
      processedText = processedText
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]");
      
      if (currentUser?.profile?.name) {
        const nameTokens = currentUser.profile.name.split(" ");
        nameTokens.forEach(token => {
          if (token && token.length > 2) {
            const escapedToken = token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            const tokenRegex = new RegExp(`\\b${escapedToken}\\b`, "gi");
            processedText = processedText.replace(tokenRegex, "[PATIENT_NAME]");
          }
        });
      } else {
        processedText = processedText.replace(/\bGurnoor\b/gi, "[PATIENT_NAME]");
      }
    }

    const newEntry = {
      id: Date.now(),
      date: "Today, " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mood: selectedMood,
      moodEmoji: MOOD_DATA.find(m => m.label === selectedMood)?.emoji || "✨",
      text: processedText,
      tags: entryTags.length > 0 ? entryTags : ["reflection"],
      sentiment: cappedSentiment,
      multimodal: {
        text: cappedSentiment,
        voice: Math.max(10, Math.min(100, cappedSentiment + (Math.floor(Math.random() * 20) - 10))),
        video: Math.max(10, Math.min(100, cappedSentiment + (Math.floor(Math.random() * 20) - 10)))
      },
      reflection: ""
    };

    const updated = [newEntry, ...entries];
    setEntries(updated);
    setAnalysisEntry(newEntry);
    setCbtReflection("");
    
    // Clear journaling states
    setEntryText("");
    setEntryTags([]);
    
    // Check if distress trigger is hit (prolonged distress)
    const recentScores = updated.slice(0, 3).map(e => e.sentiment);
    const isCrisisZone = recentScores.length >= 2 && recentScores.every(s => s < 35);
    
    if (isCrisisZone) {
      onNotification("🚨 High Distress Detected", "Prolonged low emotional states flagged. Crisis tools active.");
      setActiveTab("crisis");
    } else {
      onNotification("📝 Journal Entry Logged", "AI Multi-modal emotional extraction is ready.");
    }
  };

  const handleSaveCbtReflection = () => {
    if (!cbtReflection.trim() || !analysisEntry) return;

    setEntries(prev => prev.map(e => e.id === analysisEntry.id ? { ...e, reflection: cbtReflection } : e));
    setResilienceScore(s => Math.min(s + 6, 100));
    unlockBadge("thinker");
    onNotification("🧠 Reflection Saved", "CBT cognitive reappraisal locked to timeline.");
    setAnalysisEntry(null);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userText = chatInput;
    setChatMsgs(prev => [...prev, { from: "user", text: userText }]);
    setChatInput("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let reply = "";
      
      const textLower = userText.toLowerCase();
      if (textLower.includes("off") || textLower.includes("don't know") || textLower.includes("weird") || textLower.includes("unusual")) {
        reply = "It's completely okay to feel 'off' without an immediate explanation. Let's practice a grounding exercise: Can you name one physical object around you that is colored blue, and focus on its shape?";
      } else if (textLower.includes("stressed") || textLower.includes("deadline") || textLower.includes("exams") || textLower.includes("work")) {
        reply = "Deadlines can trigger high physiological pressure. Try separating the stress from your worth: What is one tiny action item you can control right now, even if it takes just 2 minutes?";
      } else if (textLower.includes("sad") || textLower.includes("lonely") || textLower.includes("cry")) {
        reply = "Thank you for sharing that sadness with me. Allow yourself to feel this wave without judgment. What is a small act of self-care you could offer yourself right now?";
      } else {
        reply = "I hear you, and I'm with you. If we look at this feeling through a CBT lens, is it possible that your mind is jump-starting to conclusions, or is there a step we can take to break this down?";
      }

      setChatMsgs(prev => [...prev, { from: "ai", text: reply }]);
    }, 1500);
  };

  const handleReleaseLetter = () => {
    if (!letterText.trim()) return;
    setIsDissolving(true);
    setLetterStatus("Releasing your thoughts to the wind...");
    
    setTimeout(() => {
      setLetterText("");
      setIsDissolving(false);
      setLetterStatus("Released! Deep breath in. Let the worries go. 🍃");
      unlockBadge("release");
      setTimeout(() => setLetterStatus(""), 4000);
    }, 2500);
  };

  const triggerCrisisAlert = () => {
    setCrisisAlertSent(true);
    onNotification("⚠️ Trusted Contacts Notified", "An alert with your status and location has been dispatched securely.");
  };

  // Onboarding full-page wizard
  if (!onboarded) {
    return (
      <div style={{ display: "flex", flex: 1, justifyContent: "center", alignItems: "center", minHeight: "85vh", padding: 20 }}>
        <div className="glass-card" style={{ width: "100%", maxWidth: 640, padding: 40, display: "flex", flexDirection: "column", gap: 24, boxShadow: "var(--shadow-lg)" }}>
          
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid var(--border-light)", paddingBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--indigo-primary)" }}>
              Senti<span style={{ color: "var(--teal-primary)" }}>med</span> <span style={{ fontWeight: 400, fontSize: 18, color: "var(--text-muted)" }}>Portal Onboarding</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--teal-dark)", background: "var(--teal-light)", padding: "4px 12px", borderRadius: 20 }}>
              Step {onboardStep} of 4
            </span>
          </div>

          {/* Steps Switch */}
          {onboardStep === 1 && (
            <div className="fade-in-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 48, textAlign: "center" }}>🌿</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--indigo-primary)", textAlign: "center" }}>
                Welcome to your SentiMed Web Portal
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-main)", lineHeight: 1.6, textAlign: "center" }}>
                A private, HIPAA-compliant space mapping biological sensors with cognitive self-care logs. Let's calibrate your workspace.
              </p>
              <div style={{ background: "var(--indigo-light)", padding: 20, borderRadius: 12, border: "1px solid var(--border-light)", marginTop: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--indigo-primary)", marginBottom: 4 }}>💡 Shared Clinical Stream</div>
                <p style={{ fontSize: 12, color: "var(--text-main)", lineHeight: 1.4 }}>If consented, SentiMed translates your trends to a secure portal for your clinical providers, helping them understand your emotional trajectory between visits.</p>
              </div>
            </div>
          )}

          {onboardStep === 2 && (
            <div className="fade-in-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--indigo-primary)", textAlign: "center" }}>
                What are your wellness focus areas?
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 10 }}>
                We customize CBT reflection templates and forecast alerts based on these.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { id: "anxiety", title: "📉 Calm Anxious Loops", desc: "Interrupt cyclical stress loops" },
                  { id: "sleep", title: "😴 Improve Sleep Cycles", desc: "Map rest patterns to mood states" },
                  { id: "trends", title: "📊 Track Biomarkers", desc: "Correlate HRV, activity & emotional tone" },
                  { id: "resilience", title: "🛡️ Mental Resilience", desc: "Engage in cognitive journaling" }
                ].map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGoals(prev => ({ ...prev, [g.id]: !prev[g.id] }))}
                    style={{
                      padding: "16px",
                      borderRadius: 12,
                      border: goals[g.id] ? "2px solid var(--teal-primary)" : "1.5px solid var(--border-light)",
                      background: goals[g.id] ? "var(--teal-light)" : "var(--bg-card)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ fontWeight: 700, color: goals[g.id] ? "var(--teal-dark)" : "var(--text-dark)", fontSize: 14 }}>{g.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {onboardStep === 3 && (
            <div className="fade-in-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--indigo-primary)", textAlign: "center" }}>
                Privacy Configuration
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 10 }}>
                Manage how SentiMed anonymizes and streams your dataset.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 16, border: "1.5px solid var(--border-light)", borderRadius: 12 }}>
                  <input
                    type="checkbox"
                    id="pii"
                    checked={piiMasking}
                    onChange={(e) => setPiiMasking(e.target.checked)}
                    style={{ marginTop: 4, width: 16, height: 16, accentColor: "var(--teal-primary)" }}
                  />
                  <label htmlFor="pii" style={{ fontSize: 13, cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-dark)" }}>Enable PII Redaction Filter</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>Removes personal identifiers (names, phone logs, exact dates) using local models before clinical reports render.</div>
                  </label>
                </div>

                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: 16, border: "1.5px solid var(--border-light)", borderRadius: 12 }}>
                  <input
                    type="checkbox"
                    id="share"
                    checked={consentCollection}
                    onChange={(e) => setConsentCollection(e.target.checked)}
                    style={{ marginTop: 4, width: 16, height: 16, accentColor: "var(--teal-primary)" }}
                  />
                  <label htmlFor="share" style={{ fontSize: 13, cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-dark)" }}>Clinician Dashboard Consent</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>Authorize weekly anonymized biometric summaries and mood score charts to stream to your clinician's check-in board.</div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {onboardStep === 4 && (
            <div className="fade-in-anim" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--indigo-primary)", textAlign: "center" }}>
                Connect Wearable Sensors
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginBottom: 10 }}>
                Map heart rate variability and activity thresholds to find emotional correlations.
              </p>

              {pairingState === "idle" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
                    {[
                      { id: "apple", label: "Apple Watch", icon: "🍎" },
                      { id: "fitbit", label: "Fitbit", icon: "⚡" },
                      { id: "oura", label: "Oura Ring", icon: "💍" }
                    ].map(d => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDevice(d.id)}
                        style={{
                          padding: "16px 8px",
                          borderRadius: 12,
                          border: selectedDevice === d.id ? "2px solid var(--teal-primary)" : "1.5px solid var(--border-light)",
                          background: selectedDevice === d.id ? "var(--teal-light)" : "var(--bg-card)",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 8,
                          transition: "all 0.15s ease"
                        }}
                      >
                        <span style={{ fontSize: 24 }}>{d.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dark)" }}>{d.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handlePairing}
                    className="btn-hover"
                    style={{
                      background: "var(--indigo-primary)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      padding: 12,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Sync Sensors
                  </button>
                </>
              )}

              {pairingState === "pairing" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    border: "3px solid var(--border-light)",
                    borderTop: "3px solid var(--teal-primary)",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    marginBottom: 12
                  }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dark)" }}>Syncing SentiMed biometric streaming services...</div>
                  <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {pairingState === "paired" && (
                <div style={{ textAlign: "center", padding: 20, background: "var(--teal-light)", borderRadius: 12, border: "1px solid rgba(76, 175, 145, 0.2)" }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✨ ⌚</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--teal-dark)" }}>{selectedDevice.toUpperCase()} Linked</div>
                  <div style={{ fontSize: 12, color: "var(--text-main)", marginTop: 4 }}>Biometric telemetry sync complete.</div>
                </div>
              )}
            </div>
          )}

          {/* Footer Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, borderTop: "1px solid var(--border-light)", paddingTop: 20 }}>
            {onboardStep > 1 ? (
              <button
                onClick={() => setOnboardStep(onboardStep - 1)}
                style={{ background: "none", border: "1.5px solid var(--border-light)", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-dark)" }}
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {onboardStep < 4 ? (
              <button
                onClick={() => setOnboardStep(onboardStep + 1)}
                style={{ background: "var(--indigo-primary)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Continue
              </button>
            ) : (
              <button
                onClick={() => {
                  setOnboarded(true);
                  localStorage.setItem("sentimed_onboarded", "true");
                }}
                style={{
                  background: "var(--teal-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "10px 28px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Go to Portal
              </button>
            )}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="portal-layout">
      
      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR NAVIGATION */}
      {/* ========================================================= */}
      <nav className="portal-sidebar">
        <div>
          {/* Brand header */}
          <div style={{ padding: "0 24px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🍃</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px" }}>
              Senti<span style={{ color: "var(--teal-primary)" }}>Med</span>
            </span>
          </div>

          {/* Navigation Links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 20, padding: "0 12px" }}>
            {[
              { id: "dashboard", label: "Dashboard", icon: "🏠" },
              { id: "journal", label: "Journal & Log", icon: "📓" },
              { id: "insights", label: "Biometric Trends", icon: "📊" },
              { id: "companion", label: "CBT Companion AI", icon: "🤖" },
              { id: "badges", label: "Resilience Badges", icon: "🏆" },
              { id: "memory", label: "Memory Bank", icon: "🧭" },
              { id: "settings", label: "Portal Settings", icon: "⚙️" }
            ].map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: active ? "rgba(76, 175, 145, 0.15)" : "none",
                    color: active ? "var(--teal-primary)" : "rgba(255,255,255,0.65)",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s"
                  }}
                  className="btn-hover"
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div style={{ padding: "0 16px" }}>
          {/* Urgent Trigger */}
          <button
            onClick={() => setActiveTab("crisis")}
            className="pulse-anim"
            style={{
              width: "100%",
              background: "var(--rose-primary)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 16,
              boxShadow: "0 4px 12px rgba(224,92,92,0.3)"
            }}
          >
            <span>🚨</span>
            <span>CRISIS SUPPORT</span>
          </button>

          {/* User profile capsule */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--teal-primary), var(--teal-dark))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700
            }}>
              {(currentUser?.profile?.name || currentUser?.email || "P")[0].toUpperCase()}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{currentUser?.profile?.name || currentUser?.email || "Patient User"}</div>
              <div style={{ fontSize: 10, color: "var(--teal-primary)" }}>● Consent Active</div>
            </div>
          </div>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* MAIN VIEWPORT AREA */}
      {/* ========================================================= */}
      <main className="portal-content">
        
        {/* ========================================================= */}
        {/* VIEW: DASHBOARD */}
        {/* ========================================================= */}
        {activeTab === "dashboard" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--indigo-primary)" }}>
                Welcome back, ${(currentUser?.profile?.name || "Patient").split(" ")[0]} ✨
              </h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
                Here is your integrated bio-emotional status for today.
              </p>
            </div>

            {/* Layout Grid */}
            <div className="desktop-main-split">
              
              {/* Left Column: Scores & Correlations */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                
                {/* Wellness Score Card & Streak */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
                  
                  {/* Wellness Indicator */}
                  <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#F4F4F2" strokeWidth="9" />
                      <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke="var(--teal-primary)"
                        strokeWidth="9"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - resilienceScore / 100)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                        style={{ transition: "stroke-dashoffset 1s ease" }}
                      />
                      <text x="50" y="56" textAnchor="middle" style={{ fontSize: 20, fontWeight: 800, fill: "var(--indigo-primary)", fontFamily: "var(--font-display)" }}>
                        {resilienceScore}%
                      </text>
                    </svg>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Wellness Score</span>
                      <h4 style={{ fontSize: 18, fontWeight: 800, color: "var(--indigo-primary)", marginTop: 4 }}>Emotional Resilience</h4>
                      <p style={{ fontSize: 12, color: "var(--text-main)", marginTop: 4 }}>Calculated from biometric sleep correlation and CBT journal reflections.</p>
                    </div>
                  </div>

                  {/* Streak Card */}
                  <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Daily Streak</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                        <span style={{ fontSize: 28 }} className="float-anim">🔥</span>
                        <span style={{ fontSize: 24, fontWeight: 800, color: "var(--indigo-primary)", fontFamily: "var(--font-display)" }}>12 Days</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                        <span>Milestone Badge</span>
                        <span>12/15 days</span>
                      </div>
                      <div style={{ width: "100%", height: 6, background: "var(--border-light)", borderRadius: 10 }}>
                        <div style={{ width: "80%", height: "100%", background: "var(--amber-primary)", borderRadius: 10 }} />
                      </div>
                    </div>
                  </div>

                </div>

                {/* Quick check-in mood bar */}
                <div className="glass-card">
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>Quick Check-in Mood shortcut</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                    {MOOD_DATA.map(m => (
                      <button
                        key={m.label}
                        onClick={() => {
                          setSelectedMood(m.label);
                          onNotification("Mood selected", `Selected: ${m.emoji} ${m.label}. Opening Journal workspace.`);
                          setActiveTab("journal");
                        }}
                        style={{
                          background: m.bg,
                          border: `1.5px solid ${m.color}30`,
                          borderRadius: 12,
                          padding: "12px 8px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 6,
                          cursor: "pointer"
                        }}
                        className="btn-hover"
                      >
                        <span style={{ fontSize: 24 }}>{m.emoji}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dark)" }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wearable Correlation Details */}
                {wearableConnected && (
                  <div style={{ background: "linear-gradient(135deg, var(--indigo-primary), var(--indigo-deep))", borderRadius: 16, padding: 20, color: "#fff", display: "flex", gap: 16, alignItems: "center", boxShadow: "var(--shadow-md)" }}>
                    <div style={{ fontSize: 32 }}>📡</div>
                    <div>
                      <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--teal-primary)", letterSpacing: 0.5 }}>TELEMETRY INTERSECTION</div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>Heart Rate Variability (HRV) is 48ms (+12%)</h4>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2, lineHeight: 1.4 }}>When HRV stays above 45ms, your linguistic logs record a 25% lower occurrence of stress tags. Solid recovery indices!</p>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column: AI & Alerts */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                
                {/* Smart Forecast */}
                <div style={{ background: "var(--amber-light)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 16, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--amber-dark)", fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
                    <span>⚠️</span>
                    <span>Stress Warning Dip Predicted</span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.5 }}>
                    Sleep thresholds dropped to 5.4hrs. Models predict a potential emotional dip tomorrow mid-day. Try scheduling a brief CBT journal reflection tonight.
                  </p>
                </div>

                {/* Companion Widget shortcut */}
                <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyBetween: "space-between", height: "100%" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 24 }}>🤖</span>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>AI Companion Online</h4>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Your CBT assistant is ready to help guide you through anxiety and frame cognitive boundaries in the Unsent Letter space.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("companion")}
                    style={{
                      background: "var(--teal-primary)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: 10,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: "pointer",
                      width: "100%",
                      marginTop: 20
                    }}
                    className="btn-hover"
                  >
                    Open Companion Portal
                  </button>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: JOURNAL & ANALYSIS TIMELINE */}
        {/* ========================================================= */}
        {activeTab === "journal" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--indigo-primary)" }}>Reflective Journal</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Write reflections and monitor your bio-emotional indices.</p>
            </div>

            <div className="desktop-main-split">
              
              {/* Left Column: Creator Workspace */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Create New Entry</span>
                
                {/* Modality switcher */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { id: "text", label: "✍️ Text Entry", active: journalMode === "text" },
                    { id: "voice", label: "🎙️ Voice Log", active: journalMode === "voice" },
                    { id: "video", label: "🎥 Video Reflection", active: journalMode === "video" }
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setJournalMode(mode.id);
                        setIsRecording(false);
                        setRecordingSeconds(0);
                      }}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        border: mode.active ? "2px solid var(--teal-primary)" : "1px solid var(--border-light)",
                        background: mode.active ? "var(--teal-light)" : "#fff",
                        color: mode.active ? "var(--teal-dark)" : "var(--text-dark)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer"
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Recorder Mock visualizers */}
                {journalMode !== "text" && (
                  <div style={{ background: "var(--indigo-primary)", padding: 20, borderRadius: 12, color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                    {journalMode === "voice" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 32 }}>
                        {[4, 12, 18, 22, 16, 26, 12, 6, 12, 22, 8, 4].map((h, idx) => (
                          <div
                            key={idx}
                            style={{
                              width: 5,
                              height: isRecording ? `${h * (1.2 + Math.sin(recordingSeconds * 2.5 + idx))}px` : "4px",
                              background: "var(--teal-primary)",
                              borderRadius: 2,
                              transition: "height 0.1s ease"
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {journalMode === "video" && (
                      <div style={{ width: "100%", height: 140, background: "#000", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        {isRecording ? (
                          <>
                            <div style={{ width: "100%", height: "100%", background: "radial-gradient(circle, #222 10%, #000 80%)" }} />
                            <span style={{ position: "absolute", top: 12, left: 12, background: "var(--rose-primary)", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>REC STREAM</span>
                            <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "var(--teal-primary)", opacity: 0.3, animation: "scan 2.5s linear infinite" }} />
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Video Sensor Idle</span>
                        )}
                      </div>
                    )}
                    <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12 }}>{isRecording ? `0:0${recordingSeconds}s recording active` : "Telemetry awaiting click"}</span>
                      <button
                        onClick={() => {
                          if (!isRecording) {
                            setRecordingSeconds(0);
                          }
                          setIsRecording(!isRecording);
                        }}
                        style={{
                          background: isRecording ? "var(--rose-primary)" : "var(--teal-primary)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 14px",
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: "pointer"
                        }}
                      >
                        {isRecording ? "⏹ Stop Stream" : "⏺ Start Stream"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Text area */}
                <textarea
                  value={entryText}
                  onChange={e => setEntryText(e.target.value)}
                  placeholder="Record your thoughts here..."
                  style={{
                    width: "100%",
                    height: 140,
                    border: "1.5px solid var(--border-light)",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 13,
                    outline: "none",
                    resize: "none",
                    fontFamily: "var(--font-sans)"
                  }}
                />

                {/* Mood Select */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Log Core Emotion</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {MOOD_DATA.map(m => (
                      <button
                        key={m.label}
                        onClick={() => setSelectedMood(m.label)}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          border: selectedMood === m.label ? `2px solid ${m.color}` : "1.5px solid var(--border-light)",
                          background: selectedMood === m.label ? m.bg : "var(--bg-card)",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          color: selectedMood === m.label ? m.color : "var(--text-dark)"
                        }}
                      >
                        {m.emoji} {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags manager */}
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>Tags Selection</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {entryTags.map(t => (
                      <span key={t} style={{ background: "var(--indigo-light)", color: "var(--text-dark)", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        #{t}
                        <button onClick={() => setEntryTags(entryTags.filter(x => x !== t))} style={{ border: "none", background: "none", color: "var(--rose-primary)", fontWeight: 700, cursor: "pointer" }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {["work", "stress", "sleep", "family", "social", "nature"].map(t => (
                      <button key={t} type="button" onClick={() => handleAddTag(t)} style={{ background: "none", border: "1px dashed var(--text-muted)", borderRadius: 8, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "var(--text-muted)" }}>+{t}</button>
                    ))}
                  </div>
                </div>

                {/* Save button */}
                <button
                  onClick={handleSaveEntry}
                  disabled={!entryText.trim()}
                  className="btn-hover"
                  style={{
                    width: "100%",
                    background: entryText.trim() ? "var(--indigo-primary)" : "var(--border-light)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: entryText.trim() ? "pointer" : "not-allowed"
                  }}
                >
                  Analyze & Save to Timeline
                </button>
              </div>

              {/* Right Column: Logs Timeline */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* Search / Filter logs */}
                <div className="glass-card" style={{ display: "flex", gap: 10, padding: "12px 16px" }}>
                  <input
                    type="text"
                    placeholder="Search logs by keyword..."
                    value={searchQuery}
                    onChange={e => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      if (val.trim()) {
                        unlockBadge("explorer");
                      }
                    }}
                    style={{
                      flex: 1,
                      border: "1.5px solid var(--border-light)",
                      borderRadius: 10,
                      padding: "8px 12px",
                      fontSize: 13,
                      outline: "none"
                    }}
                  />
                </div>

                {/* Timeline content */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 600, overflowY: "auto" }}>
                  {filteredEntries.map(e => (
                    <div key={e.id} className="glass-card card-interactive" style={{ padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>{e.date}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--teal-dark)", background: "var(--teal-light)", padding: "4px 8px", borderRadius: 8 }}>
                          {e.moodEmoji} {e.mood}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.5 }}>{e.text}</p>
                      
                      {e.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {e.tags.map(t => (
                            <span key={t} style={{ fontSize: 10, background: "var(--indigo-light)", color: "var(--text-muted)", padding: "2px 6px", borderRadius: 4 }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {e.reflection ? (
                        <div style={{ background: "var(--teal-light)", borderLeft: "3px solid var(--teal-primary)", padding: 8, borderRadius: "0 8px 8px 0", marginTop: 10, fontSize: 12, color: "var(--teal-dark)", fontStyle: "italic" }}>
                          💡 Reflection: "{e.reflection}"
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAnalysisEntry(e);
                            setCbtReflection("");
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--teal-primary)",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            textDecoration: "underline",
                            marginTop: 10
                          }}
                        >
                          Add CBT Guided Reflection →
                        </button>
                      )}
                    </div>
                  ))}

                  {filteredEntries.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No emotional records match.</p>
                  )}
                </div>

              </div>

            </div>

            {/* EMOTION ANALYSIS DIALOG OVERLAY */}
            {analysisEntry && !analysisEntry.reflection && (
              <div style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                backdropFilter: "blur(4px)"
              }}>
                <div className="glass-card" style={{ width: "100%", maxWidth: 500, padding: 24, textAlign: "left", boxShadow: "var(--shadow-lg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: 12, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--indigo-primary)", fontFamily: "var(--font-display)" }}>Multimodal Emotion Extraction</h3>
                    <button onClick={() => setAnalysisEntry(null)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}>×</button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>✍️ Linguistic (Text)</span>
                        <span style={{ fontWeight: 700 }}>{analysisEntry.multimodal?.text || 50}% Pos</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border-light)", borderRadius: 10 }}>
                        <div style={{ width: `${analysisEntry.multimodal?.text || 50}%`, height: "100%", background: "var(--teal-primary)", borderRadius: 10 }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>🎙️ Acoustical (Voice)</span>
                        <span style={{ fontWeight: 700 }}>{analysisEntry.multimodal?.voice || 50}% Calm</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border-light)", borderRadius: 10 }}>
                        <div style={{ width: `${analysisEntry.multimodal?.voice || 50}%`, height: "100%", background: "var(--amber-primary)", borderRadius: 10 }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>🎥 Expression (Video)</span>
                        <span style={{ fontWeight: 700 }}>{analysisEntry.multimodal?.video || 50}% Valence</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border-light)", borderRadius: 10 }}>
                        <div style={{ width: `${analysisEntry.multimodal?.video || 50}%`, height: "100%", background: "var(--rose-primary)", borderRadius: 10 }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "var(--teal-light)", border: "1px solid rgba(76, 175, 145, 0.2)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal-dark)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>CBT Cognition Prompt</div>
                    <p style={{ fontSize: 13, color: "var(--text-dark)", fontWeight: 600, lineHeight: 1.4, marginBottom: 10 }}>
                      {MOOD_DATA.find(m => m.label === analysisEntry.mood)?.cbt || "What is a minor, grounding action item you can do right now?"}
                    </p>
                    <textarea
                      value={cbtReflection}
                      onChange={e => setCbtReflection(e.target.value)}
                      placeholder="I realize that..."
                      style={{
                        width: "100%",
                        height: 70,
                        border: "1px solid rgba(76, 175, 145, 0.3)",
                        borderRadius: 8,
                        padding: 8,
                        fontSize: 12,
                        outline: "none",
                        resize: "none",
                        background: "#fff"
                      }}
                    />
                  </div>

                  <button
                    onClick={handleSaveCbtReflection}
                    disabled={!cbtReflection.trim()}
                    style={{
                      width: "100%",
                      background: cbtReflection.trim() ? "var(--teal-primary)" : "#D1D1D6",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: 12,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: cbtReflection.trim() ? "pointer" : "not-allowed"
                    }}
                  >
                    Commit Reflection to Journal
                  </button>

                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: BIOMETRIC ANALYTICS */}
        {/* ========================================================= */}
        {activeTab === "insights" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--indigo-primary)" }}>Biometric Analytics</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Linked biometric sensors correlations timeline.</p>
            </div>

            {/* Large Trajectory Graph */}
            <div className="glass-card" style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 14 }}>30-Day Emotional Trajectory Chart</span>
              
              <div style={{ width: "100%", height: 180, position: "relative" }}>
                <svg width="100%" height="150" viewBox="0 0 500 150">
                  <line x1="0" y1="20" x2="500" y2="20" stroke="#F0F0EE" strokeWidth="1" />
                  <line x1="0" y1="75" x2="500" y2="75" stroke="#F0F0EE" strokeWidth="1" />
                  <line x1="0" y1="130" x2="500" y2="130" stroke="#F0F0EE" strokeWidth="1" />
                  
                  {/* Fill area */}
                  <path
                    d="M10,130 Q100,50 200,90 T400,20 T490,40 L490,150 L10,150 Z"
                    fill="url(#area-grad)"
                    opacity="0.12"
                  />
                  
                  {/* Line */}
                  <path
                    d="M10,130 Q100,50 200,90 T400,20 T490,40"
                    fill="none"
                    stroke="var(--teal-primary)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Nodes */}
                  <circle cx="10" cy="130" r="5" fill="var(--rose-primary)" />
                  <circle cx="200" cy="90" r="5" fill="var(--amber-primary)" />
                  <circle cx="400" cy="20" r="5" fill="var(--teal-primary)" />
                  <circle cx="490" cy="40" r="5" fill="var(--teal-primary)" />

                  <defs>
                    <linearGradient id="area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--teal-primary)" />
                      <stop offset="100%" stopColor="#fff" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", padding: "0 10px" }}>
                  <span>Week 1 (Baseline: 48%)</span>
                  <span>Week 2 (Log Sync: 54%)</span>
                  <span>Week 3 (Wearable sync: 72%)</span>
                  <span>Today (Score: {resilienceScore}%)</span>
                </div>
              </div>
            </div>

            {/* Correlation Split Grid */}
            <div className="desktop-grid-2">
              
              {/* Distribution */}
              <div className="glass-card">
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>30-Day Mood Distribution</span>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Calm & Stable", pct: 45, color: "var(--teal-primary)" },
                    { label: "Joyful Connection", pct: 28, color: "var(--amber-primary)" },
                    { label: "Anxious Loops", pct: 17, color: "#5C8DD6" },
                    { label: "Burnout Fatigue", pct: 10, color: "var(--rose-primary)" }
                  ].map(x => (
                    <div key={x.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>{x.label}</span>
                        <span style={{ fontWeight: 700 }}>{x.pct}%</span>
                      </div>
                      <div style={{ width: "100%", height: 6, background: "var(--border-light)", borderRadius: 10 }}>
                        <div style={{ width: `${x.pct}%`, height: "100%", background: x.color, borderRadius: 10 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Correlations list */}
              <div className="glass-card">
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>Wearable Sync Correlations</span>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { title: "💤 Rest Sleep duration vs Anxious Tags", score: "+0.72", status: "Strong correlation", desc: "Sleep under 6hrs tracks with a 30% increase in anxiety keyword counts." },
                    { title: "📡 HRV Baseline vs Emotional Recovery", score: "+0.64", status: "Moderate correlation", desc: "High Heart Rate Variability correlates with rapid post-crisis recoveries." },
                    { title: "👟 Daily Activity Steps vs Mood Boost", score: "+0.45", status: "Positive correlation", desc: "Hitting 8,000 steps correlates with elevated next-day joy indices." }
                  ].map((c, i) => (
                    <div key={i} style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 8, lastChild: { border: "none" } }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dark)" }}>{c.title}</h4>
                        <span style={{ fontSize: 10, background: "var(--teal-light)", color: "var(--teal-dark)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{c.score} ({c.status})</span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3 }}>{c.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: CBT COMPANION & UNSENT LETTER */}
        {/* ========================================================= */}
        {activeTab === "companion" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--indigo-primary)" }}>Companion Space</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Empathetic AI reflection and secure letter purging.</p>
            </div>

            {/* Split Screen Layout */}
            <div className="desktop-grid-2">
              
              {/* Left Column: AI chat */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", height: 420 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>CBT AI Dialogue Engine</span>
                
                {/* Chat window */}
                <div style={{ flex: 1, border: "1.5px solid var(--border-light)", borderRadius: 12, background: "#FAF9F6", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  
                  {/* Messages Feed */}
                  <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    {chatMsgs.map((m, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "80%",
                          background: m.from === "user" ? "var(--indigo-primary)" : "var(--indigo-light)",
                          color: m.from === "user" ? "#fff" : "var(--text-dark)",
                          borderRadius: m.from === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                          padding: "8px 12px",
                          fontSize: 12,
                          lineHeight: 1.4
                        }}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div style={{ display: "flex", justifyContent: "flex-start" }}>
                        <div style={{ background: "var(--indigo-light)", borderRadius: "12px 12px 12px 2px", padding: "8px 14px", display: "flex", gap: 4 }}>
                          {[0, 1, 2].map(x => (
                            <span key={x} className="pulse-anim" style={{ width: 6, height: 6, background: "var(--text-muted)", borderRadius: "50%", animationDelay: `${x * 0.2}s` }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input form */}
                  <div style={{ borderTop: "1.5px solid var(--border-light)", padding: 8, display: "flex", background: "#fff" }}>
                    <input
                      type="text"
                      placeholder="Type boundaries, fatigue thoughts, or specific triggers..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSendChat()}
                      style={{
                        flex: 1,
                        border: "none",
                        outline: "none",
                        fontSize: 12,
                        padding: "6px"
                      }}
                    />
                    <button
                      onClick={handleSendChat}
                      style={{
                        background: "var(--teal-primary)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        width: 36,
                        height: 30,
                        cursor: "pointer"
                      }}
                    >
                      →
                    </button>
                  </div>

                </div>
              </div>

              {/* Right Column: Unsent Letter */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyBetween: "space-between" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>The Unsent Letter Canvas</span>
                  
                  <div style={{ background: "var(--amber-light)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "var(--amber-dark)", marginBottom: 2 }}>📝 Catharsis without risk</div>
                    <p style={{ fontSize: 11, color: "var(--text-main)", lineHeight: 1.4 }}>Express frustrations or boundary violations here. SentiMed automatically processes and purges this buffer completely upon release. No metadata is recorded.</p>
                  </div>

                  <div style={{ position: "relative" }}>
                    <textarea
                      value={letterText}
                      onChange={e => setLetterText(e.target.value)}
                      disabled={isDissolving}
                      placeholder="Write freely and without holding back..."
                      style={{
                        width: "100%",
                        height: 160,
                        border: "1.5px solid var(--border-light)",
                        borderRadius: 12,
                        padding: 12,
                        fontSize: 13,
                        outline: "none",
                        resize: "none",
                        background: "#FAF9F5"
                      }}
                      className={isDissolving ? "letter-dissolve" : ""}
                    />
                    {isDissolving && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(250,249,245,0.85)", borderRadius: 12 }}>
                        <span style={{ fontSize: 28, animation: "pulse 1s infinite" }}>🍃 💨</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  {letterStatus && (
                    <div style={{ textAlign: "center", fontSize: 12, color: "var(--teal-dark)", fontWeight: 700, marginBottom: 10 }}>
                      {letterStatus}
                    </div>
                  )}

                  <button
                    onClick={handleReleaseLetter}
                    disabled={!letterText.trim() || isDissolving}
                    className="btn-hover"
                    style={{
                      width: "100%",
                      background: letterText.trim() && !isDissolving ? "var(--indigo-primary)" : "#D1D1D6",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      padding: 12,
                      fontWeight: 700,
                      cursor: letterText.trim() && !isDissolving ? "pointer" : "not-allowed"
                    }}
                  >
                    Release to the Wind 🍃
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: RESILIENCE BADGES */}
        {/* ========================================================= */}
        {activeTab === "badges" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--indigo-primary)" }}>Resilience Milestones</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Unlock self-care rewards as you maintain your checking routines.</p>
            </div>

            <div className="desktop-main-split">
              
              {/* Badges list grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {badges.map(b => (
                  <div
                    key={b.id}
                    className={b.active ? "glass-card card-interactive" : "glass-card"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      background: b.active ? "#fff" : "rgba(230,230,230,0.3)",
                      opacity: b.active ? 1 : 0.6,
                      border: b.active ? "1px solid var(--border-light)" : "1px dashed var(--text-muted)"
                    }}
                  >
                    <span style={{ fontSize: 36 }} className={b.active ? "float-anim" : ""}>{b.icon}</span>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>{b.name}</h4>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{b.desc}</p>
                      <span style={{ display: "inline-block", fontSize: 9, background: b.active ? "var(--teal-light)" : "var(--border-light)", color: b.active ? "var(--teal-dark)" : "var(--text-muted)", padding: "2px 8px", borderRadius: 10, fontWeight: 700, marginTop: 6 }}>
                        {b.active ? "Unlocked" : "Locked"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resilience details side */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                
                {/* Resilience Score */}
                <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Mental Fortitude</span>
                  <div style={{ fontSize: 44, fontWeight: 800, color: "var(--teal-primary)", fontFamily: "var(--font-display)", margin: "10px 0" }}>{resilienceScore}/100</div>
                  <p style={{ fontSize: 12, color: "var(--text-main)", textAlign: "center", lineHeight: 1.4 }}>Updates as you save CBT reflections, complete letter catharses, and sync wearable steps.</p>
                </div>

                {/* Checklist */}
                <div className="glass-card">
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>Checklist Goals</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Sync wearable tracking sensors", completed: wearableConnected },
                      { label: "Verify CBT reflection history", completed: entries.filter(e => e.reflection).length >= 1 },
                      { label: "Write first cathartic unsent letter", completed: badges.find(x => x.id === "release")?.active }
                    ].map((g, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: g.completed ? "var(--teal-primary)" : "var(--text-muted)", fontSize: 14 }}>{g.completed ? "✓" : "○"}</span>
                        <span style={{ fontSize: 12, color: g.completed ? "var(--text-dark)" : "var(--text-muted)", textDecoration: g.completed ? "line-through" : "none" }}>{g.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: MEMORY BANK SEARCH */}
        {/* ========================================================= */}
        {activeTab === "memory" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--indigo-primary)" }}>Memory Bank</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Search logs to discover biological patterns.</p>
            </div>

            {/* Semantic Search Box */}
            <div className="glass-card" style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 10 }}>Concept Search</span>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder='Search "family", "exhausted", "hopeful", or tags...'
                  value={searchQuery}
                  onChange={e => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    if (val.trim()) {
                      unlockBadge("explorer");
                    }
                  }}
                  style={{
                    flex: 1,
                    border: "1.5px solid var(--border-light)",
                    borderRadius: 12,
                    padding: "10px 14px",
                    fontSize: 13,
                    outline: "none"
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "var(--indigo-light)", borderRadius: 12, padding: "0 16px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="desktop-main-split">
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>Matching records ({filteredEntries.length})</span>
                
                {filteredEntries.map(e => (
                  <div key={e.id} className="glass-card card-interactive" style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.date}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--teal-dark)", background: "var(--teal-light)", padding: "4px 8px", borderRadius: 8 }}>
                        {e.moodEmoji} {e.mood}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.5 }}>{e.text}</p>
                    {e.reflection && (
                      <div style={{ background: "var(--teal-light)", borderLeft: "3px solid var(--teal-primary)", padding: 8, borderRadius: "0 8px 8px 0", marginTop: 8, fontSize: 12, color: "var(--teal-dark)", fontStyle: "italic" }}>
                        💡 Reflection: "{e.reflection}"
                      </div>
                    )}
                  </div>
                ))}

                {filteredEntries.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No logs match query.</p>
                )}
              </div>

              {/* Highlights */}
              <div className="glass-card" style={{ height: "fit-content" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>Highlight Summaries</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--indigo-primary)" }}>🌿 Nature Tags Correlation</div>
                    <p style={{ fontSize: 11, color: "var(--text-main)", marginTop: 4, lineHeight: 1.3 }}>Your wellness baseline is 25% higher on days where you use tag <strong>#nature</strong>.</p>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--indigo-primary)" }}>⏰ Anxious Timing</div>
                    <p style={{ fontSize: 11, color: "var(--text-main)", marginTop: 4, lineHeight: 1.3 }}>Anxiety logs cluster between 10 PM and midnight on workdays. Suggests connection to sleep onset schedules.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: PORTAL SETTINGS & BASICS */}
        {/* ========================================================= */}
        {activeTab === "settings" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--indigo-primary)" }}>Portal Settings</h1>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Control baseline telemetry and clinical consents.</p>
            </div>

            <div className="desktop-grid-2">
              
              {/* Toggles */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Clinical Sharing Controls</span>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)" }}>Enable PII Redaction Filter</h4>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Automatically masks names and phone numbers inside saved timeline logs before therapist dashboard sync.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={piiMasking}
                    onChange={e => setPiiMasking(e.target.checked)}
                    style={{ accentColor: "var(--teal-primary)", width: 18, height: 18, cursor: "pointer" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderTop: "1px solid var(--border-light)", paddingTop: 14 }}>
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)" }}>Active Clinician Streaming</h4>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Consent to stream weekly mood curves and wearable heart rate summaries to your therapist dashboard.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={consentCollection}
                    onChange={e => setConsentCollection(e.target.checked)}
                    style={{ accentColor: "var(--teal-primary)", width: 18, height: 18, cursor: "pointer" }}
                  />
                </div>
              </div>

              {/* Sensor stats */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Linked Sensor telemetries</span>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Sensor Link Sync (Active)</span>
                  <button
                    onClick={() => {
                      setWearableConnected(!wearableConnected);
                      onNotification("Wearable sync toggled", `Wearable state is now ${!wearableConnected ? "paired" : "disabled"}`);
                    }}
                    style={{
                      background: wearableConnected ? "var(--teal-primary)" : "var(--border-light)",
                      color: wearableConnected ? "#fff" : "var(--text-dark)",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    {wearableConnected ? "● Sensor Online" : "● Sensor Offline"}
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (window.confirm("Confirm full dataset purge? This will reset all logs, badges, and onboarding.")) {
                      localStorage.removeItem("sentimed_onboarded");
                      setEntries(INITIAL_ENTRIES);
                      setOnboarded(false);
                      setOnboardStep(1);
                      setPairingState("idle");
                      setWearableConnected(false);
                    }
                  }}
                  style={{
                    background: "none",
                    border: "1.5px solid var(--rose-primary)",
                    color: "var(--rose-primary)",
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    marginTop: 20
                  }}
                >
                  Purge Complete Platform Dataset
                </button>
              </div>

            </div>

            {/* Registered Patient Profile & Clinical Intake */}
            <div className="glass-card" style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Clinical Intake & Demographic Profile</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                
                {/* Profile demographics */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 13 }}>👤 Name: <strong>{currentUser?.profile?.name || "N/A"}</strong></div>
                  <div style={{ fontSize: 13 }}>📞 Mobile: <strong>{currentUser?.profile?.mobile || "N/A"}</strong></div>
                  <div style={{ fontSize: 13 }}>✉️ Account Email: <strong>{currentUser?.email || "N/A"}</strong></div>
                  <div style={{ fontSize: 13, borderTop: "1px solid var(--border-light)", paddingTop: 8, marginTop: 4 }}>🚨 Emergency Contacts:</div>
                  {currentUser?.profile?.emergencyContacts?.map((c, i) => (
                    <div key={i} style={{ fontSize: 12, paddingLeft: 12, color: "var(--text-main)" }}>
                      Contact {i + 1}: <strong>{c.name || "N/A"}</strong> — {c.phone || "N/A"}
                    </div>
                  ))}
                  <div style={{ fontSize: 12, paddingLeft: 12, color: "var(--text-main)" }}>
                    Emergency Alert Target: <strong>{currentUser?.profile?.emergencyEmail || "N/A"}</strong>
                  </div>
                </div>

                {/* Medical History */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, borderLeft: "1px solid var(--border-light)", paddingLeft: 20 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Active Medical Issues</span>
                    <div style={{ fontSize: 13, color: "var(--text-dark)", marginTop: 4 }}>
                      {currentUser?.profile?.medicalIssue ? "⚠️ Yes" : "🟢 No active clinical issues logged"}
                    </div>
                    {currentUser?.profile?.medicalIssue && (
                      <p style={{ fontSize: 12, background: "var(--amber-light)", padding: 8, borderRadius: 8, color: "var(--amber-dark)", marginTop: 4, lineHeight: 1.4 }}>
                        {currentUser.profile.medicalIssueText || "No details provided."}
                      </p>
                    )}
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Ongoing Treatment & Medications</span>
                    <div style={{ fontSize: 13, color: "var(--text-dark)", marginTop: 4 }}>
                      {currentUser?.profile?.ongoingTreatment ? "💊 Yes, active treatment going on" : "🟢 No active treatments logged"}
                    </div>
                    {currentUser?.profile?.ongoingTreatment && (
                      <p style={{ fontSize: 12, background: "var(--teal-light)", padding: 8, borderRadius: 8, color: "var(--teal-dark)", marginTop: 4, lineHeight: 1.4 }}>
                        {currentUser.profile.ongoingTreatmentText || "No details provided."}
                      </p>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW: CRISIS SUPPORT (RED ZONE) */}
        {/* ========================================================= */}
        {activeTab === "crisis" && (
          <div className="fade-in-anim" style={{ textAlign: "left" }}>
            <div style={{ background: "var(--rose-light)", border: "1.5px solid var(--rose-primary)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--rose-dark)", marginBottom: 6 }}>Immediate Crisis Support Hub</h2>
              <p style={{ fontSize: 13, color: "var(--rose-dark)", lineHeight: 1.5 }}>
                If you are experiencing severe distress, emotional crisis, or thoughts of self-harm, please choose one of the options below. Your personal identity remains fully masked and encrypted under HIPAA guidelines.
              </p>
            </div>

            <div className="desktop-grid-2">
              
              {/* Helplines */}
              <div className="glass-card">
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 12 }}>Emergency Hotlines</span>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { name: "📞 988 Suicide & Crisis Lifeline", details: "Call or text 988. Free, confidential, 24/7." },
                    { name: "💬 Crisis Text Line", details: "Text HOME to 741741 to chat with a counselor." },
                    { name: "🩺 Clinician Dashboard Callback", details: "Sends an urgent alert callback request to your clinician." }
                  ].map((h, i) => (
                    <div key={i} style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: 8, lastChild: { border: "none" } }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)" }}>{h.name}</span>
                        <span style={{ fontSize: 11, color: "var(--rose-primary)", fontWeight: 700 }}>Active</span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{h.details}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trusted circle checkin */}
              <div className="glass-card" style={{ display: "flex", flexDirection: "column", justifyBetween: "space-between" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 10 }}>Trusted Circle Alert Dispatch</span>
                  <p style={{ fontSize: 13, color: "var(--text-main)", lineHeight: 1.4 }}>
                    Instantly dispatch a template SMS checking nudge to your registered security contacts (e.g. Sarah, primary caregiver). Includes safety details.
                  </p>
                </div>

                <div style={{ marginTop: 24 }}>
                  {crisisAlertSent ? (
                    <div style={{ background: "var(--teal-light)", border: "1px solid rgba(76, 175, 145, 0.2)", borderRadius: 10, padding: 12, color: "var(--teal-dark)", fontWeight: 700, textAlign: "center" }}>
                      ✓ Status dispatch SMS successfully broadcasted to: Sarah
                    </div>
                  ) : (
                    <button
                      onClick={triggerCrisisAlert}
                      className="btn-hover"
                      style={{
                        width: "100%",
                        background: "var(--rose-primary)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 12,
                        padding: 12,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer"
                      }}
                    >
                      Broadcast Safety Nudge SMS
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}

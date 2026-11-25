import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Sparkles,
  Lightbulb,
  Loader2,
  Mic,
  Square,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AI_SUGGESTED_PROMPTS } from '../../data/mockData';
import { getCompanionReply, companionVoiceSupported, transcribeCompanionVoice } from '../../services/companionService';
import { useAudioRecorder, formatSeconds } from '../../hooks/useAudioRecorder';
import { describeError } from '../../services/apiClient';
import { useDraftState } from '../../hooks/useDraftState';
import { PageTransition } from '../animations';
import { Button } from '../ui';

export default function CompanionView({ currentUser }) {
  const userName = currentUser?.profile?.name ? currentUser.profile.name.split(" ")[0] : "there";

  // The conversation survives switching screens during this session (in-memory only, never stored)
  const [messages, setMessages] = useDraftState("companion.messages", [
    {
      id: "msg-1",
      sender: "ai",
      text: `Hi ${userName}. I'm your SentiMed AI Companion. I'm here to listen, reflect, and guide you through CBT-based reframing exercises. What is on your mind today?`,
      time: "Just now"
    }
  ]);

  const [input, setInput] = useDraftState("companion.input", "");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Voice input: record -> transcribe (Whisper) + voice emotion (WavLM) -> transcript goes into the
  // input box for review. Nothing is stored server-side (preview endpoint).
  const voiceSupported = companionVoiceSupported();
  const [voice, setVoice] = useState(null); // { transcript, emotion, voiceSays, textSays, detectedEmotions }
  const [transcribing, setTranscribing] = useState(false);
  const rec = useAudioRecorder({
    maxSeconds: 60,
    onRecorded: async (blob) => {
      setTranscribing(true);
      try {
        const r = await transcribeCompanionVoice(blob);
        if (!/[a-z]/i.test(r.transcript)) {
          rec.setError("I couldn't hear any words. Please try again a little closer to the microphone.");
          return;
        }
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${r.transcript}` : r.transcript));
        setVoice(r);
        inputRef.current?.focus();
      } catch (err) {
        rec.setError(describeError(err));
      } finally {
        setTranscribing(false);
      }
    }
  });
  const isRecording = rec.state === "recording";
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping || isRecording || transcribing) return;

    // Spoken message: if the user sent the transcript unchanged, reuse the voice+words emotion;
    // if they edited it, the edited text is analysed as usual.
    const spoken = !textToSend && voice && query.includes(voice.transcript);
    const unchanged = spoken && query.trim() === voice.transcript.trim();

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: query,
      viaVoice: Boolean(spoken),
      voiceEmotion: spoken ? voice.voiceSays || voice.emotion : null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) {
      setInput("");
      setVoice(null);
    }
    setIsTyping(true);

    try {
      const replyText = await getCompanionReply(query, { voiceEmotions: unchanged ? voice.detectedEmotions : null });
      const aiMsg = {
        id: `msg-ai-${Date.now()}`,
        sender: "ai",
        text: replyText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      // Show the failure in the conversation instead of silently dropping the reply
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: "ai",
          text: `I could not respond just now: ${describeError(err)}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 120px)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>AI CBT Companion</h1>
              <span className="badge badge-primary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Sparkles size={12} /> Confidential & Redacted
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Interactive cognitive reframing assistant. Conversations undergo automated PII masking.
            </p>
          </div>
        </div>

        {/* Chat Main Window */}
        <div
          className="card"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: 24,
            overflowY: "auto",
            gap: 16,
            background: "var(--color-surface)"
          }}
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isAi = msg.sender === "ai";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignSelf: isAi ? "flex-start" : "flex-end",
                    maxWidth: "80%",
                    flexDirection: isAi ? "row" : "row-reverse"
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      backgroundColor: isAi ? "#EAF7F2" : "#1A1A2E",
                      color: isAi ? "#2E7D62" : "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    {isAi ? <Bot size={20} /> : <User size={20} />}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: isAi ? "flex-start" : "flex-end" }}>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>
                      {isAi ? "SentiMed AI" : "You"} • {msg.time}
                    </div>

                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: 16,
                        borderTopLeftRadius: isAi ? 4 : 16,
                        borderTopRightRadius: isAi ? 16 : 4,
                        backgroundColor: isAi ? "var(--color-bg)" : "var(--color-primary-dark)",
                        color: isAi ? "var(--color-text)" : "#FFFFFF",
                        fontSize: 14,
                        lineHeight: 1.5
                      }}
                    >
                      {msg.text}
                    </div>
                    {msg.viaVoice && (
                      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Mic size={11} /> Spoken{msg.voiceEmotion ? ` · tone of voice: ${cap(msg.voiceEmotion)}` : ""}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-text-muted)", fontSize: 13 }}>
              <Loader2 size={16} className="spin-anim" />
              <span>SentiMed AI is generating a CBT reflection...</span>
            </motion.div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggested Prompt Chips */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {AI_SUGGESTED_PROMPTS.map((prompt, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              icon={Lightbulb}
              onClick={() => handleSend(prompt)}
              style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {prompt}
            </Button>
          ))}
        </div>

        {/* Voice result: shown until the message is sent */}
        {voice && !isRecording && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-text-muted)", flexWrap: "wrap" }}>
            <Mic size={13} color="var(--color-primary-dark)" />
            <span>
              Transcribed. Review it, then send.
              {voice.emotion && <> Detected: <strong style={{ color: "var(--color-text)" }}>{cap(voice.emotion)}</strong></>}
              {voice.voiceSays && <> (voice: {cap(voice.voiceSays)}{voice.textSays ? `, words: ${cap(voice.textSays)}` : ""})</>}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setVoice(null)} aria-label="Dismiss voice result">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Composer Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            type="button"
            onClick={isRecording ? rec.stop : rec.start}
            disabled={!voiceSupported || isTyping || transcribing}
            aria-label={isRecording ? "Stop recording and transcribe" : "Speak your message"}
            title={
              voiceSupported
                ? isRecording ? "Stop and transcribe" : "Speak your message"
                : "Voice input needs the live portal and a browser with microphone support"
            }
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: "50%",
              border: isRecording ? "none" : "1px solid var(--color-border)",
              background: isRecording ? "#E74C3C" : "var(--color-surface)",
              color: isRecording ? "#fff" : voiceSupported ? "var(--color-primary-dark)" : "var(--color-text-muted)",
              cursor: !voiceSupported || isTyping || transcribing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: isRecording ? `0 0 0 ${3 + rec.level * 10}px rgba(231, 76, 60, 0.25)` : "none",
              transition: "box-shadow 0.08s"
            }}
          >
            {transcribing ? <Loader2 size={18} className="spin-anim" /> : isRecording ? <Square size={16} /> : <Mic size={18} />}
          </button>

          {isRecording ? (
            <div
              className="input-field"
              role="status"
              style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--color-text)" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E74C3C", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Listening… {formatSeconds(rec.seconds)} / 1:00</span>
              <div style={{ flex: 1, height: 4, background: "var(--color-border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${Math.round(rec.level * 100)}%`, height: "100%", background: "#E74C3C", transition: "width 0.08s" }} />
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={rec.cancel} aria-label="Cancel recording">
                <X size={14} /> <span>Cancel</span>
              </button>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              className="input-field"
              placeholder={transcribing ? "Transcribing your voice…" : voiceSupported ? "Type or tap the mic to speak…" : "Share what you are feeling..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping || transcribing}
            />
          )}
          <Button
            type="submit"
            variant="primary"
            icon={Send}
            disabled={isTyping || isRecording || transcribing || !input.trim()}
          >
            Send
          </Button>
        </form>
        {rec.error && (
          <div role="alert" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#C0392B", marginTop: -8 }}>
            <AlertCircle size={13} /> <span>{rec.error}</span>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

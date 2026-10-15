import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Sparkles,
  Lightbulb,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AI_SUGGESTED_PROMPTS } from '../../data/mockData';
import { getCompanionReply } from '../../services/companionService';
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping) return;

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsTyping(true);

    try {
      const replyText = await getCompanionReply(query);
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

        {/* Composer Form */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} style={{ display: "flex", gap: 12 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Share what you are feeling..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
          />
          <Button
            type="submit"
            variant="primary"
            icon={Send}
            disabled={isTyping || !input.trim()}
          >
            Send
          </Button>
        </form>
      </div>
    </PageTransition>
  );
}

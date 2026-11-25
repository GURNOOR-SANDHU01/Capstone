import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pct = (v) => `${Math.round(v * 100)}%`;
const NEGATIVE = new Set(["anger", "disgust", "fear", "sadness"]);
const barColor = (label) => (label === "joy" ? "#4CAF91" : NEGATIVE.has(label) ? "#E05C5C" : "#8A8FA3");

/** One model's probabilities as horizontal bars, highest first. */
function ScoreBars({ title, scores }) {
  const rows = Object.entries(scores || {})
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180, flex: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {title}
      </span>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ width: 64, flexShrink: 0 }}>{cap(label)}</span>
          <div style={{ flex: 1, height: 5, background: "#F0F0EE", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: pct(Math.max(0, Math.min(1, value))), height: "100%", background: barColor(label) }} />
          </div>
          <span style={{ width: 32, textAlign: "right", color: "var(--color-text-muted)" }}>{pct(value)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * What the emotion models found in one journal entry:
 *  - fine-grained emotions (27 GoEmotions labels, text model) as chips
 *  - on demand: the voice model's 7 probabilities, the fused voice + words scores (voice entries),
 *    or the 6 core emotions from the words (typed entries)
 */
export default function EmotionBreakdown({ fineGrained = [], voiceScores = null, fusedScores = null, ekmanScores = null }) {
  const [open, setOpen] = useState(false);
  const hasFused = fusedScores && Object.keys(fusedScores).length > 0;
  const hasVoice = voiceScores && Object.keys(voiceScores).length > 0;
  const hasEkman = !hasVoice && ekmanScores && Object.keys(ekmanScores).length > 0;
  const hasDetails = hasVoice || hasFused || hasEkman;
  if (!fineGrained.length && !hasDetails) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {fineGrained.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }} aria-label="Fine-grained emotions">
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 600 }}>Fine-grained:</span>
          {fineGrained.map((f) => (
            <span key={f.label} className="badge badge-primary" style={{ fontSize: 10 }}>
              {cap(f.label)} {pct(f.score)}
            </span>
          ))}
        </div>
      )}
      {hasDetails && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: "var(--color-primary-dark)", display: "inline-flex", alignItems: "center", gap: 2 }}
        >
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {open ? "Hide" : "Show"} model scores
        </button>
      )}
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          {hasVoice && <ScoreBars title="Voice tone (WavLM, 7 emotions)" scores={voiceScores} />}
          {hasFused && <ScoreBars title="Voice + words fused (70/30)" scores={fusedScores} />}
          {hasEkman && <ScoreBars title="Core emotions from your words" scores={ekmanScores} />}
        </div>
      )}
    </div>
  );
}

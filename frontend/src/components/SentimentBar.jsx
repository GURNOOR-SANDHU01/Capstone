import React from 'react';

/**
 * SentimentBar Component
 * Visual progress bar for rendering text/voice/video sentiment scores.
 * 
 * @param {number} value - Sentiment score (0 - 100)
 * @param {string} label - Optional label (e.g. "Text", "Voice", "Overall")
 * @param {boolean} showPercentage - Whether to display numerical value
 */
export default function SentimentBar({ value = 50, label, showPercentage = true }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));
  
  // Custom color based on sentiment score ranges
  const color = safeValue > 65 ? "#4CAF91" : safeValue > 40 ? "#F5A623" : "#E05C5C";
  const bgLight = safeValue > 65 ? "#EAF7F2" : safeValue > 40 ? "#FFF8EC" : "#FBF0F0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
          <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>{label}</span>
          {showPercentage && (
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{safeValue}%</span>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div 
          style={{ 
            flex: 1, 
            height: 6, 
            background: "#F0F0EE", 
            borderRadius: 6, 
            overflow: "hidden",
            position: "relative"
          }}
          role="progressbar"
          aria-valuenow={safeValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || "Sentiment score"}
        >
          <div 
            style={{ 
              width: `${safeValue}%`, 
              height: "100%", 
              background: color, 
              borderRadius: 6, 
              transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)" 
            }} 
          />
        </div>
        {!label && showPercentage && (
          <span style={{ fontSize: 12, color, fontWeight: 700, minWidth: 32, textAlign: "right" }}>
            {safeValue}%
          </span>
        )}
      </div>
    </div>
  );
}

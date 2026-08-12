import React from 'react';

/**
 * MoodRing Component
 * Interactive SVG circular mood & sentiment indicator.
 * 
 * @param {number} score - Overall sentiment score (0 - 100)
 * @param {string} moodEmoji - Emoji representing active mood
 * @param {string} moodLabel - Label text for active mood
 * @param {number} size - Pixel size of SVG ring container
 */
export default function MoodRing({ score = 72, moodEmoji = "😌", moodLabel = "Calm", size = 160 }) {
  const safeScore = Math.min(100, Math.max(0, score));
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  const color = safeScore > 65 ? "#4CAF91" : safeScore > 40 ? "#F5A623" : "#E05C5C";

  return (
    <div 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center",
        position: "relative",
        width: size,
        height: size,
        margin: "0 auto"
      }}
      aria-label={`Mood score ring: ${safeScore}% (${moodLabel})`}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E8EAE8"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-in-out, stroke 0.5s ease" }}
        />
      </svg>
      {/* Center Label Content */}
      <div 
        style={{ 
          position: "absolute", 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center" 
        }}
      >
        <span style={{ fontSize: size * 0.22, lineHeight: 1 }} role="img" aria-label={moodLabel}>
          {moodEmoji}
        </span>
        <span style={{ fontSize: size * 0.14, fontWeight: 800, color: "var(--color-text)", marginTop: 2 }}>
          {safeScore}%
        </span>
        <span style={{ fontSize: size * 0.085, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {moodLabel}
        </span>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { ShieldCheck, RotateCcw, AlertCircle } from 'lucide-react';

/**
 * SentiMed Digital Health Assistant Avatar Component
 */
function AssistantAvatar({ isError = false }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 240,
        height: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      className="assistant-float-container"
    >
      {/* Background Soft Glow Aura */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: isError 
            ? 'radial-gradient(circle, rgba(224,92,92,0.15) 0%, rgba(254,242,242,0) 70%)' 
            : 'radial-gradient(circle, rgba(76,175,145,0.2) 0%, rgba(234,247,242,0) 70%)',
          animation: 'pulseAura 4s infinite ease-in-out'
        }}
      />

      {/* SVG Assistant Character */}
      <svg
        width="220"
        height="220"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'relative', zIndex: 2 }}
      >
        <circle cx="100" cy="100" r="88" fill={isError ? '#FBF0F0' : '#EAF7F2'} />
        <circle cx="100" cy="100" r="86" stroke={isError ? '#E05C5C' : '#4CAF91'} strokeWidth="2" strokeDasharray="6 6" opacity="0.4" />

        <path
          d="M48 180C48 142 70 125 100 125C130 125 152 142 152 180"
          fill={isError ? '#E05C5C' : '#2E7D62'}
        />
        <path d="M82 125L100 152L118 125H82Z" fill="#FFFFFF" />

        <path
          d="M84 126C84 140 92 148 100 148C108 148 116 140 116 126"
          stroke="#4CAF91"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="100" cy="150" r="6" fill="#F5A623" />

        <rect x="92" y="112" width="16" height="18" fill="#FCE0D6" rx="4" />
        <ellipse cx="100" cy="84" rx="34" ry="38" fill="#FCE0D6" />

        <path
          d="M66 84C66 58 80 44 100 44C120 44 134 58 134 84C134 88 132 94 130 96C128 72 118 56 100 56C82 56 72 72 70 96C68 94 66 88 66 84Z"
          fill="#1A1A2E"
        />

        <rect x="76" y="76" width="20" height="14" rx="4" stroke="#1A1A2E" strokeWidth="2.5" fill="rgba(255,255,255,0.4)" />
        <rect x="104" y="76" width="20" height="14" rx="4" stroke="#1A1A2E" strokeWidth="2.5" fill="rgba(255,255,255,0.4)" />
        <line x1="96" y1="83" x2="104" y2="83" stroke="#1A1A2E" strokeWidth="2.5" />

        <circle cx="86" cy="83" r="3" fill="#1A1A2E" />
        <circle cx="114" cy="83" r="3" fill="#1A1A2E" />

        {isError ? (
          <path d="M92 98C96 95 104 95 108 98" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
        ) : (
          <path d="M92 94C96 99 104 99 108 94" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round" />
        )}

        {!isError && (
          <g>
            <circle cx="156" cy="60" r="4" fill="#4CAF91" />
            <circle cx="44" cy="110" r="3" fill="#F5A623" />
          </g>
        )}
      </svg>

      <style>{`
        @keyframes assistantFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes pulseAura {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        .assistant-float-container {
          animation: assistantFloat 4s infinite ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .assistant-float-container {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

const DYNAMIC_LOADING_MESSAGES = [
  "Hi! I'm getting everything ready for you.",
  "Preparing your SentiMed experience...",
  "Setting up your secure wellness space...",
  "Almost there — calibrating your dashboard..."
];

/**
 * SentiMedLoader Component
 * Flexible loader supporting initial full-screen welcome experience, page loader, or inline loader.
 * 
 * @param {'initial' | 'page' | 'inline'} variant
 * @param {string} error - Optional explicit error message if initialization failed
 * @param {Function} onRetry - Optional callback when retry is clicked
 */
export default function SentiMedLoader({ variant = "initial", error, onRetry }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(25);

  // Message rotator & smooth progress animation
  useEffect(() => {
    if (variant !== "initial") return;

    const messageInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % DYNAMIC_LOADING_MESSAGES.length);
    }, 2400);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return 90;
        return prev + 15;
      });
    }, 250);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [variant]);

  // Inline variant
  if (variant === "inline") {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--color-primary-dark)", fontSize: 13, fontWeight: 600 }}>
        <span className="spin-anim" style={{ width: 14, height: 14, border: "2px solid var(--color-primary)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block" }} />
        <span>Loading...</span>
      </div>
    );
  }

  // Page variant
  if (variant === "page") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 48, gap: 16 }}>
        <div style={{ width: 36, height: 36, border: "3px solid var(--color-primary-soft)", borderTopColor: "var(--color-primary-dark)", borderRadius: "50%" }} className="spin-anim" />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-muted)" }}>Loading workspace content...</div>
      </div>
    );
  }

  // Initial Full-Screen Welcome Loader
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "var(--color-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 9999,
        textAlign: "center"
      }}
    >
      {/* Top SentiMed Brand Logo */}
      <div style={{ position: "absolute", top: 32, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}>
          Senti<span style={{ color: "var(--color-primary)" }}>Med</span>
        </div>
      </div>

      {error ? (
        /* Error State if explicit initialization error occurs */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 420 }} className="fade-in-anim">
          <AssistantAvatar isError={true} />
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-danger)", fontWeight: 700, fontSize: 18 }}>
            <AlertCircle size={20} />
            <span>Connection Error</span>
          </div>
          
          <p style={{ fontSize: 14, color: "var(--color-text-muted)", marginTop: -4 }}>
            {error || "We encountered a delay while connecting to services."}
          </p>

          <button
            onClick={() => {
              if (onRetry) onRetry();
              else window.location.reload();
            }}
            className="btn btn-primary btn-lg"
            style={{ marginTop: 8 }}
          >
            <RotateCcw size={18} />
            <span>Try Again</span>
          </button>
        </div>
      ) : (
        /* Standard Engaging Welcome Experience */
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, maxWidth: 460 }} className="fade-in-anim">
          <AssistantAvatar isError={false} />

          {/* Dynamic Welcome Heading */}
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "#1A1A2E" }}>
              Welcome to SentiMed
            </h1>
            
            {/* Dynamic Rotating Message with ARIA live region */}
            <p
              aria-live="polite"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--color-primary-dark)",
                marginTop: 6,
                minHeight: 24,
                transition: "opacity 0.3s ease"
              }}
            >
              {DYNAMIC_LOADING_MESSAGES[messageIndex]}
            </p>
          </div>

          {/* Polished Horizontal Progress Bar */}
          <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <div
              style={{
                width: "100%",
                height: 6,
                backgroundColor: "#E8EAE8",
                borderRadius: 6,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  backgroundColor: "var(--color-primary)",
                  borderRadius: 6,
                  transition: "width 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
              />
            </div>
          </div>

          {/* User-friendly Security Footer */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              marginTop: 16
            }}
          >
            <ShieldCheck size={15} color="var(--color-primary-dark)" />
            <span>Preparing your secure workspace</span>
          </div>
        </div>
      )}
    </div>
  );
}

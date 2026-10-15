import React, { useState } from 'react';
import {
  TrendingUp,
  Sun,
  Zap,
  Users,
  Info,
  Activity,
  Award,
  ShieldCheck
} from 'lucide-react';
import MoodChart from '../MoodChart';
import SentimentBar from '../SentimentBar';
import { calculateWellnessStats, getWeeklyChartData, findTagPatterns, findWeekdayPattern } from '../../services/insightService';
import { listMemories, sendMemoryFeedback } from '../../services/clinicalApi';
import { isRealFirebaseConfigured } from '../../services/firebase';
import { describeError } from '../../services/apiClient';
import { useAsyncData } from '../../hooks/useAsyncData';
import { LoadState } from '../ui';

export default function InsightsView({ entries = [], onNotification }) {
  const stats = calculateWellnessStats(entries);
  const chartData = getWeeklyChartData(entries);
  const tagPatterns = findTagPatterns(entries);
  const weekdayPattern = findWeekdayPattern(entries);
  const memories = useAsyncData(listMemories, [entries.length], []);
  const [feedbackGiven, setFeedbackGiven] = useState({});

  const giveFeedback = async (memory, feedback) => {
    try {
      const importance = await sendMemoryFeedback(memory.id, feedback);
      setFeedbackGiven((prev) => ({ ...prev, [memory.id]: feedback }));
      memories.setData((prev) => (prev || []).map((m) => (m.id === memory.id ? { ...m, importance } : m)));
    } catch (err) {
      onNotification && onNotification("Feedback Not Saved", describeError(err));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800 }}>Wellness Analytics & Insights</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Longitudinal patterns, sentiment distribution, and biometric correlations over time.
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="app-grid-3">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>AVERAGE SENTIMENT</span>
            <Activity size={18} color="var(--color-primary-dark)" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-primary-dark)", marginTop: 4 }}>
            {stats.averageSentiment}%
          </div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>
            {stats.weeklyComparison === "—" ? "Not enough history for a weekly trend" : `${stats.weeklyComparison} vs previous 7 days`}
          </span>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>DOMINANT MOOD</span>
            <Sun size={18} color="#B8690A" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
            {stats.dominantEmotion}
          </div>
          <span className="badge badge-warning" style={{ marginTop: 8 }}>Based on {stats.totalEntries} entries</span>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>TOTAL ENTRIES</span>
            <Award size={18} color="#4A90E2" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--color-text)", marginTop: 4 }}>
            {stats.totalEntries}
          </div>
          <span className="badge badge-primary" style={{ marginTop: 8 }}>Consistent habit streak</span>
        </div>
      </div>

      {/* Main Analytics Layout */}
      <div className="app-split-2-1">
        {/* Left Column: Weekly Trend & Multi-modal breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>7-Day Sentiment Trajectory</h3>
            <MoodChart data={chartData} />
          </div>

          {/* Multimodal Channel Analysis */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Multimodal Modality Comparison</h3>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              Correlation between text analysis, voice pitch variance, and facial micro-expression telemetry.
            </p>
            <SentimentBar value={stats.averageSentiment} label="Textual NLP Processing" />
            {stats.voiceAverage !== null ? (
              <SentimentBar value={stats.voiceAverage} label="Vocal Prosody & Tone" />
            ) : (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Vocal Prosody & Tone: no voice entries yet.</p>
            )}
            {stats.videoAverage !== null ? (
              <SentimentBar value={stats.videoAverage} label="Facial Biomarker Analysis" />
            ) : (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Facial Biomarker Analysis: no video entries yet.</p>
            )}
          </div>
        </div>

        {/* Right Column: Key Patterns & Insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Observed Emotional Patterns</h3>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: -8 }}>Computed from your own entries and tags.</p>

            {tagPatterns.length === 0 && !weekdayPattern && (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Patterns appear once you have a few entries with recurring tags (at least two entries per tag).
              </p>
            )}

            {tagPatterns.map((p) => (
              <div
                key={p.tag}
                style={{
                  background: p.delta > 0 ? "var(--color-primary-soft)" : "var(--color-warning-soft)",
                  padding: 14,
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${p.delta > 0 ? "rgba(76,175,145,0.2)" : "rgba(245,166,35,0.2)"}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: p.delta > 0 ? "var(--color-primary-dark)" : "#B8690A" }}>
                  {p.delta > 0 ? <Sun size={16} /> : <Zap size={16} />}
                  <span>#{p.tag}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--color-text)", marginTop: 4 }}>
                  Entries tagged #{p.tag} average {p.average}% sentiment, {Math.abs(p.delta)} points {p.delta > 0 ? "above" : "below"} your overall average ({p.count} entries).
                </p>
              </div>
            ))}

            {weekdayPattern && (
              <div style={{ background: "var(--color-bg)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
                  <Users size={16} />
                  <span>{weekdayPattern.day} Dip</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                  Your {weekdayPattern.day} entries average {weekdayPattern.average}%, below your overall {weekdayPattern.overall}%.
                </p>
              </div>
            )}
          </div>

          {isRealFirebaseConfigured && (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Remembered Patterns</h3>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                Extracted from your journal by the analysis service. Tell us whether each one fits — it adjusts how much weight it gets.
              </p>
              <LoadState loading={memories.loading} error={memories.error} onRetry={memories.reload} label="Loading patterns..." />
              {!memories.loading && !memories.error && (memories.data || []).length === 0 && (
                <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No patterns remembered yet.</p>
              )}
              {(memories.data || []).map((m) => (
                <div key={m.id} style={{ padding: 12, background: "var(--color-bg)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 13 }}>{m.text}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Relevance {m.importance}%</span>
                    {feedbackGiven[m.id] ? (
                      <span className="badge badge-primary">Thanks — marked "{feedbackGiven[m.id]}"</span>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => giveFeedback(m, "agree")}>Fits me</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => giveFeedback(m, "disagree")}>Doesn't fit</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Wellness Disclaimer Banner */}
      <div
        style={{
          background: "var(--color-bg)",
          border: "1px solid var(--color-border)",
          padding: 16,
          borderRadius: "var(--radius-sm)",
          fontSize: 12,
          color: "var(--color-text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: "center"
        }}
      >
        <Info size={16} style={{ flexShrink: 0 }} />
        <span><strong>Wellness Disclaimer:</strong> SentiMed provides wellness-oriented insights and sentiment patterns. It is not a clinical diagnostic tool or substitute for professional medical care.</span>
      </div>
    </div>
  );
}

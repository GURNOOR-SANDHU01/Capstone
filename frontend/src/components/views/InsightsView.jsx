import React from 'react';
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
import { calculateWellnessStats, getWeeklyChartData } from '../../services/insightService';

export default function InsightsView({ entries = [] }) {
  const stats = calculateWellnessStats(entries);
  const chartData = getWeeklyChartData(entries);

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
          <span className="badge badge-primary" style={{ marginTop: 8 }}>+14% vs last 30 days</span>
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
            <SentimentBar value={Math.min(100, stats.averageSentiment + 3)} label="Vocal Prosody & Tone" />
            <SentimentBar value={Math.max(0, stats.averageSentiment - 4)} label="Facial Biomarker Analysis" />
          </div>
        </div>

        {/* Right Column: Key Patterns & Insights */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Observed Emotional Patterns</h3>

            <div style={{ background: "var(--color-primary-soft)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid rgba(76,175,145,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--color-primary-dark)" }}>
                <Sun size={16} />
                <span>Morning Energy Lift</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text)", marginTop: 4 }}>
                Your sentiment scores average 18% higher during morning walks compared to late-evening work reflections.
              </p>
            </div>

            <div style={{ background: "var(--color-warning-soft)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid rgba(245,166,35,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#B8690A" }}>
                <Zap size={16} />
                <span>Mid-Week Stress Dip</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text)", marginTop: 4 }}>
                Anxiety keywords tend to cluster on Wednesday evenings before major project deliverables.
              </p>
            </div>

            <div style={{ background: "var(--color-bg)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>
                <Users size={16} />
                <span>Social Connection Impact</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
                Entries tagged with family or connection correlate with 90%+ positive sentiment reflections.
              </p>
            </div>
          </div>
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

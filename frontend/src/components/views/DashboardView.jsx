import React from 'react';
import {
  PenSquare,
  Bot,
  TrendingUp,
  Sparkles,
  Clock,
  Activity,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import MoodRing from '../MoodRing';
import MoodChart from '../MoodChart';
import SentimentBar from '../SentimentBar';
import { calculateWellnessStats, getWeeklyChartData } from '../../services/insightService';
import { PageTransition, StaggerContainer, StaggerItem, AnimatedNumber } from '../animations';
import { Button } from '../ui';

export default function DashboardView({ entries = [], onNavigate, currentUser }) {
  const stats = calculateWellnessStats(entries);
  const chartData = getWeeklyChartData(entries);

  const userName = currentUser?.profile?.name ? currentUser.profile.name.split(" ")[0] : "Friend";
  const recentEntries = entries.slice(0, 3);
  const latestEntry = entries[0] || null;

  return (
    <PageTransition>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Banner */}
        <div
          className="card"
          style={{
            background: "linear-gradient(135deg, #1A1A2E 0%, #2E7D62 100%)",
            color: "#FFFFFF",
            padding: "32px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "var(--color-primary)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Sparkles size={14} />
              Daily Wellness Overview
            </span>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, marginTop: 4 }}>
              Welcome back, {userName}
            </h1>
            <p style={{ fontSize: 14, opacity: 0.85, marginTop: 4, maxWidth: 520 }}>
              Your mental wellness score is stable today. Take a moment for reflection or talk with your AI companion.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="primary" icon={PenSquare} onClick={() => onNavigate('journal')}>
              New Journal
            </Button>
            <Button variant="outline" icon={Bot} onClick={() => onNavigate('companion')} style={{ borderColor: "rgba(255,255,255,0.3)", color: "#FFF" }}>
              AI Chat
            </Button>
          </div>
        </div>

        {/* Top Metric Cards - Staggered */}
        <StaggerContainer className="app-grid-3">
          <StaggerItem>
            <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>WELLNESS INDEX</span>
                <div style={{ fontSize: 32, fontWeight: 800, color: "var(--color-primary-dark)", marginTop: 4 }}>
                  <AnimatedNumber value={stats.overallScore} suffix="%" />
                </div>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Based on multimodal signals</span>
              </div>
              <MoodRing score={stats.overallScore} size={70} />
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="card">
              <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>LOGGED REFLECTIONS</span>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#1A1A2E", marginTop: 4 }}>
                <AnimatedNumber value={stats.totalEntries} />
              </div>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Total entries saved</span>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="card">
              <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 700 }}>PRIMARY MOOD STATE</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-primary-dark)", marginTop: 8 }}>
                {latestEntry ? latestEntry.mood : "—"}
              </div>
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {latestEntry ? `From your entry ${latestEntry.date}` : "Write a journal entry to start tracking"}
              </span>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Main Grid: Chart & Actions */}
        <div className="app-split-2-1">
          {/* Left Column: Weekly Trend Chart */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TrendingUp size={18} color="var(--color-primary-dark)" />
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>Weekly Mood Telemetry</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('insights')}>
                View Full Insights <ArrowRight size={14} />
              </Button>
            </div>

            <MoodChart data={chartData} height={220} />
            {stats.totalEntries === 0 && (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                Your weekly trend appears here after your first journal entries.
              </p>
            )}
          </div>

          {/* Right Column: Recent Activity Feed */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={18} color="var(--color-primary-dark)" />
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Recent Journal Entries</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recentEntries.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No journal entries yet.</p>
              )}
              {recentEntries.map((e) => (
                <div key={e.id} style={{ background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <strong style={{ color: "#1A1A2E" }}>{e.mood}</strong>
                    <span style={{ color: "var(--color-text-muted)" }}>{e.date}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--color-text)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {e.text}
                  </p>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={() => onNavigate('journal')} style={{ marginTop: "auto" }}>
              View All Journal Entries
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

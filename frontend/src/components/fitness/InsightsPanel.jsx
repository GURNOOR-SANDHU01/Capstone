import React from 'react';
import { AlertTriangle, Info, Lightbulb, TrendingUp, TrendingDown, Minus, Flame, Brain, Star } from 'lucide-react';

/**
 * Renders the backend's fitness analysis: wellbeing alerts, plain-language insights,
 * period-over-period comparison and mood <-> activity links.
 * Status is never color-alone: every alert has an icon and a severity word.
 */
const METRIC_LABEL = {
  steps: 'Steps / day',
  sleep_minutes: 'Sleep / night',
  active_minutes: 'Active minutes / day',
  heart_rate_avg: 'Avg heart rate',
  calories: 'Calories / day'
};
const LINK_LABEL = { sleep_minutes: 'Sleep', steps: 'Steps', active_minutes: 'Active minutes' };
const MARK = '#4CAF91';

const hours = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;
const fmt = (key, v) => {
  if (v === null || v === undefined) return '-';
  if (key === 'sleep_minutes') return hours(v);
  if (key === 'heart_rate_avg') return `${v} bpm`;
  if (key === 'active_minutes') return `${v} min`;
  if (key === 'calories') return `${v.toLocaleString()} kcal`;
  return v.toLocaleString();
};

const KIND_ICON = { alert: AlertTriangle, mood_link: Brain, trend: TrendingUp, streak: Flame, highlight: Star, info: Info };

function Change({ pct }) {
  if (pct === null || pct === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>-</span>;
  const Icon = Math.abs(pct) < 3 ? Minus : pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon size={13} /> {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

export default function InsightsPanel({ analysis, periodDays, audience = 'patient' }) {
  if (!analysis) return null;
  const { alerts = [], insights = [], trends = {}, mood_links: moodLinks } = analysis;
  const notes = insights.filter((i) => i.kind !== 'alert');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {alerts.map((a) => (
        <div
          key={a.type}
          role="alert"
          className="card"
          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: a.severity === 'moderate' ? '#FDF2E9' : '#FFF8EC', borderLeft: `4px solid ${a.severity === 'moderate' ? '#D35400' : '#B9770E'}` }}
        >
          <AlertTriangle size={18} color={a.severity === 'moderate' ? '#D35400' : '#B9770E'} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13 }}>
            <strong>{a.severity === 'moderate' ? 'Needs attention' : 'Worth noticing'}:</strong> {a.message}
            {a.with_low_mood && ' Journal mood has also been low recently.'}
            {a.severity === 'moderate' && audience === 'patient' && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Your care team may be notified if you have enabled red-flag alerts. If you feel unsafe, contact your local emergency number.
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
          <Lightbulb size={16} color="var(--color-primary-dark)" /> Insights
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((i, idx) => {
            const Icon = KIND_ICON[i.kind] || Info;
            return (
              <li key={idx} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.45 }}>
                <Icon size={15} color="var(--color-primary-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{i.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Last {periodDays} days vs the {periodDays} before</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                {['Metric', 'Now', 'Before', 'Change'].map((h) => (
                  <th key={h} style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.keys(METRIC_LABEL).map((k) => trends[k] && (
                <tr key={k}>
                  <td style={{ padding: '6px 8px' }}>{METRIC_LABEL[k]}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 700 }}>{fmt(k, trends[k].avg)}</td>
                  <td style={{ padding: '6px 8px' }}>{fmt(k, trends[k].previous_avg)}</td>
                  <td style={{ padding: '6px 8px' }}><Change pct={trends[k].change_pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>Averages need at least 3 days with data.</div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Mood and activity</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Average journal mood (0–100) on days above vs below each level
            {audience === 'doctor' ? ', from entries the patient shared' : ''}. Patterns, not causes.
          </div>
          {!moodLinks?.available ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {moodLinks?.reason === 'not_enough_journal_days'
                ? `Needs at least 6 days with journal entries in this period (currently ${moodLinks.mood_days || 0}).`
                : 'No journal mood data for this period yet.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {moodLinks.links.filter((l) => l.groups).map((l) => {
                const g = l.groups;
                const cutText = l.metric === 'sleep_minutes' ? hours(g.cut) : fmt(l.metric, g.cut);
                return (
                  <div key={l.metric} style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <strong>{LINK_LABEL[l.metric]}</strong>
                      <span style={{ color: 'var(--color-text-muted)' }}>{l.strength === 'none' ? 'no clear link' : `${l.strength} link`} · {l.paired_days} days</span>
                    </div>
                    {[
                      [`≥ ${cutText} (${g.high_days} days)`, g.high_mood],
                      [`< ${cutText} (${g.low_days} days)`, g.low_mood]
                    ].map(([label, v]) => (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 32px', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                        <div style={{ height: 10, background: 'var(--color-border)', borderRadius: 4 }}>
                          <div style={{ width: `${v}%`, height: '100%', background: MARK, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

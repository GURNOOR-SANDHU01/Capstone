import React, { useState } from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { PageHeader, Card, EmptyState, LoadState } from '../ui';
import { PageTransition } from '../animations';
import MetricChart from '../fitness/MetricChart';
import InsightsPanel from '../fitness/InsightsPanel';
import { useAsyncData } from '../../hooks/useAsyncData';
import { listMyPatients } from '../../services/clinicalApi';
import { getPatientWellness, fitnessLive } from '../../services/fitnessService';
import { PatientPicker } from './DoctorPortalViews';
import { useSelectedPatient } from '../../hooks/useSelectedPatient';

/**
 * Doctor: intake check-in answers + Google Fit summary for a consenting patient.
 * The server enforces consent (403 otherwise) and writes an audit-log entry for every view.
 */
const INTAKE_LABELS = {
  mood: 'Mood',
  anxiety: 'Anxiety',
  sleep: 'Sleep disruption',
  energy: 'Energy',
  crisis_thoughts: 'Crisis thoughts',
  immediate_risk: 'Immediate risk'
};
const RISK_BADGE = { low: 'badge-primary', moderate: 'badge-warning', high_urgent: 'badge-danger' };
const fmtHours = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
const tsText = (ts) => {
  const s = ts?._seconds ?? ts?.seconds;
  return typeof s === 'number' ? new Date(s * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'never';
};

export default function DoctorWellnessView() {
  const roster = useAsyncData(listMyPatients, [], []);
  const [patientId, setPatientId] = useSelectedPatient(roster);
  const [days, setDays] = useState(14);
  const wellness = useAsyncData(
    () => (patientId && fitnessLive() ? getPatientWellness(patientId, days) : Promise.resolve(null)),
    [patientId, days],
    null
  );
  const w = wellness.data;
  const s = w?.summary || {};
  const rows = w?.days || [];
  const patientName = (roster.data || []).find((p) => p.id === patientId)?.name || 'Patient';

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader
          title="Patient Wellness"
          icon={Activity}
          description="Intake check-in answers and Google Fit activity for patients who consent to share with you. Each view is recorded in the audit log."
          badge={
            <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={12} /> Read-only, consent-gated
            </span>
          }
        />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <PatientPicker roster={roster} value={patientId} onChange={setPatientId} />
          </div>
          <div className="segmented-control" role="group" aria-label="Date range">
            {[7, 14, 30].map((d) => (
              <button key={d} type="button" className={`segmented-tab ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
                {d} days
              </button>
            ))}
          </div>
        </div>

        {!fitnessLive() && (
          <EmptyState icon={Activity} title="Not available in Sandbox mode" description="Patient wellness summaries come from the live backend." />
        )}

        {patientId && <LoadState loading={wellness.loading} error={wellness.error} onRetry={wellness.reload} label="Loading wellness summary..." />}

        {w && !wellness.loading && (
          <>
            <Card>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Intake check-in</div>
              {!w.intake ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{patientName} has not completed the intake check-in yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>Completed {tsText(w.intake.completed_at)}</span>
                    {w.intake.risk_category && (
                      <span className={`badge ${RISK_BADGE[w.intake.risk_category] || 'badge-muted'}`}>
                        Screening: {w.intake.risk_category.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    {Object.entries({ ...(w.intake.wellness_answers || {}), ...(w.intake.safety_answers || {}) }).map(([k, v]) => (
                      <div key={k} style={{ background: 'var(--color-bg)', padding: 8, borderRadius: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{INTAKE_LABELS[k] || k}</div>
                        <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{String(v)}</div>
                      </div>
                    ))}
                  </div>
                  {w.access !== 'full' && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      Safety-screening answers are shown only with full reflection access.
                    </p>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  Google Fit activity ({w.range.from} to {w.range.to})
                </div>
                <span className={`badge ${w.connection.status === 'connected' ? 'badge-primary' : 'badge-muted'}`}>
                  {w.connection.status === 'connected'
                    ? `Connected, last sync ${tsText(w.connection.last_sync_at)}`
                    : w.connection.status === 'revoked'
                      ? 'Google access revoked'
                      : 'Not connected'}
                </span>
              </div>
              {rows.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No Google Fit data for this period.</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 12 }}>
                    {[
                      ['Avg steps', s.steps?.avg != null ? s.steps.avg.toLocaleString() : '-'],
                      ['Avg heart rate', s.heart_rate_avg?.avg != null ? `${s.heart_rate_avg.avg} bpm` : '-'],
                      ['Avg sleep', s.sleep_minutes?.avg != null ? fmtHours(s.sleep_minutes.avg) : '-'],
                      ['Avg active min', s.active_minutes?.avg != null ? `${s.active_minutes.avg} min` : '-']
                    ].map(([label, value]) => (
                      <div key={label} style={{ background: 'var(--color-bg)', padding: 10, borderRadius: 6 }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                    <MetricChart title="Steps" subtitle="Total per day" data={rows.map((d) => ({ date: d.date, value: d.steps || null }))} />
                    <MetricChart
                      title="Sleep"
                      subtitle="Hours slept"
                      format={(v) => `${v.toFixed(1)} h`}
                      data={rows.map((d) => ({ date: d.date, value: d.sleep_minutes ? d.sleep_minutes / 60 : null }))}
                    />
                  </div>
                </>
              )}
            </Card>

            {rows.length > 0 && <InsightsPanel analysis={w.analysis} periodDays={days} audience="doctor" />}
          </>
        )}
      </div>
    </PageTransition>
  );
}

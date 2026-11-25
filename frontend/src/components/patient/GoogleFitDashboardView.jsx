import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Footprints, HeartPulse, Moon, Flame, RefreshCw, Link2, Unlink, ShieldCheck, AlertTriangle, Table2, BarChart3, Loader2 } from 'lucide-react';
import { PageHeader, LoadState, EmptyState } from '../ui';
import { PageTransition } from '../animations';
import MetricChart from '../fitness/MetricChart';
import InsightsPanel from '../fitness/InsightsPanel';
import { describeError } from '../../services/apiClient';
import {
  fitnessLive,
  getFitnessStatus,
  connectGoogleFit,
  syncGoogleFit,
  getFitnessMetrics,
  getFitnessInsights,
  disconnectGoogleFit,
  lastDaysRange,
  consumeOAuthResult,
  OAUTH_RESULT_MESSAGES
} from '../../services/fitnessService';

const RANGES = [7, 14, 30, 90];
const AUTO_SYNC_AFTER_SEC = 60 * 60;
const hours = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
const when = (ts) => {
  const s = ts?._seconds ?? ts?.seconds;
  return typeof s === 'number' ? new Date(s * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'never';
};

function StatTile({ icon, label, value, hint }) {
  const Icon = icon;
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 700 }}>
        <Icon size={14} color="var(--color-primary-dark)" /> {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{hint}</div>}
    </div>
  );
}

export default function GoogleFitDashboardView({ onNotification }) {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [range, setRange] = useState(14);
  const [metrics, setMetrics] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState('');
  const [busy, setBusy] = useState(''); // 'connect' | 'sync' | 'disconnect'
  const [showTable, setShowTable] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const handledOAuth = useRef(false);

  const loadStatus = useCallback(async () => {
    setStatusError('');
    try {
      const s = await getFitnessStatus();
      setStatus(s);
      return s;
    } catch (err) {
      setStatusError(describeError(err));
      return null;
    }
  }, []);

  const loadMetrics = useCallback(async (days) => {
    setMetricsLoading(true);
    setMetricsError('');
    try {
      const [m, a] = await Promise.all([getFitnessMetrics(lastDaysRange(days)), getFitnessInsights(days)]);
      setMetrics(m);
      setAnalysis(a);
    } catch (err) {
      setMetricsError(describeError(err));
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const doSync = useCallback(async (days, { quiet = false } = {}) => {
    setBusy('sync');
    try {
      const r = await syncGoogleFit(days);
      setStatus(r.connection);
      if (!quiet) {
        onNotification?.(
          'Google Fit Synced',
          r.status === 'partial' ? 'Synced, but some data types could not be read.' : `Synced the last ${days} days.`
        );
      }
      await loadMetrics(range);
    } catch (err) {
      onNotification?.('Sync Failed', describeError(err));
      await loadStatus();
    } finally {
      setBusy('');
    }
  }, [loadMetrics, loadStatus, onNotification, range]);

  // First load: handle the OAuth redirect result, then status
  useEffect(() => {
    if (handledOAuth.current) return;
    handledOAuth.current = true;
    const result = consumeOAuthResult();
    (async () => {
      const s = await loadStatus();
      if (result) {
        const [title, message] = OAUTH_RESULT_MESSAGES[result] || OAUTH_RESULT_MESSAGES.error;
        onNotification?.(title, message);
        if (result === 'connected' && s?.status === 'connected') await doSync(90, { quiet: true });
      } else if (s?.status === 'connected') {
        // Live: refresh on open when the last sync is over an hour old (the server also syncs in the background)
        const lastSec = s.last_sync_at?._seconds ?? s.last_sync_at?.seconds ?? 0;
        if (Date.now() / 1000 - lastSec > AUTO_SYNC_AFTER_SEC) await doSync(7, { quiet: true });
      }
    })();
  }, [loadStatus, doSync, onNotification]);

  useEffect(() => {
    if (status?.status === 'connected' || status?.status === 'revoked') loadMetrics(range);
  }, [status?.status, range, loadMetrics]);

  const handleConnect = async () => {
    setBusy('connect');
    try {
      await connectGoogleFit(); // navigates away to Google
    } catch (err) {
      onNotification?.('Could Not Connect', describeError(err));
      setBusy('');
    }
  };

  const handleDisconnect = async (purge) => {
    setBusy('disconnect');
    setConfirmDisconnect(false);
    try {
      await disconnectGoogleFit({ purge });
      setMetrics(null);
      await loadStatus();
      onNotification?.('Google Fit Disconnected', purge ? 'Access revoked and your synced data was deleted.' : 'Access revoked. Previously synced data is kept.');
    } catch (err) {
      onNotification?.('Disconnect Failed', describeError(err));
    } finally {
      setBusy('');
    }
  };

  const header = (
    <PageHeader
      title="Google Fit"
      icon={Activity}
      description="Steps, heart rate, sleep and activity from your Google Fit account. Read-only; you can disconnect at any time."
      badge={
        <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ShieldCheck size={12} /> Tokens stay on our server, encrypted
        </span>
      }
    />
  );

  if (!fitnessLive()) {
    return (
      <PageTransition>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {header}
          <EmptyState icon={Activity} title="Not available in Sandbox mode" description="Sign in to the live portal to connect your Google Fit account." />
        </div>
      </PageTransition>
    );
  }

  if (!status) {
    return (
      <PageTransition>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {header}
          <LoadState loading={!statusError} error={statusError} onRetry={loadStatus} label="Checking your Google Fit connection..." />
        </div>
      </PageTransition>
    );
  }

  const days = metrics?.days || [];
  const s = metrics?.summary || {};
  const connected = status.status === 'connected';

  return (
    <PageTransition>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {header}

        {/* Connection card */}
        <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              Connection:
              {connected && <span className="badge badge-primary">Connected</span>}
              {status.status === 'not_connected' && <span className="badge badge-muted">Not connected</span>}
              {status.status === 'pending' && <span className="badge badge-muted">Not connected</span>}
              {status.status === 'revoked' && <span className="badge badge-warning">Access revoked</span>}
              {status.status === 'not_configured' && <span className="badge badge-muted">Unavailable</span>}
            </div>
            {connected && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Last sync: {when(status.last_sync_at)}
                {status.last_sync_status === 'partial' && ' (partial)'} · Permissions: {(status.scopes || []).map((sc) => sc.split('.').slice(-2, -1)[0]).join(', ')}
              </div>
            )}
            {status.status === 'revoked' && (
              <div style={{ fontSize: 12, color: '#B9770E', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={13} /> Google Fit access was removed (in your Google account or it expired). Reconnect to resume syncing. Data already synced is shown below.
              </div>
            )}
            {status.status === 'not_configured' && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>The administrator has not configured Google Fit on this server yet.</div>
            )}
            {connected && status.last_error && <div style={{ fontSize: 12, color: '#B9770E' }}>{status.last_error}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(status.status === 'not_connected' || status.status === 'pending' || status.status === 'revoked') && (
              <button type="button" className="btn btn-primary" onClick={handleConnect} disabled={Boolean(busy)}>
                {busy === 'connect' ? <Loader2 size={16} className="spin-anim" /> : <Link2 size={16} />}
                <span>{status.status === 'revoked' ? 'Reconnect Google Fit' : 'Connect Google Fit'}</span>
              </button>
            )}
            {connected && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => doSync(Math.max(range, 7))} disabled={Boolean(busy)}>
                  {busy === 'sync' ? <Loader2 size={16} className="spin-anim" /> : <RefreshCw size={16} />}
                  <span>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</span>
                </button>
                {!confirmDisconnect ? (
                  <button type="button" className="btn btn-outline" onClick={() => setConfirmDisconnect(true)} disabled={Boolean(busy)}>
                    <Unlink size={16} /> <span>Disconnect</span>
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-outline" onClick={() => handleDisconnect(false)} disabled={Boolean(busy)}>Disconnect, keep data</button>
                    <button type="button" className="btn btn-danger" onClick={() => handleDisconnect(true)} disabled={Boolean(busy)}>Disconnect & delete data</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmDisconnect(false)}>Cancel</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {status.status === 'not_connected' || status.status === 'pending' ? (
          <EmptyState
            icon={Activity}
            title="Connect Google Fit to see your activity"
            description="Works with Google Fit and any Android fitness app that syncs into it (directly or through Health Connect, e.g. Samsung Health, Mi Fitness, Zepp). iPhone / Apple Health cannot sync live. We only request read access to activity, heart rate and sleep; your Google tokens stay encrypted on our server, never in your browser."
          />
        ) : status.status === 'not_configured' ? null : (
          <>
            {/* Filters: one row above the charts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div className="segmented-control" role="group" aria-label="Date range">
                {RANGES.map((d) => (
                  <button key={d} type="button" className={`segmented-tab ${range === d ? 'active' : ''}`} onClick={() => setRange(d)}>
                    {d} days
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? <BarChart3 size={14} /> : <Table2 size={14} />} <span>{showTable ? 'Show charts' : 'Show table'}</span>
              </button>
            </div>

            <LoadState loading={metricsLoading && !metrics} error={metricsError} onRetry={() => loadMetrics(range)} label="Loading your metrics..." />

            {metrics && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                  <StatTile icon={Footprints} label="AVG DAILY STEPS" value={s.steps?.avg != null ? s.steps.avg.toLocaleString() : '-'} hint={s.steps?.days_with_data ? `${s.steps.days_with_data} days with data` : 'No data'} />
                  <StatTile icon={HeartPulse} label="AVG HEART RATE" value={s.heart_rate_avg?.avg != null ? `${s.heart_rate_avg.avg} bpm` : '-'} hint="Daily average" />
                  <StatTile icon={Moon} label="AVG SLEEP" value={s.sleep_minutes?.avg != null ? hours(s.sleep_minutes.avg) : '-'} hint={s.sleep_minutes?.days_with_data ? `${s.sleep_minutes.days_with_data} nights logged` : 'No sleep logged'} />
                  <StatTile icon={Activity} label="AVG ACTIVE MINUTES" value={s.active_minutes?.avg != null ? `${s.active_minutes.avg} min` : '-'} hint="Move minutes per day" />
                  <StatTile icon={Flame} label="AVG CALORIES" value={s.calories?.avg != null ? `${s.calories.avg.toLocaleString()} kcal` : '-'} hint="Energy expended per day" />
                </div>

                {days.length > 0 && <InsightsPanel analysis={analysis} periodDays={range} />}

                {days.length === 0 && (
                  <EmptyState icon={Activity} title="No data for this period" description={connected ? 'Press "Sync now" to fetch your latest Google Fit data.' : 'Reconnect Google Fit to sync new data.'} />
                )}

                {days.length > 0 && !showTable && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                    <MetricChart title="Steps" subtitle="Total per day" data={days.map((d) => ({ date: d.date, value: d.steps || null }))} />
                    <MetricChart
                      title="Heart rate"
                      subtitle="Daily average, bpm"
                      kind="line"
                      minFloor={30}
                      format={(v) => `${v} bpm`}
                      data={days.map((d) => ({
                        date: d.date,
                        value: d.heart_rate_avg,
                        extra: d.heart_rate_min != null ? `range ${d.heart_rate_min}–${d.heart_rate_max} bpm` : null
                      }))}
                    />
                    <MetricChart title="Sleep" subtitle="Hours slept, by wake-up day" format={(v) => `${v.toFixed(1)} h`} data={days.map((d) => ({ date: d.date, value: d.sleep_minutes ? d.sleep_minutes / 60 : null }))} />
                    <MetricChart title="Active minutes" subtitle="Move minutes per day" format={(v) => `${v} min`} data={days.map((d) => ({ date: d.date, value: d.active_minutes || null }))} />
                  </div>
                )}

                {days.length > 0 && showTable && (
                  <div className="card" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--color-text-muted)' }}>
                          {['Date', 'Steps', 'Avg HR (bpm)', 'HR range', 'Sleep', 'Active min', 'Calories'].map((h) => (
                            <th key={h} style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...days].reverse().map((d) => (
                          <tr key={d.date}>
                            <td style={{ padding: '6px 8px' }}>{d.date}</td>
                            <td style={{ padding: '6px 8px' }}>{d.steps != null ? d.steps.toLocaleString() : '-'}</td>
                            <td style={{ padding: '6px 8px' }}>{d.heart_rate_avg ?? '-'}</td>
                            <td style={{ padding: '6px 8px' }}>{d.heart_rate_min != null ? `${d.heart_rate_min}–${d.heart_rate_max}` : '-'}</td>
                            <td style={{ padding: '6px 8px' }}>{d.sleep_minutes ? hours(d.sleep_minutes) : '-'}</td>
                            <td style={{ padding: '6px 8px' }}>{d.active_minutes ?? '-'}</td>
                            <td style={{ padding: '6px 8px' }}>{d.calories != null ? d.calories.toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}

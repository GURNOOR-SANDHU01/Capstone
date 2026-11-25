import React, { useMemo, useState } from 'react';

/**
 * Single-series daily chart (bars for totals, line for heart rate), plain SVG.
 * - One series => no legend; the title names it. One y-axis only.
 * - Mark color is the brand primary (#4CAF91, < 3:1 vs white), so values are always reachable
 *   through the hover tooltip and the page's table view; text uses text tokens, never the mark color.
 * - Days without data show no mark and "No data" in the tooltip (never drawn as zero).
 */
const W = 640;
const H = 200;
const M = { top: 12, right: 12, bottom: 26, left: 44 };
const MARK = '#4CAF91';
const GRID = '#E8EAE8';
const SURFACE = '#FFFFFF';

const compact = (v) => (v >= 10000 ? `${Math.round(v / 1000)}K` : v.toLocaleString());

function niceMax(max) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max / 1) * pow;
  return step;
}

const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });

export default function MetricChart({ title, subtitle, data, kind = 'bar', format = (v) => v.toLocaleString(), minFloor = 0 }) {
  const [hover, setHover] = useState(null);
  const values = data.map((d) => d.value).filter((v) => typeof v === 'number');
  const hasData = values.length > 0;

  const { yMin, yMax, ticks } = useMemo(() => {
    const max = niceMax(Math.max(...values, 0) * 1.05);
    const min = kind === 'line' && values.length ? Math.max(minFloor, Math.floor((Math.min(...values) - 10) / 10) * 10) : 0;
    return { yMin: min, yMax: Math.max(max, min + 10), ticks: [min, min + (max - min) / 2, max] };
  }, [values, kind, minFloor]);

  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const n = Math.max(data.length, 1);
  const band = innerW / n;
  const barW = Math.max(2, Math.min(24, band - 2));
  const x = (i) => M.left + band * i + band / 2;
  const y = (v) => M.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const baseline = M.top + innerH;

  const labelIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  const linePath = useMemo(() => {
    if (kind !== 'line') return '';
    let d = '';
    let pen = false;
    data.forEach((p, i) => {
      if (typeof p.value !== 'number') {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
      pen = true;
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kind, yMin, yMax]);

  const barPath = (i, v) => {
    const top = y(v);
    const h = baseline - top;
    const r = Math.min(4, h, barW / 2);
    const x0 = x(i) - barW / 2;
    // rounded data-end, square at the baseline
    return `M${x0},${baseline}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + barW - r}Q${x0 + barW},${top} ${x0 + barW},${top + r}V${baseline}Z`;
  };

  const hovered = hover !== null ? data[hover] : null;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{subtitle}</div>}
      </div>
      <div style={{ position: 'relative' }}>
        {!hasData && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
            No data for this period
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title} chart`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
              <text x={M.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6F7280">{compact(Math.round(t))}</text>
            </g>
          ))}
          {labelIdx.map((i) => data[i] && (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="#6F7280">
              {shortDate(data[i].date)}
            </text>
          ))}

          {kind === 'bar' && data.map((p, i) => (typeof p.value === 'number' && p.value > 0 ? (
            <path key={p.date} d={barPath(i, p.value)} fill={MARK} opacity={hover === null || hover === i ? 1 : 0.55} />
          ) : null))}

          {kind === 'line' && (
            <>
              {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={baseline} stroke="#B8BCC2" strokeWidth="1" />}
              <path d={linePath} fill="none" stroke={MARK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {data.map((p, i) => (typeof p.value === 'number' && (hover === i || n <= 31) ? (
                <circle key={p.date} cx={x(i)} cy={y(p.value)} r={hover === i ? 5 : 4} fill={MARK} stroke={SURFACE} strokeWidth="2" />
              ) : null))}
            </>
          )}

          {/* Hit targets: the whole day band, bigger than the mark */}
          {data.map((p, i) => (
            <rect
              key={`hit-${p.date}`}
              x={M.left + band * i}
              y={M.top}
              width={band}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={`${shortDate(p.date)}: ${typeof p.value === 'number' ? format(p.value) : 'no data'}`}
            />
          ))}
        </svg>
        {hovered && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              top: 0,
              left: `${(x(hover) / W) * 100}%`,
              transform: `translateX(${hover > n / 2 ? '-105%' : '5%'})`,
              background: '#1A1A2E',
              color: '#fff',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            <div style={{ opacity: 0.8 }}>{shortDate(hovered.date)}</div>
            <strong>{typeof hovered.value === 'number' ? format(hovered.value) : 'No data'}</strong>
            {hovered.extra && <div style={{ opacity: 0.8 }}>{hovered.extra}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

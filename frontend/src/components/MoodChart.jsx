import React from 'react';

/**
 * MoodChart Component
 * SVG weekly sentiment trend graph.
 * 
 * @param {Array} data - Array of Objects: [{ day: "Mon", score: 68 }, ...]
 */
export default function MoodChart({ data = [] }) {
  const chartData = data.length > 0 ? data : [
    { day: "Mon", score: 65 },
    { day: "Tue", score: 72 },
    { day: "Wed", score: 58 },
    { day: "Thu", score: 68 },
    { day: "Fri", score: 80 },
    { day: "Sat", score: 88 },
    { day: "Sun", score: 76 }
  ];

  const width = 500;
  const height = 180;
  const padding = 30;

  const minScore = 0;
  const maxScore = 100;

  // Calculate coordinates
  const points = chartData.map((d, i) => {
    const x = padding + (i / (chartData.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.score - minScore) / (maxScore - minScore)) * (height - padding * 2);
    return { x, y, day: d.day, score: d.score };
  });

  const pathD = points.reduce((acc, point, i) => {
    return i === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: "100%", height: "auto", minWidth: 320 }}
        role="img"
        aria-label="Weekly mood trend chart"
      >
        {/* Background Area Gradient */}
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4CAF91" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4CAF91" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines */}
        {[25, 50, 75].map((val) => {
          const y = height - padding - (val / 100) * (height - padding * 2);
          return (
            <line
              key={val}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#E8EAE8"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Gradient Fill */}
        <path d={areaD} fill="url(#chartGradient)" />

        {/* Trend Line */}
        <path d={pathD} fill="none" stroke="#4CAF91" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data Points and Labels */}
        {points.map((pt, i) => (
          <g key={i}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r="5"
              fill="#FFFFFF"
              stroke="#4CAF91"
              strokeWidth="3"
            />
            {/* Score label above point */}
            <text
              x={pt.x}
              y={pt.y - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="var(--color-primary-dark)"
            >
              {pt.score}%
            </text>
            {/* Day label on X axis */}
            <text
              x={pt.x}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--color-text-muted)"
            >
              {pt.day}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';

const PROGRESS_DATA = [52, 58, 64, 69, 72, 78];

const DOMAIN_TRENDS = [
  { name: 'Data Gathering', score: 82, delta: '+14%', positive: true },
  { name: 'Clinical Management', score: 71, delta: '+8%', positive: true },
  { name: 'Interpersonal Skills', score: 88, delta: '+12%', positive: true },
];

const STATS = [
  { value: '6', label: 'sessions completed', highlight: false },
  { value: '78', label: 'average score', highlight: false },
  { value: '12%', label: 'improvement', highlight: true },
];

export default function ChapterProgress() {
  const maxY = 100;
  const minY = 40;
  const chartWidth = 100;
  const chartHeight = 120;
  const points = PROGRESS_DATA.map((val, i) => ({
    x: (i / (PROGRESS_DATA.length - 1)) * chartWidth,
    y: chartHeight - ((val - minY) / (maxY - minY)) * chartHeight,
  }));

  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className="p-7">
      {/* Progress chart */}
      <div className="mb-6">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">
          Your Progress
        </div>
        <div className="relative" style={{ height: chartHeight + 24 }}>
          <svg
            viewBox={`-4 -4 ${chartWidth + 8} ${chartHeight + 28}`}
            className="w-full"
            preserveAspectRatio="none"
          >
            {/* Area fill */}
            <motion.path
              d={areaPath}
              fill="rgba(180,83,9,0.06)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            />
            {/* Line */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="#B45309"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            />
            {/* Latest point dot */}
            <motion.circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3"
              fill="#B45309"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.4, type: 'spring' }}
            />
            {/* X-axis labels */}
            {points.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={chartHeight + 16}
                textAnchor="middle"
                className="fill-stone-400"
                style={{ fontSize: '8px', fontFamily: 'monospace' }}
              >
                S{i + 1}
              </text>
            ))}
          </svg>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-6" />

      {/* Domain trends */}
      <div className="flex flex-col gap-3 mb-6">
        {DOMAIN_TRENDS.map((d) => (
          <div key={d.name} className="flex items-center justify-between">
            <span className="text-[12px] text-stone-500">{d.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-heading">{d.score}%</span>
              <span
                className={`text-[11px] font-medium ${d.positive ? 'text-success' : 'text-muted'}`}
              >
                ↑ {d.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-6" />

      {/* Stats row */}
      <div className="flex items-center">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center flex-1 ${
              i > 0 ? 'border-l border-black/[0.06]' : ''
            }`}
          >
            <motion.span
              className={`text-[24px] font-semibold ${
                stat.highlight ? 'text-success' : 'text-heading'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.15 }}
            >
              {stat.value}
            </motion.span>
            <span className="text-[11px] text-muted text-center">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

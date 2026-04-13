'use client';

import { motion } from 'framer-motion';

const DOMAINS = [
  { label: 'Data Gathering', pct: 82, descriptor: 'Clear & systematic' },
  { label: 'Clinical Management', pct: 71, descriptor: 'Adequate' },
  { label: 'Interpersonal Skills', pct: 88, descriptor: 'Excellent' },
];

const STRENGTHS = [
  'Open questions exploring ICE throughout',
  'Good rapport and active listening',
  'Appropriate use of signposting',
];

const IMPROVEMENTS = [
  'Safety-net for red flag symptoms earlier',
  'Explore patient\'s health beliefs more',
];

export default function ChapterScore() {
  return (
    <div className="p-5">
      {/* Score hero — prominent centered score */}
      <div className="text-center mb-5">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-3">
          Session Complete
        </div>
        <div className="relative inline-flex items-center justify-center mb-3">
          {/* Score ring */}
          <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="rgba(0,0,0,0.04)"
              strokeWidth="8"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - 0.78) }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#B45309" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-[36px] font-extrabold leading-none"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
            >
              78
            </motion.span>
            <span className="text-[10px] text-muted">out of 100</span>
          </div>
        </div>
        <motion.div
          className="inline-flex px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.8 }}
        >
          ✓ Pass
        </motion.div>
      </div>

      {/* Domain breakdown */}
      <div className="mb-5">
        <div className="flex flex-col gap-3">
          {DOMAINS.map((d, i) => (
            <motion.div
              key={d.label}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + i * 0.12 }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-stone-600 font-medium">{d.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{d.descriptor}</span>
                    <span className="font-mono text-[12px] font-bold text-heading">{d.pct}%</span>
                  </div>
                </div>
                <div className="h-2.5 bg-black/[0.04] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.pct}%` }}
                    transition={{
                      type: 'spring',
                      stiffness: 40,
                      damping: 18,
                      delay: 1.0 + i * 0.15,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-4" />

      {/* Two-column feedback: strengths + improvements */}
      <div className="grid grid-cols-2 gap-4">
        {/* Strengths */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
              <span className="text-[8px] text-success">✓</span>
            </div>
            <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.08em]">
              Strengths
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {STRENGTHS.map((s, i) => (
              <motion.div
                key={i}
                className="text-[11px] text-stone-500 leading-[1.5] pl-3"
                style={{ borderLeft: '2px solid rgba(34,197,94,0.3)' }}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.3 + i * 0.08 }}
              >
                {s}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Improvements */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.1)' }}>
              <span className="text-[8px] text-amber-600">⚡</span>
            </div>
            <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.08em]">
              To Improve
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {IMPROVEMENTS.map((s, i) => (
              <motion.div
                key={i}
                className="text-[11px] text-stone-500 leading-[1.5] pl-3"
                style={{ borderLeft: '2px solid rgba(217,119,6,0.3)' }}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.3 + i * 0.08 }}
              >
                {s}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

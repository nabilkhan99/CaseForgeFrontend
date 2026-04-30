'use client';

import { motion } from 'framer-motion';

const DOMAINS = [
  { label: 'Data Gathering', pct: 82, descriptor: 'Clear & systematic' },
  { label: 'Clinical Management', pct: 71, descriptor: 'Adequate' },
  { label: 'Interpersonal Skills', pct: 88, descriptor: 'Excellent' },
];

export default function ChapterScore() {
  return (
    <div className="p-5">
      {/* Score + pass — compact horizontal layout */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" className="transform -rotate-90">
            <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="6" />
            <motion.circle
              cx="44"
              cy="44"
              r="38"
              fill="none"
              stroke="url(#scoreGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 38}
              initial={{ strokeDashoffset: 2 * Math.PI * 38 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 38 * (1 - 0.78) }}
              transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
            />
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#B45309" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-[28px] font-extrabold leading-none"
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
            <span className="text-[9px] text-muted">out of 100</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <motion.div
            className="inline-flex px-3 py-1 rounded-full text-[10px] font-semibold uppercase mb-2"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.8 }}
          >
            Pass
          </motion.div>
          <div className="text-[11px] text-muted leading-[1.6]">
            Scored across all three SCA domains with{' '}
            <span className="text-heading font-medium">14 personalised insights</span>{' '}
            from your consultation.
          </div>
        </div>
      </div>

      {/* Domain bars — compact */}
      <div className="flex flex-col gap-2 mb-4">
        {DOMAINS.map((d, i) => (
          <motion.div
            key={d.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 + i * 0.1 }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] text-stone-600 font-medium">{d.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted">{d.descriptor}</span>
                <span className="font-mono text-[11px] font-bold text-heading">{d.pct}%</span>
              </div>
            </div>
            <div className="h-2 bg-black/[0.04] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
                initial={{ width: 0 }}
                animate={{ width: `${d.pct}%` }}
                transition={{ type: 'spring', stiffness: 40, damping: 18, delay: 1.0 + i * 0.12 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Key moment highlight */}
      <motion.div
        className="rounded-xl mb-4 px-3.5 py-3"
        style={{
          background: 'linear-gradient(135deg, rgba(180,83,9,0.04), rgba(245,158,11,0.06))',
          borderLeft: '3px solid #D97706',
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-semibold text-primary uppercase tracking-wider">Key Moment</span>
          <span className="text-[9px] font-mono text-muted">2:34</span>
        </div>
        <div className="text-[12px] text-heading font-medium italic leading-[1.5] mb-1">
          &ldquo;What are you most worried this headache might be?&rdquo;
        </div>
        <div className="text-[10px] text-stone-500 leading-[1.6]">
          This open question uncovered the patient&apos;s fear of a brain tumour — a turning point that shaped your clinical management positively.
        </div>
      </motion.div>

    </div>
  );
}

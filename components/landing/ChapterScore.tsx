'use client';

import { motion } from 'framer-motion';

const DOMAINS = [
  { label: 'Data Gathering', pct: 82 },
  { label: 'Clinical Management', pct: 71 },
  { label: 'Interpersonal Skills', pct: 88 },
];

const FEEDBACK = [
  {
    icon: '✓',
    color: '#B45309',
    text: "Strong open questions exploring the patient's ideas, concerns, and expectations throughout the consultation",
  },
  {
    icon: '⚡',
    color: '#D97706',
    text: 'Consider safety-netting for red flag symptoms earlier — ask about visual disturbance, neck stiffness, and fever',
  },
];

export default function ChapterScore() {
  return (
    <div className="p-7">
      {/* Score header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-1">
            Session Complete
          </div>
          <div className="flex items-end gap-1.5">
            <motion.span
              className="text-[56px] font-extrabold leading-none"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              78
            </motion.span>
            <span className="text-[13px] text-muted mb-2">out of 100 · Station 14</span>
          </div>
        </div>
        <motion.div
          className="px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.4 }}
        >
          ✓ Pass
        </motion.div>
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-6" />

      {/* Domain scores */}
      <div className="flex flex-col gap-4 mb-6">
        {DOMAINS.map((d, i) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-[13px] text-stone-500 w-[140px] font-medium flex-shrink-0">
              {d.label}
            </span>
            <div className="flex-1 h-2 bg-black/[0.04] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
                initial={{ width: 0 }}
                animate={{ width: `${d.pct}%` }}
                transition={{
                  type: 'spring',
                  stiffness: 40,
                  damping: 18,
                  delay: 0.5 + i * 0.15,
                }}
              />
            </div>
            <span className="font-mono text-[13px] font-semibold text-heading w-[36px] text-right">
              {d.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-6" />

      {/* Feedback items */}
      <div className="flex flex-col gap-2.5">
        {FEEDBACK.map((item, i) => (
          <motion.div
            key={i}
            className="flex items-start gap-2.5 p-3.5 rounded-xl text-[13px] text-stone-500 leading-[1.6]"
            style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 + i * 0.1 }}
          >
            <span className="flex-shrink-0 mt-0.5" style={{ color: item.color }}>
              {item.icon}
            </span>
            {item.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

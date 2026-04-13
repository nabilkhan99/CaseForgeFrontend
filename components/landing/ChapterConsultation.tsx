'use client';

import { motion } from 'framer-motion';

// Large dynamic waveform — 48 bars, varying heights, staggered animation
function LargeWaveform() {
  const barCount = 48;
  return (
    <div className="flex items-center justify-center gap-[4px] h-24 w-full">
      {Array.from({ length: barCount }).map((_, i) => {
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const maxHeight = 100 - dist * 60;
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: '4px',
              background: `linear-gradient(180deg, #B45309 0%, rgba(217,119,6,${0.3 + (1 - dist) * 0.7}) 100%)`,
            }}
            animate={{
              height: [
                `${12 + Math.sin(i * 0.6) * 8}%`,
                `${maxHeight * (0.4 + Math.sin(i * 0.4 + 1) * 0.6)}%`,
                `${12 + Math.sin(i * 0.6 + 2) * 8}%`,
              ],
            }}
            transition={{
              duration: 1.0 + (i % 5) * 0.12,
              repeat: Infinity,
              delay: (i % 7) * 0.06,
              ease: 'easeInOut',
            }}
          />
        );
      })}
    </div>
  );
}

export default function ChapterConsultation() {
  return (
    <div className="flex flex-col">
      {/* Patient header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/[0.04]">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
        >
          MT
        </div>
        <div>
          <div className="text-[13px] font-semibold text-heading">Mrs. Thompson</div>
          <div className="text-[11px] text-muted">Headache · 3 days</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-success"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-[10px] font-semibold text-success uppercase tracking-[0.04em]">
            Live
          </span>
        </div>
      </div>

      {/* Voice consultation — full, dramatic layout */}
      <div className="flex flex-col items-center justify-center px-8 py-10 min-h-[320px]">
        {/* Pulsing avatar with expanding rings */}
        <motion.div
          className="relative mb-6"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 16 }}
        >
          {/* Outer pulse ring */}
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: '-20px',
              border: '1.5px solid rgba(180,83,9,0.08)',
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Middle pulse ring */}
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: '-10px',
              border: '2px solid rgba(180,83,9,0.15)',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          />
          {/* Inner glow */}
          <motion.div
            className="absolute rounded-full"
            style={{
              inset: '-4px',
              background: 'radial-gradient(circle, rgba(180,83,9,0.12) 0%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center text-white text-[24px] font-semibold"
            style={{
              background: 'linear-gradient(135deg, #F59E0B, #B45309)',
              boxShadow: '0 8px 32px rgba(180,83,9,0.3)',
            }}
          >
            MT
          </div>
        </motion.div>

        {/* Speaking label */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="text-[12px] font-semibold text-primary uppercase tracking-[0.1em] mb-1"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            Patient Speaking
          </motion.div>
          <div className="text-[13px] text-muted">Mrs. Thompson is responding...</div>
        </motion.div>

        {/* LARGE dynamic waveform — full width */}
        <motion.div
          className="w-full mb-8"
          initial={{ opacity: 0, scaleY: 0.5 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 80, damping: 16 }}
        >
          <LargeWaveform />
        </motion.div>

        {/* Recording indicator */}
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <motion.div
            className="w-2 h-2 rounded-full bg-red-400"
            animate={{ opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="font-mono">Recording · 03:34 elapsed</span>
        </div>
      </div>

      {/* Voice controls bar */}
      <div
        className="px-5 py-4 border-t border-black/[0.05] flex items-center justify-center gap-6"
        style={{ background: 'rgba(255,252,248,0.8)', backdropFilter: 'blur(12px)' }}
      >
        {/* Mute button */}
        <div className="w-11 h-11 rounded-full flex items-center justify-center border border-black/[0.08] cursor-pointer hover:bg-black/[0.02] transition-colors">
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="text-muted">
            <path d="M7 1v12M4 4v6M10 3v8M1 6v2M13 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Mic button (active) — larger */}
        <motion.div
          className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #B45309, #D97706)',
            boxShadow: '0 6px 24px rgba(180,83,9,0.3)',
          }}
          animate={{ boxShadow: ['0 6px 24px rgba(180,83,9,0.3)', '0 8px 32px rgba(180,83,9,0.45)', '0 6px 24px rgba(180,83,9,0.3)'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="18" height="20" viewBox="0 0 12 14" fill="white">
            <path d="M6 0C4.35 0 3 1.35 3 3v5c0 1.65 1.35 3 3 3s3-1.35 3-3V3c0-1.65-1.35-3-3-3z" />
          </svg>
        </motion.div>

        {/* End consultation button */}
        <div className="w-11 h-11 rounded-full flex items-center justify-center bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';

// Circular audio visualizer — concentric rings that pulse
function AudioVisualizer() {
  const rings = 5;
  return (
    <div className="relative w-48 h-48">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(180,83,9,0.06) 0%, transparent 70%)',
        }}
      />
      {/* Concentric pulse rings */}
      {Array.from({ length: rings }).map((_, i) => {
        const size = 60 + i * 24;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `calc(50% - ${size / 2}px)`,
              top: `calc(50% - ${size / 2}px)`,
              border: `${i === 0 ? 2 : 1.5}px solid rgba(180,83,9,${0.25 - i * 0.04})`,
            }}
            animate={{
              scale: [1, 1 + (i + 1) * 0.04, 1],
              opacity: [0.6 - i * 0.08, 0.2, 0.6 - i * 0.08],
            }}
            transition={{
              duration: 1.6 + i * 0.3,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.15,
            }}
          />
        );
      })}
      {/* Center avatar */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center text-white text-[20px] font-semibold"
        style={{
          background: 'linear-gradient(135deg, #F59E0B, #B45309)',
          boxShadow: '0 8px 32px rgba(180,83,9,0.35)',
        }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        JT
      </motion.div>
    </div>
  );
}

// Horizontal waveform — bar-style EQ
function BarWaveform() {
  const barCount = 56;
  return (
    <div className="flex items-center justify-center gap-[3px] h-16 w-full">
      {Array.from({ length: barCount }).map((_, i) => {
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const maxH = 100 - dist * 55;
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: '3px',
              background: `linear-gradient(180deg, rgba(180,83,9,${0.8 - dist * 0.4}) 0%, rgba(245,158,11,${0.2 + (1 - dist) * 0.3}) 100%)`,
            }}
            animate={{
              height: [
                `${10 + Math.sin(i * 0.5) * 6}%`,
                `${maxH * (0.3 + Math.sin(i * 0.35 + 1) * 0.7)}%`,
                `${10 + Math.sin(i * 0.5 + 2) * 6}%`,
              ],
            }}
            transition={{
              duration: 0.8 + (i % 6) * 0.1,
              repeat: Infinity,
              delay: (i % 8) * 0.05,
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
          JT
        </div>
        <div>
          <div className="text-[13px] font-semibold text-heading">Jack Thompson</div>
          <div className="text-[11px] text-muted">ECG request · Running club</div>
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

      {/* Main voice area */}
      <div className="flex flex-col items-center justify-center px-6 py-8 min-h-[340px]">
        {/* Circular audio visualizer */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 80, damping: 16 }}
        >
          <AudioVisualizer />
        </motion.div>

        {/* Speaking indicator */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="text-[12px] font-semibold text-primary uppercase tracking-[0.1em] mb-0.5"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            Patient Speaking
          </motion.div>
          <div className="text-[12px] text-muted">David Thompson is responding...</div>
        </motion.div>

        {/* Bar waveform — full width */}
        <motion.div
          className="w-full mb-6"
          initial={{ opacity: 0, scaleY: 0.5 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 80, damping: 16 }}
        >
          <BarWaveform />
        </motion.div>

        {/* Status row */}
        <div className="flex items-center justify-center gap-6 text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-red-400"
              animate={{ opacity: [1, 0.3, 1], scale: [1, 0.85, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="font-mono">Recording</span>
          </div>
          <div className="w-px h-3 bg-black/[0.08]" />
          <span className="font-mono">03:34 / 12:00</span>
          <div className="w-px h-3 bg-black/[0.08]" />
          <span className="font-mono text-primary font-semibold">54% remaining</span>
        </div>
      </div>

      {/* Voice controls bar */}
      <div
        className="px-5 py-4 border-t border-black/[0.05] flex items-center justify-between"
        style={{ background: 'rgba(255,252,248,0.8)', backdropFilter: 'blur(12px)' }}
      >
        {/* Left: notepad */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-black/[0.08] cursor-pointer hover:bg-black/[0.02] transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-muted">
            <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 4.5h4M5 7h4M5 9.5h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </div>

        {/* Center: mic */}
        <div className="flex items-center gap-3">
          <motion.div
            className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #B45309, #D97706)',
              boxShadow: '0 4px 16px rgba(180,83,9,0.25)',
            }}
            animate={{
              boxShadow: [
                '0 4px 16px rgba(180,83,9,0.25)',
                '0 6px 20px rgba(180,83,9,0.35)',
                '0 4px 16px rgba(180,83,9,0.25)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1C5.62 1 4.5 2.12 4.5 3.5v3.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V3.5C9.5 2.12 8.38 1 7 1z" fill="white" />
              <path d="M3 6.5v.5a4 4 0 0 0 8 0v-.5M7 11v2M5 13h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </motion.div>
        </div>

        {/* Right: End consultation button */}
        <div className="px-3.5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          <span className="text-[11px] font-semibold text-red-600">End consultation</span>
        </div>
      </div>
    </div>
  );
}

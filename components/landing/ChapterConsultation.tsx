'use client';

import { motion } from 'framer-motion';
import WaveformBars from './WaveformBars';

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

      {/* Voice consultation area */}
      <div className="flex flex-col items-center justify-center py-12 px-6 min-h-[260px] gap-6">
        {/* Patient speaking indicator */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
          {/* Pulsing avatar ring */}
          <div className="relative">
            <motion.div
              className="absolute inset-[-6px] rounded-full"
              style={{ border: '2px solid rgba(180,83,9,0.2)' }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-[-12px] rounded-full"
              style={{ border: '1.5px solid rgba(180,83,9,0.1)' }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            />
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[20px] font-semibold"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
            >
              MT
            </div>
          </div>

          <div className="text-center">
            <motion.div
              className="text-[11px] font-semibold text-primary uppercase tracking-[0.08em] mb-1"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              Patient Speaking
            </motion.div>
            <div className="text-[12px] text-muted">Mrs. Thompson is responding...</div>
          </div>
        </motion.div>

        {/* Large waveform visualization */}
        <div className="w-full max-w-[320px]">
          <WaveformBars active bars={32} className="h-12" />
        </div>

        {/* Elapsed time */}
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="font-mono">Recording · 03:34 elapsed</span>
        </div>
      </div>

      {/* Voice controls bar */}
      <div
        className="px-5 py-4 border-t border-black/[0.05] flex items-center justify-center gap-6"
        style={{ background: 'rgba(255,252,248,0.8)', backdropFilter: 'blur(12px)' }}
      >
        {/* Mute button */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center border border-black/[0.08] cursor-pointer hover:bg-black/[0.02] transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-muted">
            <path d="M7 1v12M4 4v6M10 3v8M1 6v2M13 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>

        {/* Mic button (active) */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #B45309, #D97706)',
            boxShadow: '0 4px 16px rgba(180,83,9,0.25)',
          }}
        >
          <svg width="16" height="18" viewBox="0 0 12 14" fill="white">
            <path d="M6 0C4.35 0 3 1.35 3 3v5c0 1.65 1.35 3 3 3s3-1.35 3-3V3c0-1.65-1.35-3-3-3z" />
          </svg>
        </div>

        {/* End consultation button */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

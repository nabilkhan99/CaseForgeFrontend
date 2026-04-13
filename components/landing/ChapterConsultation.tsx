'use client';

import { motion } from 'framer-motion';
import WaveformBars from './WaveformBars';

const MESSAGES = [
  {
    role: 'patient' as const,
    text: "I've had this terrible headache for three days now. It's mostly in the mornings when I wake up.",
  },
  {
    role: 'doctor' as const,
    text: "I'm sorry to hear that, Mrs. Thompson. Can you show me where exactly you feel the pain?",
  },
  {
    role: 'patient' as const,
    text: "It's right here, at the back of my head. Sometimes behind my eyes too. I'm worried it might be something serious.",
  },
  {
    role: 'doctor' as const,
    text: 'I understand your concern. Have you noticed anything else — any changes in your vision, or feeling sick with it?',
  },
];

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

      {/* Transcript */}
      <div className="p-5 flex flex-col gap-3 min-h-[200px]">
        {MESSAGES.map((msg, i) => (
          <motion.div
            key={i}
            className={`flex ${msg.role === 'doctor' ? 'justify-end' : 'justify-start'}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24, delay: i * 0.15 }}
          >
            <div
              className={`max-w-[75%] px-4 py-3 text-[13px] leading-[1.6] ${
                msg.role === 'patient'
                  ? 'bg-black/[0.03] border border-black/[0.05] text-body rounded-2xl rounded-bl-sm'
                  : 'text-white rounded-2xl rounded-br-sm'
              }`}
              style={
                msg.role === 'doctor'
                  ? { background: 'linear-gradient(135deg, #B45309, #D97706)' }
                  : {}
              }
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Voice bar */}
      <div
        className="px-5 py-3 border-t border-black/[0.05] flex items-center gap-3"
        style={{ background: 'rgba(255,252,248,0.8)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex-1">
          <WaveformBars active bars={24} />
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="white">
            <path d="M6 0C4.35 0 3 1.35 3 3v5c0 1.65 1.35 3 3 3s3-1.35 3-3V3c0-1.65-1.35-3-3-3z" />
          </svg>
        </div>
        <span className="text-[12px] font-mono text-muted w-12 text-right">04:26</span>
      </div>
    </div>
  );
}

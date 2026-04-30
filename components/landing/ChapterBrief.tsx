'use client';

import { motion } from 'framer-motion';

export default function ChapterBrief() {
  return (
    <div className="p-5">
      {/* Patient identity */}
      <div className="mb-4">
        <div className="grid grid-cols-1 gap-1.5">
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-black/[0.02]">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide w-[110px] flex-shrink-0 pt-0.5">
              Patient Name
            </span>
            <span className="text-[13px] font-semibold text-heading">Jack Thompson</span>
          </div>
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-black/[0.02]">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide w-[110px] flex-shrink-0 pt-0.5">
              Age
            </span>
            <span className="text-[12px] text-stone-600">12 (DOB: 14/05/2013)</span>
          </div>
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-black/[0.02]">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide w-[110px] flex-shrink-0 pt-0.5">
              Father&apos;s Name
            </span>
            <span className="text-[12px] text-stone-600">David Thompson</span>
          </div>
        </div>
      </div>

      {/* Situation */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Situation
        </div>
        <p className="text-[13px] text-body leading-[1.7]">
          Video or Telephone Consultation.
        </p>
      </div>

      {/* Reason for encounter */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Reason for Encounter
        </div>
        <div
          className="px-4 py-3 rounded-xl text-[13px] text-heading leading-[1.7] font-medium italic"
          style={{
            background: 'linear-gradient(135deg, rgba(180,83,9,0.04), rgba(245,158,11,0.04))',
            borderLeft: '3px solid #B45309',
          }}
        >
          &ldquo;Father requesting an ECG for his son. Jack has joined a running club and the father
          is worried about &lsquo;Sudden Death&rsquo;.&rdquo;
        </div>
      </div>

      {/* CTA */}
      <motion.div
        className="w-full py-3.5 rounded-xl text-center text-[14px] font-semibold text-white cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #B45309, #D97706)',
          boxShadow: '0 4px 12px rgba(180,83,9,0.2)',
        }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        Begin consultation →
      </motion.div>
    </div>
  );
}

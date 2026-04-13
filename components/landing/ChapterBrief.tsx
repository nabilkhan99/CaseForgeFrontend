'use client';

import { motion } from 'framer-motion';

export default function ChapterBrief() {
  return (
    <div className="p-6">
      {/* Patient identity row */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-semibold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
        >
          MT
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-heading">Mrs. Margaret Thompson</div>
          <div className="text-[12px] text-muted">62 · Female · Retired teacher</div>
        </div>
        <div
          className="px-3 py-1 rounded-full text-[11px] font-semibold font-mono flex-shrink-0"
          style={{ background: 'rgba(180,83,9,0.08)', color: '#B45309' }}
        >
          12 min
        </div>
      </div>

      <div className="border-t border-black/[0.05] mb-5" />

      <div className="mb-5">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Presenting Complaint
        </div>
        <p className="text-[15px] text-body leading-[1.7]">
          Headache for three days, worse in the mornings. Patient is concerned about the severity.
        </p>
      </div>

      <div className="mb-6">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Your Task
        </div>
        <p className="text-[15px] text-body leading-[1.7]">
          Explore the patient&apos;s symptoms, address their concerns, and formulate an appropriate
          management plan.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {['Data Gathering', 'Clinical Management', 'Interpersonal Skills'].map((domain) => (
          <span
            key={domain}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
          >
            {domain}
          </span>
        ))}
      </div>

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

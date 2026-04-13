'use client';

import { motion } from 'framer-motion';

const MEDICAL_HISTORY = [
  { label: 'PMH', value: 'Hypertension, Type 2 Diabetes' },
  { label: 'Medications', value: 'Amlodipine 5mg, Metformin 500mg BD' },
  { label: 'Allergies', value: 'Penicillin (rash)' },
];

export default function ChapterBrief() {
  return (
    <div className="p-5">
      {/* Patient identity — richer layout */}
      <div className="flex items-start gap-4 mb-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-[18px] font-semibold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #B45309)',
            boxShadow: '0 4px 16px rgba(180,83,9,0.2)',
          }}
        >
          MT
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold text-heading mb-0.5">
            Mrs. Margaret Thompson
          </div>
          <div className="text-[12px] text-muted mb-2">62 · Female · Retired teacher</div>
          <div className="flex items-center gap-2">
            <div
              className="px-2.5 py-1 rounded-md text-[10px] font-semibold font-mono"
              style={{ background: 'rgba(180,83,9,0.08)', color: '#B45309' }}
            >
              12 min
            </div>
            <div className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-black/[0.03] text-stone-500">
              Station 14
            </div>
            <div className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700">
              Neurology
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-4" />

      {/* Presenting complaint — highlighted */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Presenting Complaint
        </div>
        <div
          className="px-4 py-3 rounded-xl text-[14px] text-heading leading-[1.7] font-medium"
          style={{
            background: 'linear-gradient(135deg, rgba(180,83,9,0.04), rgba(245,158,11,0.04))',
            borderLeft: '3px solid #B45309',
          }}
        >
          Headache for three days, worse in the mornings. Patient is concerned about the severity
          and worried it might be &quot;something serious.&quot;
        </div>
      </div>

      {/* Your task */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Your Task
        </div>
        <p className="text-[13px] text-body leading-[1.7]">
          Explore the patient&apos;s symptoms, address their concerns, and formulate an appropriate
          management plan.
        </p>
      </div>

      {/* Medical history — compact grid */}
      <div className="mb-5">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Key Information
        </div>
        <div className="flex flex-col gap-1.5">
          {MEDICAL_HISTORY.map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-2 px-3 py-2 rounded-lg bg-black/[0.02]"
            >
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide w-[80px] flex-shrink-0 pt-0.5">
                {item.label}
              </span>
              <span className="text-[12px] text-stone-600">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Domain tags */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { name: 'Data Gathering', icon: '🔍' },
          { name: 'Clinical Management', icon: '📋' },
          { name: 'Interpersonal Skills', icon: '🤝' },
        ].map((domain) => (
          <span
            key={domain.name}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
            style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
          >
            <span className="text-[10px]">{domain.icon}</span>
            {domain.name}
          </span>
        ))}
      </div>

      {/* Timer countdown bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-muted">Reading time remaining</span>
          <span className="text-[12px] font-mono font-semibold text-primary">02:00</span>
        </div>
        <div className="h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
            initial={{ width: '100%' }}
            animate={{ width: '65%' }}
            transition={{ duration: 2, ease: 'easeOut', delay: 0.5 }}
          />
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

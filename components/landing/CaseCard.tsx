'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface CaseCardProps {
  className?: string;
}

const CASE_DATA = {
  patientName: 'Mrs. Margaret Thompson',
  initials: 'MT',
  age: 62,
  gender: 'Female',
  occupation: 'Retired teacher',
  duration: 12,
  presentingComplaint:
    'Headache for three days, worse in the mornings. Patient is concerned about the severity.',
  task: "Explore the patient's symptoms, address their concerns, and formulate an appropriate management plan.",
  domains: ['Data Gathering', 'Clinical Management', 'Interpersonal Skills'],
};

export default function CaseCard({ className = '' }: CaseCardProps) {
  return (
    <motion.div
      className={`relative max-w-[480px] w-full mx-auto ${className}`}
      initial={{ opacity: 0, y: 30, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.8 }}
    >
      <div
        className="relative rounded-[20px] overflow-hidden border border-black/[0.06]"
        style={{
          background: '#FFFCF8',
          boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)',
        }}
      >
        {/* Amber left accent */}
        <div
          className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full"
          style={{ background: 'linear-gradient(180deg, #B45309, #D97706)' }}
        />

        <div className="p-6 pl-7">
          {/* Patient identity row */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-semibold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
            >
              {CASE_DATA.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-heading">
                {CASE_DATA.patientName}
              </div>
              <div className="text-[12px] text-muted">
                {CASE_DATA.age} · {CASE_DATA.gender} · {CASE_DATA.occupation}
              </div>
            </div>
            <div
              className="px-3 py-1 rounded-full text-[11px] font-semibold font-mono flex-shrink-0"
              style={{ background: 'rgba(180,83,9,0.08)', color: '#B45309' }}
            >
              {CASE_DATA.duration} min
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-black/[0.05] mb-5" />

          {/* Presenting complaint */}
          <div className="mb-5">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Presenting Complaint
            </div>
            <p className="text-[15px] text-body leading-[1.7]">
              {CASE_DATA.presentingComplaint}
            </p>
          </div>

          {/* Your task */}
          <div className="mb-6">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Your Task
            </div>
            <p className="text-[15px] text-body leading-[1.7]">{CASE_DATA.task}</p>
          </div>

          {/* Domain tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CASE_DATA.domains.map((domain) => (
              <span
                key={domain}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
              >
                {domain}
              </span>
            ))}
          </div>

          {/* CTA */}
          <Link href="/waitlist" className="block">
            <motion.div
              className="w-full py-3.5 rounded-xl text-center text-[14px] font-semibold text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                boxShadow: '0 4px 12px rgba(180,83,9,0.2)',
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Join the waitlist →
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function CTASection() {
  return (
    <motion.section
      className="max-w-[1200px] mx-auto px-12 py-20 text-center relative"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ type: 'spring', stiffness: 80, damping: 20 }}
    >
      {/* Ambient gradient orb behind */}
      <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(180,83,9,0.04)_0%,transparent_55%)] pointer-events-none" />

      <h2 className="text-[52px] font-extrabold text-heading tracking-[-0.04em] leading-[1.05] mb-4 relative z-[1]">
        Ready to
        <br />
        <em className="gradient-text not-italic">start practising?</em>
      </h2>

      <p className="text-[17px] text-[#78716C] leading-[1.6] max-w-[440px] mx-auto mb-9 relative z-[1]">
        Your first case is free. No sign-up, no credit card. Pick a case and start speaking.
      </p>

      <Link href="/try" className="primary-button text-[16px] px-9 py-4 relative z-[1]">
        Try a free case
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>

      <div className="flex justify-center gap-8 mt-7 relative z-[1]">
        {['Free forever tier', 'No credit card', 'Instant feedback'].map((text) => (
          <span key={text} className="text-[12px] text-muted flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px] text-primary">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4 12 14.01l-3-3" />
            </svg>
            {text}
          </span>
        ))}
      </div>
    </motion.section>
  );
}

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function PortfolioPreview() {
  return (
    <section className="py-[80px] px-6">
      <div className="max-w-[800px] mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <span className="text-[10px] font-mono font-semibold tracking-[0.12em] uppercase text-primary block mb-4">
            Portfolio AI Tool
          </span>
          <h2 className="text-[28px] sm:text-[36px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mb-4">
            Write clinical case reviews in seconds
          </h2>
          <p className="text-[16px] text-muted max-w-[520px] mx-auto mb-3">
            Our AI tool generates RCGP-standard clinical case reviews for your portfolio. Describe your case, select your capabilities, and get a structured review ready to submit.
          </p>
          <p className="text-[14px] text-primary font-medium mb-8">
            Used by over 20% of GP trainees in the UK
          </p>
          <Link href="/portfolio">
            <motion.div
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-semibold text-primary border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/[0.03] transition-all cursor-pointer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Try Portfolio AI Tool →
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

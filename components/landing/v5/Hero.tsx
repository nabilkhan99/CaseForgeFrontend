'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#1C1C1A] px-5 pb-10 pt-28 text-center sm:px-8 sm:pb-16 sm:pt-28">
      <div className="mx-auto max-w-4xl">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-[#FAC775] sm:mb-6 sm:text-sm"
        >
          For GP trainees preparing for the SCA
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mb-5 font-[family-name:var(--font-display)] text-3xl font-medium leading-[1.35] text-white sm:mb-6 sm:text-5xl lg:text-6xl"
        >
          <span className="whitespace-nowrap">
            Fail your SCA? We pay you <span className="text-[#EF9F27]">£500</span>.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.14 }}
          className="mb-1 text-sm font-medium text-white sm:text-lg"
        >
          The only complete SCA Course
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mb-8 max-w-md text-xs leading-relaxed text-[#B4B2A9] sm:mb-10 sm:max-w-lg sm:text-base"
        >
          AI Practice <span className="text-[#6E6D68]">+</span> On-demand
          Lectures <span className="text-[#6E6D68]">+</span> Small-Group
          Coaching
        </motion.p>

        <motion.a
          href="/try"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.26 }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#EF9F27] px-7 py-3 text-sm font-semibold text-[#2C2C2A] shadow-[0_3px_12px_rgba(186,117,23,0.45)] transition-transform hover:scale-[1.03] sm:px-9 sm:py-4 sm:text-base"
        >
          Try Free Mock Station
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </motion.a>
      </div>
    </section>
  );
}

'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { CROSSHATCH } from './editorial';

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden px-5 pb-8 pt-24 text-center sm:px-8 sm:pb-12 sm:pt-28"
      style={CROSSHATCH}
    >
      {/* Warm glow behind the headline */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[820px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(217,119,6,0.10) 0%, rgba(217,119,6,0.03) 55%, transparent 75%)',
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-4xl">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-4 sm:mb-5"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FAEEDA] px-4 py-1.5 text-xs font-semibold text-[#854F0B] sm:text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B45309]" aria-hidden="true" />
            The £500 SCA guarantee
          </span>
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mb-5 font-[family-name:var(--font-display)] text-[2.9rem] font-bold leading-[1.04] tracking-[-0.03em] text-heading sm:mb-6 sm:text-7xl lg:text-[6.5rem]"
        >
          We&apos;re betting
          <span className="my-1.5 block sm:my-2.5">
            <span className="inline-block rounded-2xl bg-[#E7F1D6] px-4 pb-1 pt-0.5 text-[#4A6B1F] sm:rounded-[1.75rem] sm:px-7">
              £500
            </span>
          </span>
          that you&apos;ll pass.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.14 }}
          className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-body sm:mb-8 sm:max-w-2xl sm:text-lg"
        >
          Pass all 200 mock stations, fail your real SCA, and we pay you £500
          cash.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.a
            href="/try"
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 rounded-full bg-[#B45309] px-8 py-4 text-base font-semibold text-white shadow-[0_4px_16px_rgba(180,83,9,0.4),inset_0_1px_0_rgba(255,255,255,0.18)] sm:px-10 sm:py-[1.15rem] sm:text-lg"
          >
            Try Free Mock Station
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </motion.a>
          <p className="mt-4 text-xs text-[#78716C] sm:text-sm">
            12 minutes · no card
          </p>
        </motion.div>
      </div>
    </section>
  );
}

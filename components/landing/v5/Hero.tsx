'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-32 text-center sm:px-8 sm:pb-16 sm:pt-40">
      <div className="mx-auto max-w-4xl">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-6 sm:mb-8"
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
          className="mb-6 font-[family-name:var(--font-display)] text-[2.6rem] font-medium leading-[1.12] tracking-tight text-heading sm:mb-8 sm:text-6xl lg:text-7xl"
        >
          We&apos;re betting{' '}
          <span className="whitespace-nowrap rounded-xl bg-[#EAF3DE] px-2.5 py-0.5 text-[#3D6212] sm:rounded-2xl sm:px-4">
            £500
          </span>{' '}
          that you&apos;ll pass.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.14 }}
          className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-body sm:mb-10 sm:max-w-xl sm:text-lg"
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

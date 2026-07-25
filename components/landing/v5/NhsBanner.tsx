'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function NhsBanner() {
  return (
    <section className="px-5 py-4 sm:px-8 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-5xl items-center gap-3 rounded-2xl bg-[#EAF3DE] px-5 py-4 sm:gap-4 sm:px-8 sm:py-6"
      >
        <Check
          className="h-5 w-5 flex-shrink-0 text-[#3B6D11] sm:h-6 sm:w-6"
          aria-hidden="true"
        />
        <p className="text-xs leading-relaxed text-[#27500A] sm:text-base">
          Eligible for the NHS England study budget. Most trainees pay nothing
          out of pocket.{' '}
          {/* DEV-HANDOFF §9: keep the "check your deanery" reassurance on-site
              at the point of purchase instead of sending buyers to a PDF. */}
          <Link
            href="/study-budget/"
            className="font-semibold underline underline-offset-2 hover:text-[#1C1917]"
          >
            Check your deanery&rsquo;s policy
          </Link>
          .
        </p>
      </motion.div>
    </section>
  );
}

'use client';

import { motion } from 'framer-motion';
import { TESTIMONIALS } from '@/lib/testimonials';
import { TILE } from './editorial';

export default function Testimonials() {
  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      {/* overflow-y-hidden is load-bearing: setting only overflow-x makes the
          CSS-computed overflow-y `auto`, so the carousel scrolled vertically
          as well as horizontally on mobile. */}
      <div className="mx-auto flex max-w-5xl snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden pt-1 pb-5 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pt-0 sm:pb-0">
        {/* Cards stretch to the tallest in their row (flex on phones, grid from
            sm up), and the min-height is the floor under that, so a shorter
            quote never leaves one card smaller than its neighbours. Each step
            sits just under the tallest card's natural height at that
            breakpoint, measured with the September 2026 quotes (about 394px on
            a 430px phone, 648px at 768, 447px at 1024, 402px from 1200 up), so
            the floor adds no empty space below the text. Re-measure if the
            quotes change length. */}
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={`flex min-h-[22rem] w-[80%] flex-shrink-0 snap-start flex-col ${TILE} p-6 sm:min-h-[36rem] sm:w-auto sm:p-7 md:min-h-[27rem] lg:min-h-[25rem]`}
          >
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full">
                <img
                  src={t.image}
                  alt={t.name}
                  width={68}
                  height={68}
                  className={`h-full w-full rounded-full object-cover ${t.imageClass ?? ''}`}
                />
              </span>
              <span>
                <span className="block text-sm font-semibold text-heading">{t.name}</span>
                <span className="block text-xs text-muted">{t.meta}</span>
              </span>
              <span
                className="ml-auto text-[11px] tracking-widest text-[#EF9F27]"
                aria-label="5 out of 5 stars"
              >
                ★★★★★
              </span>
            </div>
            <blockquote className="mt-5 flex-1">
              <p className="text-[15px] leading-[1.65] text-body">{t.quote}</p>
            </blockquote>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

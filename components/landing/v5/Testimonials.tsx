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
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={`flex w-[80%] flex-shrink-0 snap-start flex-col ${TILE} p-6 sm:w-auto sm:p-7`}
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

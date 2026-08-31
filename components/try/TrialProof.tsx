'use client';

import { motion } from 'framer-motion';
import { TESTIMONIALS_FOR_TRIAL } from '@/lib/testimonials';

/**
 * Three quotes, between the free mock's feedback report and the plans.
 *
 * The landing page is where these lived and the only place they were shown,
 * which left the highest-intent screen in the product — the moment someone has
 * just finished a consultation, read their marks, and is about to look at the
 * price — carrying no evidence from anyone but us.
 *
 * Quote text on a warm ground rather than three cards: this page already has a
 * report above it and a pricing table below, and a third boxed thing between
 * them reads as a widget to scroll past.
 *
 * Each quote is a trim of a longer one, shown with a leading ellipsis so that
 * is visible. The full text and the substring guard live in `lib/testimonials`.
 */
export default function TrialProof() {
  return (
    <section
      aria-labelledby="trial-proof-heading"
      className="border-t border-[#E4DDC9] bg-[#FDF6E7]"
    >
      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-7 sm:py-12 lg:px-10">
        <h2
          id="trial-proof-heading"
          className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#854F0B] sm:text-xs"
        >
          What other registrars say
        </h2>

        <div className="mt-8 grid gap-9 sm:mt-10 sm:grid-cols-3 sm:gap-7">
          {TESTIMONIALS_FOR_TRIAL.map((t, i) => (
            <motion.figure
              key={t.name}
              className="flex flex-col gap-4"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
            >
              <blockquote className="text-[16px] font-medium leading-[1.45] tracking-[-0.015em] text-heading sm:text-[17px]">
                &ldquo;&hellip;{t.short}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full">
                  {/* Decorative: the name sits next to it in the same caption. */}
                  <img
                    src={t.image}
                    alt=""
                    width={72}
                    height={72}
                    className={`h-full w-full rounded-full object-cover ${t.imageClass ?? ''}`}
                  />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-heading">{t.name}</span>
                  <span className="block text-[12px] text-muted">{t.meta}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

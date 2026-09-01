'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { CROSSHATCH } from './editorial';

/**
 * Homepage hero, built from the design canvas: "Homepage - Study Budget First
 * v2", section 1. That section is the finished form of variant 3a in the
 * "Hero Highlight Tests" artboard ("1b treatment with the itemised receipt
 * alongside, badged eyebrow"), which sits at the top of that file as the
 * chosen direction.
 *
 * The argument the canvas makes, in order: the course costs you nothing
 * because your deanery funds it, and if it does not work we pay you £500. The
 * receipt card is what makes the first half credible, so it earns its place
 * beside the headline rather than below it.
 *
 * One correction to the canvas: it reads "10 hours of lectures", which the
 * copy change of 29 August retired. Eight is the current figure everywhere
 * else on the site.
 */

/** The itemised receipt, exactly as the canvas orders it. */
const LINE_ITEMS: ReadonlyArray<{ label: string; amount: string }> = [
  { label: '200 AI stations, unlimited', amount: '£299' },
  { label: '8 hours of lectures', amount: '£599' },
  { label: '8-hour live coaching day', amount: '£599' },
];

export default function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      className="relative overflow-hidden border-b border-[#E4DDC9] px-5 pb-14 pt-28 sm:px-8 sm:pb-16 sm:pt-32"
      style={CROSSHATCH}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[-14%] h-[520px] w-[900px] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(217,119,6,0.10) 0%, rgba(217,119,6,0.03) 55%, transparent 75%)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-[1160px] items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
        {/* Left: the claim. Centred on phones — the column is the whole
            viewport there, so left-ragged type reads as unfinished. */}
        <div className="text-center sm:text-left">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-5"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-[#B45309] px-3.5 py-2 text-[13px] font-medium text-[#FFF7E4]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FAC775]" aria-hidden="true" />
              For GP Trainees preparing for the SCA
            </span>
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06 }}
            className="mb-5 font-[family-name:var(--font-display)] text-[2.4rem] font-semibold leading-[1.05] tracking-[-0.03em] text-heading sm:text-[3.1rem] lg:text-[3.25rem]"
          >
            Costs you{' '}
            <span className="text-[#A8A29E] line-through decoration-[3px]">£599</span>{' '}
            <span className="text-[#B45309]">£0.</span>
            <br />
            Fail? We pay you{' '}
            {/* The stamp. Rotated and scaled in on load, because the canvas
                treats this figure as the thing that stops the scroll. */}
            <motion.span
              initial={reduceMotion ? false : { scale: 1.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, rotate: -2 }}
              transition={{
                duration: 0.52,
                delay: 0.42,
                ease: [0.34, 1.56, 0.64, 1],
              }}
              style={{ rotate: -2 }}
              className="inline-block rounded-[10px] bg-[#B45309] px-[15px] pb-[7px] pt-1 text-[2rem] text-[#FFFBEB] sm:text-[2.6rem]"
            >
              £500
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mx-auto mb-7 max-w-[31em] text-base leading-relaxed text-body sm:mx-0 sm:text-[19px] sm:leading-[1.55]"
          >
            Most deaneries fund an SCA preparation course, so you won&rsquo;t be
            out of pocket. Plus: pass all our mock stations, fail your real SCA,
            and we send you £500.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
          >
            {/* "2d" treatment — quiet outline: ink keyline on cream, amber arrow disc */}
            <motion.a
              href="/try"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-3.5 rounded-full border-[3px] border-[#1C1917] bg-[#FFFDFA] py-2.5 pl-7 pr-2.5 text-lg font-bold tracking-[-0.01em] text-[#1C1917] sm:gap-4 sm:py-3 sm:pl-9 sm:pr-3 sm:text-xl"
            >
              Try Free Mock Station
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#B45309] text-[#FFF8EF] sm:h-[52px] sm:w-[52px]"
                aria-hidden="true"
              >
                <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
            </motion.a>
            <p className="mt-4 text-xs text-[#78716C] sm:text-sm">12 minutes · no card</p>
          </motion.div>
        </div>

        {/* Right: what it actually costs, itemised */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
          className="rounded-2xl border border-[#E4DDC9] bg-white px-6 py-6 shadow-[0_24px_48px_-34px_rgba(28,25,23,0.3)] sm:px-7"
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-[#78716C]">
            What it costs you
          </p>
          <p className="mb-3.5 text-[13.5px] text-[#A8A29E]">
            The Complete SCA Course, itemised
          </p>

          {LINE_ITEMS.map(item => (
            <div
              key={item.label}
              className="flex items-baseline justify-between border-b border-[#F5F0E7] py-2.5"
            >
              <span className="text-[15px] text-body">{item.label}</span>
              <span className="font-mono text-[14.5px] text-[#78716C]">{item.amount}</span>
            </div>
          ))}

          <div className="flex items-baseline justify-between border-b border-[#E4DDC9] py-3">
            <span className="text-[15px] font-semibold text-heading">Total value</span>
            <span className="font-mono text-[15px] font-medium text-heading">£1,497</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-[#F5F0E7] py-3">
            <span className="text-[15px] text-body">Course price</span>
            <span className="font-mono text-[15px] text-heading">£599</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-[#F5F0E7] py-2.5">
            <span className="text-[15px] text-body">Study budget (GP0001)</span>
            <span className="font-mono text-[15px] text-[#B45309]">&minus; £599</span>
          </div>

          <div className="flex items-center justify-between pb-1 pt-4">
            <span className="text-[16.5px] font-semibold text-heading">Cost to you</span>
            <span className="font-[family-name:var(--font-display)] text-[40px] font-semibold leading-none tracking-[-0.03em] text-[#B45309]">
              £0
            </span>
          </div>

          <p className="mt-2.5 text-[13px] leading-relaxed text-[#78716C]">
            Caps vary by region.{' '}
            <a
              href="#funding"
              className="underline decoration-[#d9cdb3] underline-offset-4 transition-colors hover:text-heading"
            >
              Check yours below.
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { StationsPassed } from '@/lib/stations/passedProgress';

export interface StationsPassedBarProps {
  progress: StationsPassed;
  /** Trial addresses a first sitting; dashboard states the offer plainly. */
  variant?: 'dashboard' | 'trial';
  /**
   * The colour behind the bar. The ticks are cut out of the fill in this
   * colour, so a mismatch shows as 199 hairlines in the wrong shade.
   */
  ground?: string;
  className?: string;
}

/**
 * Stations passed, out of the two hundred the guarantee names.
 *
 * Deliberately labelled "Stations passed" and not "Guarantee progress": the
 * guarantee has no written terms yet, and a bar captioned as progress *towards*
 * it becomes the definition of it by default — whatever the bar counts is what
 * a customer will reasonably believe qualifies them. As a plain count of work
 * done it says something true on its own, and the £500 sentence sits beside it
 * as copy rather than as a running tally of what is owed.
 *
 * Two hundred discrete ticks rather than a smooth bar, because one tick is one
 * station: it is what makes 1/200 legible on the free-station page and what
 * makes 41/200 feel earned on the dashboard. At narrow widths the ticks blur
 * into a plain bar, which is the right thing to degrade to.
 */
export default function StationsPassedBar({
  progress,
  variant = 'dashboard',
  ground = '#FAFAF7',
  className = '',
}: StationsPassedBarProps) {
  const reduceMotion = useReducedMotion();
  const { passed, attempted, total, percent } = progress;
  const remaining = Math.max(0, total - passed);

  // 0.5% of the width per station (200 of them), with the last sixth of each
  // step cut away as the gap.
  const tickStyle: CSSProperties = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0 0.34%, ${ground} 0.34% 0.5%)`,
  };

  return (
    <section aria-labelledby="stations-passed-heading" className={className}>
      <div className="flex flex-col gap-4">
        <div>
          <h2
            id="stations-passed-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"
          >
            Stations passed
          </h2>
          <p className="mt-1.5 text-[36px] font-extrabold leading-none tracking-[-0.035em] text-heading tabular-nums sm:text-[40px]">
            {passed}
            <span className="font-bold text-[#A8A29E]"> / {total}</span>
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            {attempted === 1 ? '1 station attempted' : `${attempted} stations attempted`}
          </p>
        </div>

        <div
          className="relative h-5 w-full"
          role="progressbar"
          aria-valuenow={passed}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuetext={`${passed} of ${total} stations passed`}
        >
          <div className="absolute inset-0 rounded-sm bg-[#E4DDC9]" />
          <motion.div
            className="absolute inset-y-0 left-0 rounded-sm bg-primary"
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 22 }}
          />
          {/* Cuts the bar into one tick per station. Purely decorative. */}
          <div className="absolute inset-0 rounded-sm" style={tickStyle} aria-hidden="true" />
        </div>

        {variant === 'trial' ? (
          <p className="max-w-[42ch] text-[14px] leading-relaxed text-body">
            {passed > 0 ? (
              <span className="font-semibold text-heading">{remaining} to go. </span>
            ) : (
              <span className="font-semibold text-heading">That one didn&rsquo;t pass yet. </span>
            )}
            Pass all {total} before your sitting and still fail the SCA — we pay you £500.
          </p>
        ) : (
          <p className="max-w-[42ch] text-[14px] leading-relaxed text-body">
            Pass all {total} before your sitting. Still fail the SCA and we pay you{' '}
            <span className="font-semibold text-heading">£500</span>.
          </p>
        )}
      </div>
    </section>
  );
}

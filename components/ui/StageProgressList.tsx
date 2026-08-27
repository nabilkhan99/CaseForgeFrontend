'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface StageProgressListProps {
  /**
   * Names of work the engine genuinely does, in the order it does it. Do not
   * put anything here the engine does not actually run — the whole point of the
   * list is that it is the one part of the wait that is not invented.
   */
  stages: readonly string[];
  /** How long each stage stays lit before the next one does, in ms. */
  stageMs: number;
  /** Accessible name for the list. */
  label: string;
  className?: string;
}

/**
 * A named-stage log for a wait whose engine reports no progress back to us.
 *
 * Shared by the marking wait (FeedbackReport) and the trend build
 * (app/dashboard/trend), which is why it lives here rather than in either.
 *
 * The pacing is a pace, not a measurement: both engines run server-side and
 * return nothing until the finished row lands, so the list advances on a timer
 * and holds on the last stage rather than pretending to complete. What makes
 * that honest rather than theatre is that the *labels* are real — each one
 * names work the engine demonstrably does — and that nothing here states a
 * duration, a percentage, or an ARIA value. A named stage that sits for thirty
 * seconds reads as work; a bare spinner reads as a hang.
 *
 * Accessibility: the tick marks are aria-hidden, so the list never *claims* a
 * stage finished. It exposes only which stage is current (aria-current="step"),
 * which is true by construction.
 */
export default function StageProgressList({
  stages,
  stageMs,
  label,
  className,
}: StageProgressListProps) {
  const [stage, setStage] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => (s < stages.length - 1 ? s + 1 : s));
    }, stageMs);
    return () => clearInterval(id);
  }, [stages.length, stageMs]);

  return (
    <ol className={className ?? 'space-y-0.5'} aria-label={label}>
      {stages.map((stageLabel, i) => {
        const done = i < stage;
        const live = i === stage;
        return (
          <li
            key={stageLabel}
            aria-current={live ? 'step' : undefined}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] transition-colors duration-300 ${
              live ? 'bg-primary/[0.07] text-heading font-medium' : done ? 'text-body' : 'text-muted'
            }`}
          >
            <span
              className={`flex-none grid place-items-center w-[15px] h-[15px] rounded-full border-2 transition-colors duration-300 ${
                done ? 'border-success bg-success' : live ? 'border-primary' : 'border-black/15'
              }`}
            >
              {done ? (
                <svg viewBox="0 0 10 10" className="w-[7px] h-[7px]" aria-hidden="true">
                  <path
                    d="M1 5.2 3.6 7.8 9 2.4"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : live && !shouldReduceMotion ? (
                <motion.span
                  className="w-[5px] h-[5px] rounded-full bg-primary"
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                />
              ) : live ? (
                // Reduced motion: the same marker, resting. A perpetual pulse is
                // exactly the kind of animation prefers-reduced-motion asks us to drop.
                <span className="w-[5px] h-[5px] rounded-full bg-primary" />
              ) : null}
            </span>
            <span>{stageLabel}</span>
          </li>
        );
      })}
    </ol>
  );
}

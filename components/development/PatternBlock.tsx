'use client';

import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import EvidenceTable from '@/components/development/EvidenceTable';
import {
  TREND_DOMAIN_LABELS,
  type TrendPattern,
} from '@/lib/clinical-master/trendTypes';

/** Green for the model line's rule and label — the only green on the page besides ↗. */
const MODEL_GREEN = '#15803D';

interface PatternBlockProps {
  pattern: TrendPattern;
  /** 1-based; rendered as 01/02/03. */
  position: number;
  casesIncluded: number;
  titles: Map<string, string>;
}

/**
 * One thing costing marks, as a side-by-side.
 *
 * The two columns are the whole idea. "You closed too early" is a criticism;
 * their own sentence next to the sentence a passing candidate says at that same
 * moment is a comparison, and a comparison is something you can copy. The model
 * line is not italic where the quote is — one is a transcript, the other is a
 * demonstration, and italicising both would flatten them into the same kind of
 * thing.
 *
 * OPEN BY DEFAULT. Someone arriving here has one to three patterns, and
 * collapsing them would hide the entire content of the page behind three
 * clicks. The header stays a toggle so a pattern already worked on can be
 * folded away while reading the others.
 */
export default function PatternBlock({
  pattern,
  position,
  casesIncluded,
  titles,
}: PatternBlockProps) {
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const number = String(position).padStart(2, '0');

  return (
    <div className="py-6 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="-mx-2 flex w-full items-start gap-3 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-black/[0.02] focus-visible-ring"
      >
        <span className="mt-0.5 flex-shrink-0 font-mono text-[12px] tabular-nums text-[#A8A29E]">
          {number}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold leading-snug text-heading">
            {pattern.headline}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            {/* Neutral, not domain-tinted: the chip says which domain lost the
                marks, and a colour would quietly rank the three against each
                other on a page that never claims one matters more. */}
            <span
              className="rounded-[6px] px-1.5 py-0.5 text-[11px] font-semibold text-body"
              style={{ background: 'rgba(28,25,23,0.05)' }}
            >
              {TREND_DOMAIN_LABELS[pattern.domain]}
            </span>
            <span className="text-[12px] text-muted">
              in {pattern.frequency} of your last {casesIncluded} cases
            </span>
          </span>
        </span>

        <motion.svg
          className="mt-1 h-4 w-4 flex-shrink-0 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          // The block arrives open, so the chevron has to arrive pointing down
          // rather than animating there from a resting state nobody saw.
          initial={false}
          animate={{ rotate: open ? 90 : 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="pt-4 sm:pl-8">
              {/* The model side is given the wider column: it is the half a
                  reader is meant to leave with. */}
              <div className="flex flex-col gap-5 sm:flex-row sm:gap-7">
                <div className="min-w-0 flex-1 border-l-2 border-primary/30 pl-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                    In your consultation
                  </div>
                  <p className="mt-1.5 text-[13.5px] italic leading-[1.6] text-stone-600">
                    &ldquo;{pattern.your_quote}&rdquo;
                  </p>
                  {pattern.quote_gloss && (
                    <p className="mt-1.5 text-[12px] leading-[1.55] text-muted">
                      {pattern.quote_gloss}
                    </p>
                  )}
                </div>

                <div
                  className="min-w-0 border-l-2 pl-3.5 sm:flex-[1.2]"
                  style={{ borderColor: 'rgba(21,128,61,0.35)' }}
                >
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: MODEL_GREEN }}
                  >
                    What a model answer sounds like
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-[1.6] text-body">
                    {pattern.model_line}
                  </p>
                  {pattern.model_gloss && (
                    <p className="mt-1.5 text-[12px] leading-[1.55] text-muted">
                      {pattern.model_gloss}
                    </p>
                  )}
                </div>
              </div>

              {pattern.the_change && (
                <div
                  className="mt-5 rounded-[10px] p-3 sm:p-4"
                  style={{ background: 'rgba(180,83,9,0.05)' }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                    The change
                  </div>
                  <p className="mt-1 text-[13.5px] leading-[1.6] text-body">
                    {pattern.the_change}
                  </p>
                </div>
              )}

              <EvidenceTable evidence={pattern.evidence ?? []} titles={titles} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

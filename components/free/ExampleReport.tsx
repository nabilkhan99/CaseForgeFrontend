'use client';

import { motion, useReducedMotion } from 'framer-motion';
import ArcGauge from '@/components/ui/ArcGauge';
import {
  TONE_COLOUR,
  fmtMark,
  passMargin,
  passMarkFor,
  verdictForScore,
  verdictTone,
} from '@/lib/clinical-master/scoring';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';

/**
 * What a station gives you back, shown rather than described.
 *
 * The old /free spent its left column listing the terms of the offer. Nobody
 * needs the terms before they have seen the thing — they need to know that the
 * marking is real, specific and worth twelve minutes, and the only honest way
 * to say that is to put a report on the page.
 *
 * ## It is an example, and it says so
 *
 * The kicker carries the word. No name, no date, no session id: this is a
 * composed illustration of the shape of a result, not a screenshot of a real
 * trainee's, and it must never be readable as one. Nothing here is fetched.
 *
 * ## The numbers are derived, not typed
 *
 * The score is the one constant; the verdict, the pass mark and the margin all
 * come from `lib/clinical-master/scoring`, the same module the real report
 * uses. If the pass mark ever moves, this moves with it rather than quietly
 * becoming a lie on the most-linked page on the site.
 */

/** A near miss: the most useful result to show, and the most common one. */
const EXAMPLE_SCORE = 5.5;

/** Grades as the report prints them, in the order the report prints them. */
const EXAMPLE_DOMAINS: ReadonlyArray<{ label: string; outcome: 'pass' | 'fail' }> = [
  { label: 'Data gathering', outcome: 'pass' },
  { label: 'Clinical management', outcome: 'fail' },
  { label: 'Relating', outcome: 'pass' },
];

const ONE_CHANGE =
  'you named the diagnosis but never agreed the plan. Say what happens next, and when.';

export default function ExampleReport() {
  const reduceMotion = useReducedMotion();

  const max = MAX_WEIGHTED_SCORE;
  const passMark = passMarkFor(max);
  const verdict = verdictForScore(EXAMPLE_SCORE, max);
  const tone = verdictTone(verdict);
  const { margin } = passMargin(EXAMPLE_SCORE, max);

  return (
    <motion.figure
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.18 }}
      className="mt-9 rounded-[18px] border border-hairline bg-white/85 px-5 py-6 shadow-elevation-2 backdrop-blur sm:px-7"
    >
      <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:text-[11px]">
        What you get after a case, example
      </figcaption>

      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
        <div className="shrink-0">
          <ArcGauge
            value={EXAMPLE_SCORE}
            max={max}
            threshold={passMark}
            size={132}
            thickness={9}
            colour={TONE_COLOUR[tone]}
            label={`An example result: ${fmtMark(EXAMPLE_SCORE)} out of ${fmtMark(max)}, a ${verdict}. The pass mark is ${fmtMark(passMark)}.`}
          >
            <span className="font-mono text-[24px] font-bold leading-none tabular-nums text-heading">
              {EXAMPLE_SCORE.toFixed(1)}
            </span>
            <span className="mt-1 font-mono text-[11px] text-stone-400">/ {fmtMark(max)}</span>
          </ArcGauge>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          {/* One line, one element: "Bare Fail · 5.5 of 10.5 · you were 0.5
              short" reads as a single sentence, so it is a single sentence. */}
          <p className="text-[15px] leading-snug text-body sm:text-base">
            <span className="font-[family-name:var(--font-serif)] text-[21px] italic text-primary sm:text-[23px]">
              {verdict}
            </span>
            {` · ${fmtMark(EXAMPLE_SCORE)} of ${fmtMark(max)} · you were ${fmtMark(margin)} short`}
          </p>

          <p className="mt-3 border-t border-hairline pt-3 text-[13.5px] leading-relaxed text-muted">
            {EXAMPLE_DOMAINS.map((domain, index) => (
              <span key={domain.label}>
                {index > 0 && <span aria-hidden="true"> · </span>}
                {domain.label}{' '}
                <span
                  className={
                    domain.outcome === 'pass'
                      ? 'font-semibold text-green-700'
                      : 'font-semibold text-red-700'
                  }
                >
                  {domain.outcome}
                </span>
              </span>
            ))}
          </p>
        </div>
      </div>

      <p className="mt-5 border-t border-hairline pt-4 text-[14.5px] leading-relaxed text-body sm:text-[15px]">
        <span className="font-semibold text-heading">The one change:</span> {ONE_CHANGE}
      </p>
    </motion.figure>
  );
}

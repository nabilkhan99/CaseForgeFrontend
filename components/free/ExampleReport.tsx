'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
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
 * What a case gives you back, shown rather than described.
 *
 * Kept deliberately small: it sits beside the five cases, and its job is to
 * prove the marking is specific, not to compete with the list for attention.
 * A gauge, a verdict, the three domains as marks rather than a sentence, and
 * the one change.
 *
 * ## It is an example, and it says so
 *
 * No name, no date, no session id: this is a composed illustration of the
 * shape of a result, not a screenshot of a real trainee's, and it must never
 * be readable as one. Nothing here is fetched.
 *
 * ## The numbers are derived, not typed
 *
 * The score is the one constant; the verdict, the pass mark and the margin all
 * come from `lib/clinical-master/scoring`, the same module the real report
 * uses. If the pass mark ever moves, this moves with it.
 */

/** A near miss: the most useful result to show, and the most common one. */
const EXAMPLE_SCORE = 5.5;

/** Grades as the report prints them, in the order the report prints them. */
const EXAMPLE_DOMAINS: ReadonlyArray<{ label: string; outcome: 'pass' | 'fail' }> = [
  { label: 'Data gathering', outcome: 'pass' },
  { label: 'Clinical management', outcome: 'fail' },
  { label: 'Relating', outcome: 'pass' },
];

const ONE_CHANGE = 'Agree the plan. Say what happens next, and when.';

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
      transition={{ duration: 0.5, delay: 0.24 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-elevation-2 backdrop-blur sm:p-6"
    >
      <figcaption className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:text-[11px]">
        Example report
      </figcaption>

      <div className="mt-4 flex items-center gap-5">
        <ArcGauge
          value={EXAMPLE_SCORE}
          max={max}
          threshold={passMark}
          size={84}
          thickness={7}
          colour={TONE_COLOUR[tone]}
          label={`An example result: ${fmtMark(EXAMPLE_SCORE)} out of ${fmtMark(max)}, a ${verdict}. The pass mark is ${fmtMark(passMark)}.`}
        >
          <span className="font-mono text-[17px] font-bold leading-none tabular-nums text-heading">
            {EXAMPLE_SCORE.toFixed(1)}
          </span>
        </ArcGauge>

        <div className="min-w-0">
          <p className="font-[family-name:var(--font-serif)] text-[24px] italic leading-none text-primary">
            {verdict}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            {fmtMark(margin)} short of a pass
          </p>
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2" aria-label="Domain results">
        {EXAMPLE_DOMAINS.map((domain) => {
          const passed = domain.outcome === 'pass';
          const Icon = passed ? Check : X;
          return (
            <li key={domain.label} className="inline-flex items-center gap-1.5 text-[13px] text-body">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full ${
                  passed ? 'bg-green-700/10 text-green-700' : 'bg-red-700/10 text-red-700'
                }`}
                aria-hidden="true"
              >
                <Icon className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              {domain.label}
              <span className="sr-only">{passed ? ', passed' : ', failed'}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t border-hairline pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary sm:text-[11px]">
          The one change
        </p>
        <p className="mt-1.5 text-[15px] leading-snug text-heading">{ONE_CHANGE}</p>
      </div>
    </motion.figure>
  );
}

'use client';

import { motion, useReducedMotion } from 'framer-motion';
import OutcomeGlyph from '@/components/ui/OutcomeGlyph';
import {
  summariseHistory,
  summaryStats,
  type SummarySession,
} from '@/lib/dashboard/historySummary';

/**
 * The line above the history list: how much work, how it is going, how good it
 * has been — and a switch for how tightly the rows below should pack.
 *
 * A rule rather than a panel. ScoreTrend directly underneath is already a
 * bordered box, and two stacked boxes at the top of a list turn a typographic
 * page into a dashboard. Stats between rules is the house pattern.
 *
 * The figures describe every loaded session, not the filtered view. A summary
 * that moved every time you typed in the search box would be a different
 * control — this one answers "how am I doing", which the filter does not change.
 *
 * How few figures appear is decided in lib/dashboard/historySummary, where it
 * can be tested; this only draws them.
 */

interface HistorySummaryProps {
  /** Newest first, unfiltered — every row the page has loaded. */
  sessions: SummarySession[];
  /** Whether the pager has more behind these. Turns a week count into "3+". */
  hasMore: boolean;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
}

export default function HistorySummary({
  sessions,
  hasMore,
  compact,
  onCompactChange,
}: HistorySummaryProps) {
  const shouldReduceMotion = useReducedMotion();

  const summary = summariseHistory(sessions, { hasMore });
  const stats = summaryStats(summary);

  return (
    <motion.div
      className="mb-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-hairline pb-4"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
    >
      {stats.map((stat) => (
        <div key={stat.id} className="flex items-baseline gap-1.5" title={stat.detail}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
            {stat.label}
          </span>

          {/* Mono and tabular for the scores so the column of figures lines up;
              "3 sessions" is a phrase, not a measurement, and stays in sans. */}
          <span
            className={
              stat.id === 'week'
                ? 'text-[15px] font-medium text-heading'
                : 'font-mono text-[15px] font-semibold tabular-nums text-heading'
            }
          >
            {stat.value}
          </span>

          {stat.suffix && (
            <span className="font-mono text-[11px] text-muted">{stat.suffix}</span>
          )}

          {stat.delta && (
            // Green only when it is going up. A fall gets the same quiet grey
            // as "level": the sign already says which way, and painting a bad
            // fortnight red tells a candidate something they can read for
            // themselves, in the least useful possible tone.
            <span
              className={`font-mono text-[12px] font-medium tabular-nums ${
                stat.delta.startsWith('+') ? 'text-success' : 'text-muted'
              }`}
            >
              {stat.delta}
            </span>
          )}

          {stat.passed && (
            <>
              <OutcomeGlyph kind="pass" className="self-center" />
              <span className="sr-only">passed</span>
            </>
          )}

          {/* The number's own explanation, for anyone who cannot hover it. */}
          <span className="sr-only">{stat.detail}</span>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onCompactChange(!compact)}
        aria-pressed={compact}
        className={`ml-auto self-center rounded-full px-3 py-1 text-[12px] font-medium transition-colors focus-visible-ring ${
          compact ? 'bg-primary/10 text-primary' : 'bg-black/[0.04] text-muted hover:text-heading'
        }`}
      >
        {/* Decoration — `aria-pressed` on the button is what carries the state. */}
        <span aria-hidden="true" className="mr-1.5">
          {compact ? '▣' : '□'}
        </span>
        Compact
      </button>

      {/* Said once, plainly, rather than hedging every figure. Only when there
          is actually something unloaded to hedge about. */}
      {hasMore && (
        <p className="w-full text-[11px] text-muted">
          From the {summary.loadedCount} sessions loaded so far — load more to include the rest.
        </p>
      )}
    </motion.div>
  );
}

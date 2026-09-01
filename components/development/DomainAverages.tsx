'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  sparklinePoints,
  summariseDomains,
  type DomainAverage,
  type DomainCasePoints,
  type DomainTrajectory,
} from '@/lib/development/domainAverages';

/** Sparkline box, in viewBox units. Wide and short — a texture, not a chart. */
const SPARK_W = 120;
const SPARK_H = 22;
/** Keeps the 2px stroke off the top and bottom edges of the box. */
const SPARK_INSET = 2;

interface TrajectoryStyle {
  glyph: string;
  colour: string;
  /** What the arrow means, for the tooltip and the screen reader. */
  title: string;
}

const TRAJECTORY_STYLES: Record<DomainTrajectory, TrajectoryStyle> = {
  improving: { glyph: '↗', colour: '#15803D', title: 'improving' },
  steady: { glyph: '→', colour: '#57534E', title: 'holding steady' },
  slipping: { glyph: '↘', colour: '#B91C1C', title: 'slipping' },
};

/** Grade points render to one decimal — the underlying scale is 0–3 in whole steps. */
function formatMean(value: number): string {
  return value.toFixed(1);
}

function DomainColumn({ average, animate }: { average: DomainAverage; animate: boolean }) {
  const trajectory = TRAJECTORY_STYLES[average.trajectory];
  const points = sparklinePoints(
    average.series,
    average.max,
    SPARK_W,
    SPARK_H - SPARK_INSET * 2,
  );

  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {average.label}
      </div>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[24px] font-semibold tabular-nums leading-none text-heading">
          {average.mean === null ? '—' : formatMean(average.mean)}
        </span>
        <span className="font-mono text-[12px] text-muted">/ {average.max}</span>
        {average.mean !== null && (
          <span
            className="ml-0.5 text-[14px] leading-none"
            style={{ color: trajectory.colour }}
            title={trajectory.title}
          >
            {trajectory.glyph}
            <span className="sr-only"> {trajectory.title}</span>
          </span>
        )}
      </div>

      {/* Only clinical management has anything to say here, but the line is
          reserved in all three columns so the sparklines sit on one baseline —
          otherwise the middle chart drops 16px and the row reads as broken
          rather than annotated. Below `sm` the columns stack and there is no
          baseline to hold, so the spacer goes away rather than adding a blank
          line to every card. */}
      <div className="mt-1 hidden text-[11px] text-muted sm:block">
        {average.domain === 'clinical_management' ? 'weighted 1.5x' : ' '}
      </div>
      {average.domain === 'clinical_management' && (
        <div className="mt-1 text-[11px] text-muted sm:hidden">weighted 1.5x</div>
      )}

      {points && (
        <svg
          viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
          className="mt-2.5 block h-[22px] w-full max-w-[120px]"
          aria-hidden="true"
        >
          <g transform={`translate(0 ${SPARK_INSET})`}>
            <motion.polyline
              points={points}
              fill="none"
              stroke="#B45309"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              // `initial` is rendered on the server too, so the reduced-motion
              // branch collapses the duration rather than dropping it — the
              // same trick ScoreTrend uses to keep hydration honest.
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={animate ? { duration: 0.8, ease: 'easeOut' } : { duration: 0 }}
            />
          </g>
        </svg>
      )}
    </div>
  );
}

interface DomainAveragesProps {
  /** Marked cases in the window, oldest → newest. */
  cases: DomainCasePoints[];
}

/**
 * The three SCA domains as three numbers, between two rules.
 *
 * This is the part of the page that is arithmetic rather than language, and it
 * sits directly under the score chart because "am I getting better?" splits
 * immediately into "at what?". The sparkline is there so a mean of 2.0 can be
 * read as a plateau or as a recovery, which the number alone cannot say.
 *
 * Renders nothing at all when no case in the window carries a grade. An empty
 * three-column row of dashes says less than the space it takes.
 */
export default function DomainAverages({ cases }: DomainAveragesProps) {
  const shouldReduceMotion = useReducedMotion();
  const averages = summariseDomains(cases);

  if (averages.every((average) => average.mean === null)) return null;

  return (
    <section
      aria-label="Your average grade in each domain"
      className="mb-10 grid grid-cols-1 gap-6 border-y border-hairline py-6 sm:grid-cols-3 sm:gap-5"
    >
      {averages.map((average) => (
        <DomainColumn
          key={average.domain}
          average={average}
          animate={!shouldReduceMotion}
        />
      ))}
    </section>
  );
}

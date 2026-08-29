'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { IntensityCalendar, IntensityDay } from '@/lib/dashboard/trainingIntensity';

/**
 * Half a year of practice, one square per day.
 *
 * The dashboard used to open on three domain dials — a verdict on work already
 * done, delivered before the trainee had done anything today. This asks the
 * only question the home page can usefully ask every morning: have you
 * practised, and how consistently. The unit is a consultation, not a score, so
 * it cannot be argued with and rises the moment you do the work.
 *
 * Everything drawn here comes from buildIntensityCalendar — the component owns
 * no arithmetic beyond formatting a date for a tooltip, so the picture and the
 * ledger can never fall out of step.
 */

interface TrainingHeatmapProps {
  calendar: IntensityCalendar;
}

/**
 * The amber sequential ramp, light to dark, with a warm neutral for an empty
 * day. Literal hex because these are chart marks: there is no text token for a
 * four-step scale, and Tailwind's palette has no warm ramp of this shape.
 */
const LEVEL_COLOURS = ['rgba(28,25,23,0.05)', '#F4E3C6', '#EAB868', '#D97706', '#8A3D08'] as const;

/** Cell edge and gap, in px. The month row offsets by the day column + gap. */
const CELL = 29;
const GAP = 4;
const DAY_LABEL_WIDTH = 34;
const COLUMN_GAP = 8;

/** Rows 0, 2 and 4 of a Monday-first week. Labelling all seven is unreadable. */
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const;

/**
 * "3 consultations on 24 Aug".
 *
 * The date is split by hand rather than passed to `new Date(day.date)`, which
 * would read `YYYY-MM-DD` as UTC midnight and name the previous day for anyone
 * west of Greenwich.
 */
function cellLabel(day: IntensityDay): string {
  const [year, month, date] = day.date.split('-').map(Number);
  const when = new Date(year, month - 1, date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  return `${day.count} consultation${day.count === 1 ? '' : 's'} on ${when}`;
}

export default function TrainingHeatmap({ calendar }: TrainingHeatmapProps) {
  const shouldReduceMotion = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);

  // On a phone the board is far wider than the screen, and the weeks that
  // matter are the most recent ones. Opening scrolled hard right shows this
  // week first; the older half is a swipe away rather than the other way round.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div>
      {/* Wraps rather than shrinks: on a 375px screen the caption otherwise
          runs flush into the edge of the viewport. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* Same 10px eyebrow as "Up next" above it — two section labels on one
            screen at two sizes read as two levels of heading. */}
        <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">
          Training intensity
        </span>
        <span className="text-[11px] text-muted">one square per day · last 26 weeks</span>
      </div>
      <div className="mt-2.5 text-[20px] font-bold tracking-[-0.02em] text-heading">
        {calendar.headline}
      </div>

      {/* The board scrolls inside its own box so a 26-week grid can never make
          the page itself scroll sideways on a phone. */}
      <div ref={scroller} className="mt-5 overflow-x-auto pb-1">
        <div className="w-max">
          <div
            className="flex"
            style={{ marginLeft: DAY_LABEL_WIDTH + COLUMN_GAP, gap: GAP }}
          >
            {calendar.months.map((label, i) => (
              <span
                key={i}
                className="flex-shrink-0 whitespace-nowrap font-mono text-[10px] text-muted"
                style={{ width: CELL }}
                aria-hidden={label === ''}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="mt-1.5 flex" style={{ gap: COLUMN_GAP }}>
            <div
              className="flex flex-shrink-0 flex-col"
              style={{ width: DAY_LABEL_WIDTH, gap: GAP }}
              aria-hidden
            >
              {DAY_LABELS.map((label, i) => (
                <span
                  key={i}
                  className="flex items-center font-mono text-[10px] text-muted"
                  style={{ height: CELL }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex" style={{ gap: GAP }}>
              {calendar.weeks.map((week, w) => (
                /* One rise per column, left to right, once. Reduced motion
                   collapses the duration rather than dropping `initial`, so
                   the server and client render the same markup and hydration
                   has nothing to reconcile — same trick as ArcGauge. */
                <motion.div
                  key={week.days[0].date}
                  className="flex flex-col"
                  style={{ gap: GAP }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.4,
                    delay: shouldReduceMotion ? 0 : w * 0.025,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {week.days.map(day => (
                    <div
                      key={day.date}
                      title={cellLabel(day)}
                      aria-label={cellLabel(day)}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 6,
                        background: LEVEL_COLOURS[day.level],
                        // A day that hasn't happened is not a day you skipped.
                        opacity: day.isFuture ? 0.45 : 1,
                      }}
                    />
                  ))}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
          <LedgerFigure label="Daily average" value={calendar.ledger.dailyAvg} />
          <LedgerFigure label="Days practised" value={`${calendar.ledger.daysPct}%`} />
          <LedgerFigure label="Longest streak" value={`${calendar.ledger.longest} days`} />
          {/* The one figure the reader can change today, so it takes the accent. */}
          <LedgerFigure label="Current streak" value={`${calendar.ledger.current} days`} accent />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted">Less</span>
          {LEVEL_COLOURS.map((colour, level) => (
            <span
              key={level}
              aria-hidden
              style={{ width: 12, height: 12, borderRadius: 3, background: colour }}
            />
          ))}
          <span className="text-[10px] text-muted">More</span>
        </div>
      </div>
    </div>
  );
}

function LedgerFigure({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span className="text-[11px] text-muted">
      {label}{' '}
      <span
        className={`font-mono text-[12px] font-bold tabular-nums ${accent ? 'text-primary' : 'text-heading'}`}
      >
        {value}
      </span>
    </span>
  );
}

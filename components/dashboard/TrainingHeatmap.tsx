'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 * A `YYYY-MM-DD` cell date as a local Date.
 *
 * Split by hand rather than passed to `new Date(day.date)`, which would read
 * the string as UTC midnight and name the previous day for anyone west of
 * Greenwich.
 */
function cellDate(day: IntensityDay): Date {
  const [year, month, date] = day.date.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** "3 consultations on 24 Aug" — the screen-reader label on every square. */
function cellLabel(day: IntensityDay): string {
  const when = cellDate(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${day.count} consultation${day.count === 1 ? '' : 's'} on ${when}`;
}

/** "Wednesday 25 February 2026" — the tooltip's first line. */
function tooltipDate(day: IntensityDay): string {
  return cellDate(day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The tooltip's second line, or null for a day that hasn't happened yet.
 *
 * A future square is empty because the day is not here, so reporting zero
 * consultations on it would read as a day you skipped — the same distinction
 * the reduced opacity on those squares is already making.
 */
function tooltipCount(day: IntensityDay): string | null {
  if (day.isFuture) return null;
  if (day.count === 0) return 'No consultations';
  return `${day.count} consultation${day.count === 1 ? '' : 's'}`;
}

/** The hovered square, with its tooltip anchor in frame-relative px. */
interface HoverTarget {
  day: IntensityDay;
  x: number;
  y: number;
}

/** Half the tooltip's widest plausible line, for clamping it inside the frame. */
const TOOLTIP_HALF_WIDTH = 110;

export default function TrainingHeatmap({ calendar }: TrainingHeatmapProps) {
  const shouldReduceMotion = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);

  /**
   * Anchor the tooltip under the hovered square, in the frame's coordinates.
   *
   * Measured off live rects rather than recomputed from CELL/GAP: the board
   * scrolls horizontally inside its own box, so where a column actually sits
   * depends on the scroll offset, and a second copy of the layout arithmetic
   * here would be one more thing to keep in step with the grid.
   */
  const showTooltip = useCallback((day: IntensityDay, cell: HTMLElement) => {
    const box = frame.current;
    if (!box) return;
    const cellBox = cell.getBoundingClientRect();
    const frameBox = box.getBoundingClientRect();
    const centre = cellBox.left + cellBox.width / 2 - frameBox.left;
    // Keep the first and last columns' tooltips inside the frame. A frame too
    // narrow to hold one has nothing to clamp against, so it is left centred.
    const limit = frameBox.width - TOOLTIP_HALF_WIDTH;
    setHover({
      day,
      x: limit > TOOLTIP_HALF_WIDTH ? Math.min(Math.max(centre, TOOLTIP_HALF_WIDTH), limit) : centre,
      y: cellBox.bottom - frameBox.top,
    });
  }, []);

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
          the page itself scroll sideways on a phone. The frame around it holds
          the tooltip, which has to sit outside the scroller: `overflow-x: auto`
          clips on both axes, so a tooltip inside would be cut off. */}
      <div ref={frame} className="relative" onMouseLeave={() => setHover(null)}>
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
                        // No native `title`: it waits about a second and then
                        // draws an OS tooltip, which on a board you scan across
                        // is slower than reading the squares themselves.
                        aria-label={cellLabel(day)}
                        onMouseEnter={e => showTooltip(day, e.currentTarget)}
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

        {/* Anki's calendar tooltip: the day, and what you did on it. Drawn over
            the board rather than in a row of its own, so nothing on the page
            moves as the pointer crosses the squares, and it never takes the
            pointer — catching it would end the hover that produced it. */}
        {hover && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-[10px] border border-hairline bg-surface-raised px-3 py-2 shadow-elevation-4"
            style={{ left: hover.x, top: hover.y + 8 }}
          >
            <div className="text-[12px] font-medium text-heading">{tooltipDate(hover.day)}</div>
            {tooltipCount(hover.day) && (
              <div className="mt-0.5 font-mono text-[11px] text-muted">
                {tooltipCount(hover.day)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
          <LedgerFigure label="Daily average" value={calendar.ledger.dailyAvg} />
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

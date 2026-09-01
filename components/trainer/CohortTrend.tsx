'use client';

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { format } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import OutcomeGlyph from '@/components/ui/OutcomeGlyph';
import type { TrainerSession } from '@/app/api/trainer/overview/route';
import type { DomainKey } from '@/lib/clinical-master/types';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';
import { passMarkFor, fmtMark } from '@/lib/clinical-master/scoring';
import {
  DOMAIN_DISPLAY_NAMES,
  DOMAIN_MAX_POINTS,
  DOMAIN_ORDER,
} from '@/lib/development/domainAverages';

const VIEW_W = 520;
const VIEW_H = 170;
const PAD_TOP = 24;
const PAD_BOTTOM = 20;
const PAD_X = 14;

/** Plot width in viewBox units — the span the points are laid out across. */
const PLOT_W = VIEW_W - PAD_X * 2;

/** Gap between the cursor and the readout beside it, in percent of the chart. */
const READOUT_GAP_PCT = 2.5;

/**
 * Client pixels to viewBox units. Same arithmetic as ScoreTrend's, and for the
 * same reason: the viewBox is a fixed 520x170 but the svg renders at whatever
 * width the container gives it. Duplicated rather than shared because ScoreTrend
 * exports it against ITS geometry constants — importing it would silently
 * couple two charts that are free to be laid out differently.
 */
export function clientXToViewX(
  clientX: number,
  rect: { left: number; width: number },
): number | null {
  if (!rect.width) return null;
  return ((clientX - rect.left) / rect.width) * VIEW_W;
}

/** Which session number is nearest a given viewBox x, over `count` columns. */
export function nearestPointIndex(viewX: number, count: number): number {
  if (count <= 1) return 0;
  const fraction = (viewX - PAD_X) / PLOT_W;
  return Math.max(0, Math.min(count - 1, Math.round(fraction * (count - 1))));
}

/** One marked case on the chart. */
export interface CohortPoint {
  sessionId: string;
  stationTitle: string;
  date: string;
  score: number;
  maxScore: number;
  passed: boolean;
  domainPoints: Partial<Record<DomainKey, number>>;
}

export interface CohortSeries {
  userId: string;
  name: string;
  colour: string;
  /** Marked cases only, oldest → newest. */
  points: CohortPoint[];
}

/** A student's marked cases as chart points, in the order they were sat. */
export function toSeriesPoints(sessions: readonly TrainerSession[]): CohortPoint[] {
  return sessions
    .filter((session) => session.weightedScore !== null && session.weightedScore > 0)
    .map((session) => ({
      sessionId: session.id,
      stationTitle: session.stationTitle,
      date: session.date,
      score: session.weightedScore!,
      maxScore: session.maxScore,
      passed: session.passed,
      domainPoints: session.domainPoints,
    }));
}

/** Below two points there is no line to draw, only a dot with no story. */
const MIN_POINTS = 2;

interface CohortTrendProps {
  series: CohortSeries[];
}

/**
 * The cohort's scores, case by case — the trainer's version of the Development
 * page's ScoreTrend, and deliberately the same instrument.
 *
 * WHAT IS PLOTTED. Each student's own mark on each case they sat, against
 * session number rather than date. Date would space three students who practise
 * at different rates into three unreadable clumps; session number asks the
 * question a trainer actually has ("is their fourth case better than their
 * first?") and puts the three answers side by side. The x-scale is shared, so a
 * student who has sat four cases draws a short line at the left rather than
 * being stretched across the width and looking as though they have done as much
 * as everyone else.
 *
 * UNSCORED SESSIONS ARE ABSENT. A consultation still being marked, or one that
 * was abandoned, has no height. It is in the list below with a "Marking" pill
 * on it; putting it here at zero would draw a collapse that did not happen.
 *
 * INTERACTION IS ScoreTrend'S, EXTENDED BY ONE AXIS. Vertical cursor, a ring on
 * the point, a readout card beside (never over) it carrying the case, the date,
 * the mark in big mono and the three domain bars. Left/Right walk the session
 * numbers; Up/Down move between students at that same session number, which is
 * the comparison the whole chart exists to make. Pointer events with capture and
 * `touch-action: pan-y` so a horizontal drag inspects and a vertical swipe still
 * scrolls the page.
 *
 * `role="slider"` over the session axis, as ScoreTrend does — `aria-valuetext`
 * names the student as well as the case, so arrowing across reads out who is
 * being described rather than leaving it to the colour.
 */
export default function CohortTrend({ series }: CohortTrendProps) {
  const shouldReduceMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  /** See ScoreTrend: a ref because the move handler needs it before a re-render. */
  const draggingRef = useRef(false);
  const [cursor, setCursor] = useState<{ series: number; point: number } | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const drawable = series.filter((entry) => entry.points.length > 0);
  const totalPoints = drawable.reduce((sum, entry) => sum + entry.points.length, 0);
  if (drawable.length === 0 || totalPoints < MIN_POINTS) return null;

  // The longest series sets the axis; everyone is plotted against it.
  const count = Math.max(...drawable.map((entry) => entry.points.length));
  const maxScore = drawable[0].points[0]?.maxScore || MAX_WEIGHTED_SCORE;
  const passMark = passMarkFor(maxScore);

  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (count === 1 ? PLOT_W / 2 : (i / (count - 1)) * PLOT_W);
  const y = (v: number) => PAD_TOP + (1 - Math.max(0, Math.min(1, v / maxScore))) * plotH;
  const passY = y(passMark);

  // Clamped on render, never trusted raw: the filter tabs change which series
  // exist and how long they are, and a stale cursor must never point past the
  // end of one.
  const activeSeries = Math.min(cursor?.series ?? 0, drawable.length - 1);
  const seriesPoints = drawable[activeSeries].points;
  const activePoint = Math.min(cursor?.point ?? seriesPoints.length - 1, seriesPoints.length - 1);
  const point = seriesPoints[activePoint];

  const stamp = new Date(point.date);
  const stampLabel = Number.isFinite(stamp.getTime()) ? format(stamp, 'd MMM') : null;

  const splitText = DOMAIN_ORDER.filter(
    (domain) => typeof point.domainPoints[domain] === 'number',
  )
    .map(
      (domain) =>
        `${DOMAIN_DISPLAY_NAMES[domain]} ${point.domainPoints[domain]!.toFixed(1)} of ${DOMAIN_MAX_POINTS[domain]}.`,
    )
    .join(' ');

  const summarySentence = drawable
    .map(
      (entry) =>
        `${entry.name}: ${entry.points.length} marked case${entry.points.length === 1 ? '' : 's'}, from ${entry.points[0].score.toFixed(1)} to ${entry.points[entry.points.length - 1].score.toFixed(1)} out of ${fmtMark(maxScore)}.`,
    )
    .join(' ');

  const valueText = `${drawable[activeSeries].name}, case ${activePoint + 1} of ${seriesPoints.length}. ${point.stationTitle}${
    stampLabel ? `, ${stampLabel}` : ''
  }, ${point.score.toFixed(1)} out of ${fmtMark(point.maxScore)}, ${
    point.passed ? 'passed' : 'not passed'
  }.${splitText ? ` ${splitText}` : ''}`;

  /** Beside the cursor, never over it — see ScoreTrend for the full reasoning. */
  const cursorPct = (x(activePoint) / VIEW_W) * 100;
  const readoutOnRight = activePoint < (count - 1) / 2;
  const readoutStyle = {
    '--readout-left': readoutOnRight ? `${cursorPct + READOUT_GAP_PCT}%` : 'auto',
    '--readout-right': readoutOnRight ? 'auto' : `${100 - cursorPct + READOUT_GAP_PCT}%`,
  } as CSSProperties;

  function moveTo(seriesIndex: number, pointIndex: number) {
    setCursor({ series: seriesIndex, point: pointIndex });
    setInspecting(true);
  }

  /**
   * Which point a pointer is over: the nearest session column, then the series
   * whose mark at that column is closest to the pointer's own height.
   *
   * The second half is what makes three overlapping lines readable — snapping
   * to the first series that happens to have a point in that column would mean
   * a trainer could never hover the student they were looking at.
   */
  function pointFromClient(clientX: number, clientY: number): { series: number; point: number } | null {
    const frame = frameRef.current;
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    const viewX = clientXToViewX(clientX, rect);
    if (viewX === null || !rect.height) return null;
    const column = nearestPointIndex(viewX, count);
    const viewY = ((clientY - rect.top) / rect.height) * VIEW_H;

    // A plain loop rather than a reduce or a forEach: TypeScript cannot follow
    // an accumulator reassigned inside a callback, and the `best` written there
    // narrows to `never` on the way out.
    let bestSeries = -1;
    let bestPoint = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let seriesIndex = 0; seriesIndex < drawable.length; seriesIndex += 1) {
      const entry = drawable[seriesIndex];
      const index = Math.min(column, entry.points.length - 1);
      const candidate = entry.points[index];
      if (!candidate) continue;
      const distance = Math.abs(y(candidate.score) - viewY);
      if (distance < bestDistance) {
        bestSeries = seriesIndex;
        bestPoint = index;
        bestDistance = distance;
      }
    }

    return bestSeries === -1 ? null : { series: bestSeries, point: bestPoint };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' && !draggingRef.current) return;
    const next = pointFromClient(event.clientX, event.clientY);
    if (!next) return;
    moveTo(next.series, next.point);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const next = pointFromClient(event.clientX, event.clientY);
    if (!next) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone; the move handlers simply never fire.
    }
    draggingRef.current = true;
    moveTo(next.series, next.point);
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Never captured, or already released.
    }
    draggingRef.current = false;
    if (event.pointerType !== 'mouse') setInspecting(false);
  }

  function handlePointerLeave() {
    if (draggingRef.current) return;
    setInspecting(false);
  }

  function handleFocus() {
    if (draggingRef.current) return;
    moveTo(activeSeries, activePoint);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next: { series: number; point: number } | null = null;
    /** Clamp into a series that may be shorter than the one we came from. */
    const intoSeries = (seriesIndex: number) => ({
      series: seriesIndex,
      point: Math.min(activePoint, drawable[seriesIndex].points.length - 1),
    });

    switch (event.key) {
      case 'ArrowRight':
        next = { series: activeSeries, point: Math.min(seriesPoints.length - 1, activePoint + 1) };
        break;
      case 'ArrowLeft':
        next = { series: activeSeries, point: Math.max(0, activePoint - 1) };
        break;
      case 'ArrowDown':
        next = intoSeries(Math.min(drawable.length - 1, activeSeries + 1));
        break;
      case 'ArrowUp':
        next = intoSeries(Math.max(0, activeSeries - 1));
        break;
      case 'Home':
        next = { series: activeSeries, point: 0 };
        break;
      case 'End':
        next = { series: activeSeries, point: seriesPoints.length - 1 };
        break;
      case 'Escape':
        setInspecting(false);
        return;
      default:
        return;
    }
    // Swallowed even at an edge, so an arrow at the end of a series does not
    // scroll the chart out from under the cursor.
    event.preventDefault();
    moveTo(next.series, next.point);
  }

  return (
    <div className="mb-5 rounded-[10px] border border-hairline bg-surface-raised px-4 py-3.5">
      {/* The sentence that would otherwise be the svg's aria-label. Read in
          place, rather than hanging off a graphic whose role hides its
          contents — see ScoreTrend. */}
      <p className="sr-only">{summarySentence}</p>

      <div
        ref={frameRef}
        role="slider"
        tabIndex={0}
        aria-label="Inspect your students' marked cases"
        aria-valuemin={1}
        aria-valuemax={seriesPoints.length}
        aria-valuenow={activePoint + 1}
        aria-valuetext={valueText}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={() => setInspecting(false)}
        className="relative cursor-crosshair touch-pan-y select-none rounded-[6px] focus-visible-ring"
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block h-auto w-full" aria-hidden="true">
          <line
            x1="0"
            y1={passY}
            x2={VIEW_W}
            y2={passY}
            stroke="rgba(28,25,23,0.22)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text
            x="0"
            y={passY - 7}
            fontFamily="JetBrains Mono, monospace"
            fontSize="10"
            fill="#8A817A"
          >
            {fmtMark(passMark)} pass mark
          </text>

          {drawable.map((entry, seriesIndex) => (
            <g key={entry.userId}>
              <motion.polyline
                points={entry.points
                  .map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`)
                  .join(' ')}
                fill="none"
                stroke={entry.colour}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                // Reduced motion collapses the draw rather than skipping
                // `initial`: branching on `initial` hands React different
                // markup to hydrate, because the server cannot know the
                // preference.
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 1.4, delay: seriesIndex * 0.08, ease: [0.3, 0.7, 0.4, 1] }
                }
              />
              {entry.points.map((p, i) => (
                <motion.circle
                  key={p.sessionId}
                  cx={x(i)}
                  cy={y(p.score)}
                  r={i === entry.points.length - 1 ? 4.5 : 3.5}
                  fill={entry.colour}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={
                    shouldReduceMotion ? { duration: 0 } : { delay: 0.13 + i * 0.09, duration: 0.3 }
                  }
                />
              ))}
            </g>
          ))}

          {/* The cursor: a rule the height of the plot, plus a ring on the point
              itself. The dot's height IS the mark, so the ring can sit on it
              without claiming a number the readout does not show. */}
          <motion.g
            initial={false}
            animate={{ opacity: inspecting ? 1 : 0 }}
            // Fades in, but leaves at once: the readout unmounts rather than
            // fading, and a ring over an unlabelled chart reads as a stuck cursor.
            transition={shouldReduceMotion || !inspecting ? { duration: 0 } : { duration: 0.12 }}
          >
            <line
              x1={x(activePoint)}
              y1={PAD_TOP - 8}
              x2={x(activePoint)}
              y2={VIEW_H - PAD_BOTTOM + 6}
              stroke="rgba(28,25,23,0.28)"
              strokeWidth="1"
            />
            <circle
              cx={x(activePoint)}
              cy={y(point.score)}
              r="7"
              fill="none"
              stroke={drawable[activeSeries].colour}
              strokeWidth="2"
            />
          </motion.g>
        </svg>

        {/* Over the chart rather than in a row of its own: reserved space would
            leave a hole whenever nothing is hovered. Never takes the pointer —
            catching it would end the hover that made it. */}
        {inspecting && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-1 z-10 rounded-[10px] border border-hairline bg-surface-raised px-3 py-2.5 shadow-elevation-4 sm:inset-x-auto sm:left-[var(--readout-left)] sm:right-[var(--readout-right)] sm:w-max sm:max-w-[280px]"
            style={readoutStyle}
          >
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                style={{ background: drawable[activeSeries].colour }}
              />
              <span className="truncate text-[11px] font-semibold text-muted">
                {drawable[activeSeries].name}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="truncate text-[12px] font-medium text-heading">
                {point.stationTitle}
              </span>
              {stampLabel && (
                <span className="flex-shrink-0 font-mono text-[10px] text-muted">{stampLabel}</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="font-mono text-[15px] font-bold tabular-nums text-heading">
                {point.score.toFixed(1)}
              </span>
              <span className="font-mono text-[11px] text-muted">
                of {fmtMark(point.maxScore)}
              </span>
              {point.passed && <OutcomeGlyph kind="pass" className="flex-shrink-0" />}
            </div>
            <DomainSplit split={point.domainPoints} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * How one case's mark was made up, as three bars.
 *
 * Renders nothing when the case has no stored breakdown — a real state, not an
 * error, and a row of empty bars would read as three zeroes, which is a much
 * worse claim than saying nothing.
 */
function DomainSplit({ split }: { split: Partial<Record<DomainKey, number>> }) {
  const rows = DOMAIN_ORDER.filter((domain) => typeof split[domain] === 'number');
  if (rows.length === 0) return null;

  return (
    <div className="mt-2.5 space-y-1.5 border-t border-hairline pt-2">
      {rows.map((domain) => {
        const value = split[domain]!;
        const max = DOMAIN_MAX_POINTS[domain];
        return (
          <div key={domain} className="flex items-center gap-2">
            <span className="w-[118px] flex-shrink-0 text-[10.5px] leading-tight text-muted">
              {DOMAIN_DISPLAY_NAMES[domain]}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
              />
            </div>
            <span className="flex-shrink-0 font-mono text-[10px] tabular-nums text-muted">
              {value.toFixed(1)}/{max}
            </span>
          </div>
        );
      })}
    </div>
  );
}

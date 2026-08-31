'use client';

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { format } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import OutcomeGlyph from '@/components/ui/OutcomeGlyph';
import type { SessionHistoryItem } from '@/lib/supabase/queries/dashboard';
import type { DomainKey } from '@/lib/clinical-master/types';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';
import { passMarkFor, fmtMark } from '@/lib/clinical-master/scoring';
import {
  DOMAIN_DISPLAY_NAMES,
  DOMAIN_MAX_POINTS,
  DOMAIN_ORDER,
  type DomainCasePoints,
} from '@/lib/development/domainAverages';

/** Below this there is no shape to show, only noise. */
const MIN_POINTS = 4;
/**
 * Most recent N scored cases. Effectively "everything": the bank is 200 cases,
 * so this is a runaway guard, not a window — the chart is the programme, and a
 * ten-case cap made it disagree with every other number on the page.
 */
const WINDOW = 400;

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
 * Client pixels to viewBox units.
 *
 * The viewBox is a fixed 520x170 but the svg renders at whatever width the
 * container gives it, so a client x is never a viewBox x. Returns null for a
 * zero-width box — a chart in a collapsed container has no answer, and 0 would
 * be a wrong one.
 */
export function clientXToViewX(
  clientX: number,
  rect: { left: number; width: number },
): number | null {
  if (!rect.width) return null;
  return ((clientX - rect.left) / rect.width) * VIEW_W;
}

/**
 * Inverse of the `x()` used to lay the points out: which point is nearest a
 * given viewBox x. Carries the same single-point guard as `x()` — one point
 * sits at the middle and there is no gradient to divide by.
 */
export function nearestPointIndex(viewX: number, count: number): number {
  if (count <= 1) return 0;
  const fraction = (viewX - PAD_X) / PLOT_W;
  return Math.max(0, Math.min(count - 1, Math.round(fraction * (count - 1))));
}

interface ScoreTrendProps {
  /** Newest-first, as the history page holds them. */
  sessions: SessionHistoryItem[];
  /**
   * Per-domain weighted points, keyed by session id, for the hover readout.
   *
   * Optional and incomplete by design: the query behind it reads whole result
   * blobs, so it is windowed to the recent cases rather than the whole bank. A
   * point with no entry shows its mark and no breakdown — see DomainSplit.
   */
  domainCases?: readonly DomainCasePoints[];
}

/**
 * M4 — "am I getting better?", which a flat list of identical rows cannot answer.
 *
 * WHAT IS PLOTTED. Each case's own mark, in the order they were sat. An earlier
 * version drew a rolling mean of the last 3–8, on the reasoning that one bad
 * case in a rising run should not read as a collapse. It bought that at too high
 * a price: the height of a dot was a number that appeared nowhere else in the
 * product, so the chart had to keep explaining which of two numbers it meant,
 * and the reader had to hold the distinction to read their own scores. Raw marks
 * need no caption. The line between them is a connector, not a claim.
 *
 * The chart is bare on purpose. No headline, no delta, no verdict — those are
 * the trend report's job further down the page, written from a model that has
 * read the consultations, and a second opinion computed off two endpoints was
 * both weaker and louder than the real one.
 *
 * HOVER. Move across and a readout names that case: its mark, and how the mark
 * splits across the three domains. The split is the thing a single number
 * cannot tell you — 5.5 built on a failed Clinical Management is a different
 * problem from 5.5 spread evenly — and it is per attempt, not averaged.
 *
 * TOUCH. Pointer events with capture, so a drag that leaves the chart keeps
 * reporting. `touch-action: pan-y` rather than `none`: the chart is a couple of
 * hundred px tall at the dashboard measure, and `none` would make that a block
 * of the page a thumb cannot scroll past. `pan-y` gives the browser the
 * vertical axis and keeps the horizontal one — a vertical swipe scrolls and
 * cancels, a horizontal one inspects.
 *
 * KEYBOARD. One tab stop, arrows along the series. `role="slider"` because that
 * is what a one-dimensional cursor over an ordered series is, and it is the role
 * screen readers announce `aria-valuetext` for on every move — so arrowing
 * across reads out each case rather than silence.
 *
 * The svg is aria-hidden and carries no `role="img"`. It used to: `role="img"`
 * prunes every descendant from the accessibility tree, which is fine for a
 * static picture and fatal next to anything interactive. The sentence that was
 * its label is now a visually-hidden paragraph, read in document order.
 */
export default function ScoreTrend({ sessions, domainCases = [] }: ScoreTrendProps) {
  const shouldReduceMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  /**
   * Whether a pointer is currently down on the chart.
   *
   * A ref, not state, for two reasons. The move handler needs the value the
   * instant it fires rather than after a re-render; and pressing a `tabindex`
   * div focuses it, so `onFocus` arrives *after* `onPointerDown` and would
   * otherwise flip the interaction into keyboard mode mid-drag.
   */
  const draggingRef = useRef(false);
  /** null until something moves it — clamped on render, never trusted raw. */
  const [cursor, setCursor] = useState<number | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const scored = sessions
    .filter((s) => s.outcome === 'scored')
    .slice(0, WINDOW)
    .reverse(); // oldest → newest, the direction a chart reads

  if (scored.length < MIN_POINTS) return null;

  const count = scored.length;
  const maxScore = scored[0]?.maxScore || MAX_WEIGHTED_SCORE;
  const passMark = passMarkFor(maxScore);

  const marks = scored.map((s) => s.weightedScore);

  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (count === 1 ? PLOT_W / 2 : (i / (count - 1)) * PLOT_W);
  const y = (v: number) => PAD_TOP + (1 - Math.max(0, Math.min(1, v / maxScore))) * plotH;

  const points = marks.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const passY = y(passMark);

  // Clamped here rather than in state: the page loads more rows as you page,
  // and a stale cursor must never point past the end of the window.
  const active = Math.min(cursor ?? count - 1, count - 1);
  const activeSession = scored[active];
  const activeSplit = domainCases.find((entry) => entry.sessionId === activeSession.id)?.points;

  const summarySentence = `Your mark on each of your ${count} marked cases, oldest first, from ${marks[0].toFixed(1)} to ${marks[count - 1].toFixed(1)} out of ${fmtMark(maxScore)}. The pass mark is ${fmtMark(passMark)}.`;

  const stamp = activeSession.completedAt ? new Date(activeSession.completedAt) : null;
  const stampLabel = stamp && Number.isFinite(stamp.getTime()) ? format(stamp, 'd MMM') : null;

  const splitText = activeSplit
    ? ' ' +
      DOMAIN_ORDER.filter((domain) => typeof activeSplit[domain] === 'number')
        .map(
          (domain) =>
            `${DOMAIN_DISPLAY_NAMES[domain]} ${activeSplit[domain]!.toFixed(1)} of ${DOMAIN_MAX_POINTS[domain]}.`,
        )
        .join(' ')
    : '';

  const valueText = `Case ${active + 1} of ${count}. ${activeSession.stationTitle}${
    stampLabel ? `, ${stampLabel}` : ''
  }, ${activeSession.weightedScore.toFixed(1)} out of ${fmtMark(activeSession.maxScore)}, ${
    activeSession.passed ? 'passed' : 'not passed'
  }.${splitText}`;

  /**
   * The readout goes beside the cursor, never over it.
   *
   * Centring it on the point buried the one dot the reader is asking about
   * under the card describing it. So it takes whichever side has more room —
   * right of the cursor in the first half of the series, left of it in the
   * second — and is anchored by that edge, which also keeps it inside the chart
   * at both ends without needing to guess its width.
   *
   * Percent rather than viewBox units because the card is HTML over the svg and
   * scales with the container, which the fixed viewBox does not.
   */
  const cursorPct = (x(active) / VIEW_W) * 100;
  const readoutOnRight = active < (count - 1) / 2;
  /**
   * Custom properties rather than `left`/`right` directly, because the phone
   * layout is different and an inline style cannot carry a media query. Below
   * `sm` the card spans the chart — a 280px card beside a cursor on a 295px
   * plot is not "beside" anything, and a finger is already covering the point —
   * and from `sm` up these take over. The unused edge is `auto` so whichever
   * side wins does not fight a stale value from the other.
   */
  const readoutStyle = {
    '--readout-left': readoutOnRight ? `${cursorPct + READOUT_GAP_PCT}%` : 'auto',
    '--readout-right': readoutOnRight ? 'auto' : `${100 - cursorPct + READOUT_GAP_PCT}%`,
  } as CSSProperties;

  function moveTo(index: number) {
    setCursor(index);
    setInspecting(true);
  }

  function indexFromClientX(clientX: number): number | null {
    const frame = frameRef.current;
    if (!frame) return null;
    const viewX = clientXToViewX(clientX, frame.getBoundingClientRect());
    if (viewX === null) return null;
    return nearestPointIndex(viewX, count);
  }

  /**
   * Hover, not just drag. A mouse crossing the chart inspects it with nothing
   * pressed; `draggingRef` still matters for touch, where the only way to track
   * a finger is a captured pointer.
   */
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' && !draggingRef.current) return;
    const index = indexFromClientX(event.clientX);
    if (index === null) return;
    moveTo(index);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const index = indexFromClientX(event.clientX);
    if (index === null) return;
    // Capture so a drag that wanders off the chart — or off the window — keeps
    // reporting to us, and so we are guaranteed the matching up/cancel.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone; the move handlers simply never fire.
    }
    draggingRef.current = true;
    moveTo(index);
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Never captured, or already released.
    }
    draggingRef.current = false;
    // A mouse keeps its readout until it leaves; a finger has nothing hovering
    // once it lifts, so the readout goes with it.
    if (event.pointerType !== 'mouse') setInspecting(false);
  }

  function handlePointerLeave() {
    if (draggingRef.current) return;
    setInspecting(false);
  }

  function handleFocus() {
    // A press focuses the frame too; the drag already owns the interaction.
    if (draggingRef.current) return;
    moveTo(active);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = Math.min(count - 1, active + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = Math.max(0, active - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      case 'Escape':
        setInspecting(false);
        return;
      default:
        return;
    }
    // Swallowed even at an edge, so ArrowDown on the first case does not scroll
    // the chart out from under the cursor.
    event.preventDefault();
    moveTo(next);
  }

  return (
    <div className="mb-5 rounded-[10px] border border-hairline bg-surface-raised px-4 py-3.5">
      {/* The sentence that used to be the svg's aria-label. Read in place,
          rather than hanging off a graphic whose role hides its contents. */}
      <p className="sr-only">{summarySentence}</p>

      <div
        ref={frameRef}
        role="slider"
        tabIndex={0}
        aria-label={`Inspect your ${count} marked cases`}
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={active + 1}
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

          <motion.polyline
            points={points}
            fill="none"
            stroke="#B45309"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            // Reduced motion collapses the draw rather than skipping `initial`,
            // the same way ArcGauge does — branching on `initial` hands React
            // different markup to hydrate, because the server cannot know the
            // preference.
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 1.4, ease: [0.3, 0.7, 0.4, 1] }
            }
          />

          {marks.map((v, i) => (
            <motion.circle
              key={scored[i].id}
              cx={x(i)}
              cy={y(v)}
              r={i === count - 1 ? 4.5 : 3.5}
              fill="#B45309"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                shouldReduceMotion ? { duration: 0 } : { delay: 0.13 + i * 0.09, duration: 0.3 }
              }
            />
          ))}

          {/* The cursor. A rule the full height of the plot, plus a ring on the
              point itself — the dot's height IS the case's mark now, so unlike
              the rolling-average chart this ring can sit on it without
              claiming a number the readout does not show. */}
          <motion.g
            initial={false}
            animate={{ opacity: inspecting ? 1 : 0 }}
            // Fades in, but leaves at once: the readout card unmounts rather
            // than fading, and a ring still visible over a chart with nothing
            // labelling it reads as a stuck cursor.
            transition={shouldReduceMotion || !inspecting ? { duration: 0 } : { duration: 0.12 }}
          >
            <line
              x1={x(active)}
              y1={PAD_TOP - 8}
              x2={x(active)}
              y2={VIEW_H - PAD_BOTTOM + 6}
              stroke="rgba(28,25,23,0.28)"
              strokeWidth="1"
            />
            <circle
              cx={x(active)}
              cy={y(activeSession.weightedScore)}
              r="7"
              fill="none"
              stroke="#B45309"
              strokeWidth="2"
            />
          </motion.g>
        </svg>

        {/* The readout, over the chart rather than in a row of its own: a card
            that reserved space would leave a hole whenever nothing is hovered,
            and one that pushed the page around on hover would be worse. Never
            takes the pointer — catching it would end the hover that made it. */}
        {inspecting && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-1 z-10 rounded-[10px] border border-hairline bg-surface-raised px-3 py-2.5 shadow-elevation-4 sm:inset-x-auto sm:left-[var(--readout-left)] sm:right-[var(--readout-right)] sm:w-max sm:max-w-[280px]"
            style={readoutStyle}
          >
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[12px] font-medium text-heading">
                {activeSession.stationTitle}
              </span>
              {stampLabel && (
                <span className="flex-shrink-0 font-mono text-[10px] text-muted">{stampLabel}</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="font-mono text-[15px] font-bold tabular-nums text-heading">
                {activeSession.weightedScore.toFixed(1)}
              </span>
              <span className="font-mono text-[11px] text-muted">
                of {fmtMark(activeSession.maxScore)}
              </span>
              {activeSession.passed && <OutcomeGlyph kind="pass" className="flex-shrink-0" />}
            </div>
            <DomainSplit split={activeSplit} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * How one case's mark was made up, as three bars.
 *
 * Renders nothing at all when the case has no stored breakdown. That is a real
 * state, not an error: the query feeding this reads whole result blobs and so
 * covers only the recent window, and older cases predate the field entirely.
 * A row of empty bars would read as three zeroes, which is a different and
 * much worse claim than saying nothing.
 */
function DomainSplit({ split }: { split?: Partial<Record<DomainKey, number>> }) {
  if (!split) return null;
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

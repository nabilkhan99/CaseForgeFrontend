'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { format } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import OutcomeGlyph from '@/components/ui/OutcomeGlyph';
import type { SessionHistoryItem } from '@/lib/supabase/queries/dashboard';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';
import { passMarkFor, fmtMark } from '@/lib/clinical-master/scoring';

/** Below this there is no shape to show, only noise. */
const MIN_POINTS = 4;
/**
 * Most recent N scored cases. Effectively "everything": the bank is 200 cases,
 * so this is a runaway guard, not a window — the chart is the programme, and a
 * ten-case cap made it disagree with every other number on the page.
 */
const WINDOW = 400;

/**
 * Rolling average width for a given history length. Grows with the history:
 * three cases of smoothing reads honestly over a dozen points but turns two
 * months of practice into a scribble, while an eight-case mean over ten points
 * would just be the total average drawn twice.
 */
export function smoothWidthFor(count: number): number {
  if (count < 12) return 3;
  if (count < 30) return 5;
  return 8;
}

const VIEW_W = 520;
const VIEW_H = 170;
const PAD_TOP = 24;
const PAD_BOTTOM = 20;
const PAD_X = 14;

/** Plot width in viewBox units — the span the points are laid out across. */
const PLOT_W = VIEW_W - PAD_X * 2;

/**
 * A trailing mean of the last `window` values, one per input value.
 *
 * Extracted and exported because the scrub readout has to be explicit about
 * which of two numbers it is showing, and `rolling[i] !== values[i]` is the
 * whole reason that question exists.
 */
export function rollingMean(values: readonly number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - (window - 1)), i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

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
}

/**
 * M4 — "am I getting better?", which a flat list of identical rows cannot answer.
 *
 * Plots the rolling average rather than raw scores: one bad case in an otherwise
 * rising run should not read as a collapse.
 *
 * The headline adapts and the chart does not. An earlier draft hid the chart
 * when the trend was flat or falling, which is worse than unkind — it withholds
 * someone's own data at exactly the moment they most need to see it. So the
 * data always shows; only the framing changes. Rising gets "up X since you
 * started"; anything else gets a neutral title and no verdict, because a
 * candidate can read a downward line perfectly well without being told.
 *
 * SCRUB — drag along the chart and the headline becomes that case.
 *
 * WHICH NUMBER THE READOUT SHOWS. Two different numbers exist at every point:
 * the case's own mark, and the rolling mean of it and the two before it, which
 * is what the dot's height actually is. The readout leads with the case's own
 * mark — that is the number the row further down the page shows, the number the
 * feedback report shows, and the only one the reader means by "how did I do on
 * that one". Printing 6.5 at the height of 5.4 would be a lie, so two things
 * stop it being one: the cursor is a full-height vertical line rather than a
 * point, so nothing claims a height for the mark; and the caption under the
 * chart names the line's own value at the cursor while you are there. The
 * distinction is stated rather than smoothed over.
 *
 * WHICH SESSION. `scored` is reversed relative to `sessions` so the chart reads
 * oldest to newest. Everything the readout needs is on the reversed row itself,
 * so the cursor indexes `scored` directly and there is no second array to fall
 * out of step with — the same identity that keys the circles.
 *
 * TOUCH. Pointer events with capture, so a drag that leaves the chart keeps
 * scrubbing. `touch-action: pan-y` rather than `none`: the chart is ~290px tall
 * at the dashboard measure, and `none` would make that a block of the page a
 * thumb cannot scroll past. `pan-y` gives the browser the vertical axis and
 * keeps the horizontal one, which is the axis this gesture uses — a vertical
 * swipe scrolls the page and cancels the scrub, a horizontal one inspects.
 *
 * KEYBOARD. One tab stop, arrows along the series, same as the station board.
 * `role="slider"` because that is what a one-dimensional cursor over an ordered
 * series is, and it is the role screen readers announce a `aria-valuetext` for
 * on every move — so arrowing across reads out each case rather than silence.
 *
 * The svg is aria-hidden and carries no `role="img"`. It used to: `role="img"`
 * prunes every descendant from the accessibility tree, which is fine for a
 * static picture and fatal next to anything interactive. The sentence that was
 * its label is now a visually-hidden paragraph, where it is read in document
 * order instead of being attached to a graphic nobody can reach into.
 */
export default function ScoreTrend({ sessions }: ScoreTrendProps) {
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
  /** Which hint to offer. A keyboard user has nothing to "release". */
  const [mode, setMode] = useState<'pointer' | 'key'>('pointer');

  const scored = sessions
    .filter((s) => s.outcome === 'scored')
    .slice(0, WINDOW)
    .reverse(); // oldest → newest, the direction a chart reads

  if (scored.length < MIN_POINTS) return null;

  const count = scored.length;
  const maxScore = scored[0]?.maxScore || MAX_WEIGHTED_SCORE;
  const passMark = passMarkFor(maxScore);

  const smooth = smoothWidthFor(scored.length);
  const rolling = rollingMean(
    scored.map((s) => s.weightedScore),
    smooth,
  );

  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (count === 1 ? PLOT_W / 2 : (i / (count - 1)) * PLOT_W);
  const y = (v: number) => PAD_TOP + (1 - Math.max(0, Math.min(1, v / maxScore))) * plotH;

  const points = rolling.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const passY = y(passMark);

  const delta = rolling[rolling.length - 1] - rolling[0];
  const rising = delta >= 0.3;

  // Clamped here rather than in state: the page loads more rows as you page,
  // and a stale cursor must never point past the end of the window.
  const active = Math.min(cursor ?? count - 1, count - 1);
  const activeSession = scored[active];
  const activeRolling = rolling[active];

  const summarySentence = `Rolling average score across your ${count} marked cases, from ${rolling[0].toFixed(1)} to ${rolling[count - 1].toFixed(1)} out of ${fmtMark(maxScore)}. The pass mark is ${fmtMark(passMark)}.`;

  const stamp = activeSession.completedAt ? new Date(activeSession.completedAt) : null;
  const stampLabel = stamp && Number.isFinite(stamp.getTime()) ? format(stamp, 'EEE HH:mm') : null;

  const valueText = `Case ${active + 1} of ${count}. ${activeSession.stationTitle}${
    stampLabel ? `, ${stampLabel}` : ''
  }, ${activeSession.weightedScore.toFixed(1)} out of ${fmtMark(activeSession.maxScore)}, ${
    activeSession.passed ? 'passed' : 'not passed'
  }. Rolling average here ${activeRolling.toFixed(1)}.`;

  function moveTo(index: number, next: 'pointer' | 'key') {
    setCursor(index);
    setMode(next);
    setInspecting(true);
  }

  function indexFromClientX(clientX: number): number | null {
    const frame = frameRef.current;
    if (!frame) return null;
    const viewX = clientXToViewX(clientX, frame.getBoundingClientRect());
    if (viewX === null) return null;
    return nearestPointIndex(viewX, count);
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
    moveTo(index, 'pointer');
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const index = indexFromClientX(event.clientX);
    if (index !== null) setCursor(index);
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Never captured, or already released.
    }
    draggingRef.current = false;
    setInspecting(false);
  }

  function handleFocus() {
    // A press focuses the frame too; the drag already owns the interaction.
    if (draggingRef.current) return;
    moveTo(active, 'key');
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
    moveTo(next, 'key');
  }

  return (
    <div className="mb-5 rounded-[10px] border border-hairline bg-surface-raised px-4 py-3.5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted">
            {inspecting
              ? `${stampLabel ? `${stampLabel} · ` : ''}case ${active + 1} of ${count}`
              : `Your ${count} marked cases`}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5 text-[15px] font-semibold text-heading">
            {inspecting ? (
              <>
                <span className="truncate">{activeSession.stationTitle}</span>
                <span className="text-muted">&mdash;</span>
                <span className="font-mono tabular-nums">
                  {activeSession.weightedScore.toFixed(1)}
                </span>
                {activeSession.passed && (
                  <OutcomeGlyph kind="pass" className="self-center flex-shrink-0" />
                )}
              </>
            ) : (
              <span>
                {rising ? `Up ${delta.toFixed(1)} since you started` : 'How your average is moving'}
              </span>
            )}
          </div>
        </div>

        {inspecting ? (
          <span className="flex-shrink-0 font-mono text-[11px] text-muted">
            {mode === 'key' ? '← → to move' : 'release to see your average'}
          </span>
        ) : (
          rising && (
            <span className="flex-shrink-0 font-mono text-[13px] font-medium text-success">
              &#8599; improving
            </span>
          )
        )}
      </div>

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
          <text x="0" y={passY - 7} fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#8A817A">
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

          {rolling.map((v, i) => (
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

          {/* The cursor. A full-height rule, not a dot: the case's own mark and
              the line's value sit at two different heights, and a rule does not
              claim either of them. Position is set directly rather than
              animated, so it tracks the finger instead of chasing it — only the
              fade in and out is motion, and reduced motion takes even that. */}
          <motion.g
            initial={false}
            animate={{ opacity: inspecting ? 1 : 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12 }}
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
              cy={y(activeRolling)}
              r="7"
              fill="none"
              stroke="#B45309"
              strokeWidth="2"
            />
          </motion.g>
        </svg>
      </div>

      <p className="mt-2 font-mono text-[11px] text-muted">
        {inspecting
          ? `Line here ${activeRolling.toFixed(1)} · rolling average of your last ${smooth}`
          : `Rolling average of your last ${smooth} · drag across to see each case`}
      </p>
    </div>
  );
}

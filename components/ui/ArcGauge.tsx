'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * One value against its maximum, drawn as an open dial.
 *
 * A bar says "57% of the way along". A dial says "here, on a scale that has a
 * top and a threshold" — which is the shape of the question a candidate is
 * actually asking of an exam score. The gap at the bottom is where the number
 * sits, so the arc reads as belonging to it rather than decorating it.
 *
 * Deliberately generic: it knows nothing about the SCA. Callers pass the
 * colour (Tailwind `bg-*` classes do not paint SVG strokes, so this takes a
 * real colour value), the threshold to mark, and whatever belongs in the
 * middle. The report passes a domain tone; the dashboard can pass anything.
 */

/** Degrees of arc actually drawn. 270 leaves a 90° gap at the bottom. */
export const SWEEP_DEGREES = 270;
/** How far the threshold tick overhangs the track on each side, in px. */
const TICK_OVERHANG = 4;
/** Breathing room below the arc's lowest painted pixel, in px. */
const BOTTOM_PAD = 2;

const START_DEGREES = -SWEEP_DEGREES / 2;
const END_DEGREES = SWEEP_DEGREES / 2;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** A point on the dial. Degrees run clockwise from 12 o'clock. */
export function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  degrees: number
): { x: number; y: number } {
  const angle = toRadians(degrees);
  return {
    x: round2(cx + radius * Math.sin(angle)),
    y: round2(cy - radius * Math.cos(angle)),
  };
}

/** SVG path for the arc between two angles, drawn clockwise. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startDegrees: number,
  endDegrees: number
): string {
  const from = polarPoint(cx, cy, radius, startDegrees);
  const to = polarPoint(cx, cy, radius, endDegrees);
  const largeArc = Math.abs(endDegrees - startDegrees) > 180 ? 1 : 0;
  const sweep = endDegrees >= startDegrees ? 1 : 0;
  const r = round2(radius);
  return `M ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${to.x} ${to.y}`;
}

/** `value` as a 0–1 fraction of `max`, clamped, and 0 for nonsense inputs. */
export function gaugeFraction(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

/** The angle a 0–1 fraction sits at on the dial. */
export function fractionAngle(fraction: number): number {
  return START_DEGREES + Math.max(0, Math.min(1, fraction)) * SWEEP_DEGREES;
}

/**
 * Height of the tightest viewBox that still contains the whole arc.
 *
 * A 270° dial leaves ~29% of its radius empty below the two ends. Rendering a
 * square box would pay for that emptiness in vertical space on every surface
 * the gauge appears on, so the box is cropped to the lowest painted pixel.
 */
export function arcBoxHeight(size: number, radius: number, thickness: number): number {
  const lowestPoint = size / 2 - radius * Math.cos(toRadians(END_DEGREES));
  return Math.round(lowestPoint + thickness / 2 + TICK_OVERHANG + BOTTOM_PAD);
}

/** One decimal at most — "6" stays "6", "6.25" becomes "6.3". */
function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export interface ArcGaugeProps {
  /** Where the arc fills to. */
  value: number;
  /** The top of the scale. */
  max: number;
  /** Marked with a tick: a pass mark, a target, a previous best. */
  threshold?: number | null;
  /** Outer width in px. The gauge never renders wider than its container. */
  size?: number;
  /** Arc thickness in px. */
  thickness?: number;
  /** Stroke colour of the filled arc — a real colour, not a Tailwind class. */
  colour?: string;
  /** Stroke colour of the unfilled track. */
  trackColour?: string;
  /** Full sentence for screen readers. Falls back to a plain value/max reading. */
  label?: string;
  /** Seconds to wait before the arc sweeps, for staggering with siblings. */
  delay?: number;
  /** Rendered centred inside the dial — normally the number itself. */
  children?: ReactNode;
  className?: string;
}

export default function ArcGauge({
  value,
  max,
  threshold = null,
  size = 224,
  thickness = 13,
  colour = '#B45309',
  trackColour = 'rgba(28,25,23,0.08)',
  label,
  delay = 0,
  children,
  className = '',
}: ArcGaugeProps) {
  const shouldReduceMotion = useReducedMotion();

  const centre = size / 2;
  const radius = Math.max(1, centre - thickness / 2 - TICK_OVERHANG);
  const boxHeight = arcBoxHeight(size, radius, thickness);
  const track = arcPath(centre, centre, radius, START_DEGREES, END_DEGREES);

  const fraction = gaugeFraction(value, max);
  const thresholdFraction = threshold == null ? null : gaugeFraction(threshold, max);

  // Same convention as the linear bar this replaced: a bare hairline at the
  // threshold, `bg-heading/40`, stated in prose underneath rather than labelled.
  const tick =
    thresholdFraction === null
      ? null
      : (() => {
        const angle = fractionAngle(thresholdFraction);
        const inner = polarPoint(centre, centre, radius - thickness / 2 - TICK_OVERHANG, angle);
        const outer = polarPoint(centre, centre, radius + thickness / 2 + TICK_OVERHANG, angle);
        return { inner, outer };
      })();

  const ariaLabel =
    label ??
    (threshold == null
      ? `${fmt(value)} out of ${fmt(max)}`
      : `${fmt(value)} out of ${fmt(max)}. The threshold is ${fmt(threshold)}.`);

  return (
    <div className={`relative ${className}`} style={{ width: size, maxWidth: '100%' }}>
      <svg
        viewBox={`0 0 ${size} ${boxHeight}`}
        className="block h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <path
          d={track}
          fill="none"
          stroke={trackColour}
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {/* Nothing to draw at zero, and a zero-length dash with a round cap
            paints a stray dot in some renderers. */}
        {fraction > 0 && (
          <motion.path
            d={track}
            fill="none"
            stroke={colour}
            strokeWidth={thickness}
            strokeLinecap="round"
            // Reduced motion collapses the sweep to nothing rather than
            // skipping `initial`: the server cannot know the preference, so
            // branching on `initial` would hand React different markup to
            // hydrate. A zero-duration transition lands on the final arc in
            // the same frame, with no sweep and no hydration mismatch.
            initial={{ pathLength: 0 }}
            animate={{ pathLength: fraction }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 1.1, delay, ease: [0.3, 0.7, 0.4, 1] }
            }
          />
        )}

        {tick && (
          <line
            x1={tick.inner.x}
            y1={tick.inner.y}
            x2={tick.outer.x}
            y2={tick.outer.y}
            stroke="rgba(28,25,23,0.4)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>

      {children && (
        <div
          className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
          style={{
            top: `${(centre / boxHeight) * 100}%`,
            // Roughly the square that fits inside the track, so a caller's
            // content wraps rather than running under the arc. Kept as a
            // percentage so it still holds when the gauge is scaled down to
            // fit a narrow container.
            maxWidth: `${(((radius - thickness / 2) * 1.6) / size) * 100}%`,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

import { TONE_COLOUR } from '@/lib/clinical-master/scoring';

/**
 * Three marks for the three things that happen to a session.
 *
 *   pass       a tick, filled and green — the notable event
 *   partial    a half-filled ring — marked, but short of the pass mark
 *   left-early a slashed ring — the consultation was never finished
 *
 * One family so the outcome column reads as a column: same 12px box, same ring
 * geometry, only the fill changing. The tick is the odd one out on purpose —
 * it is the shape everybody already reads as "yes", and it was here first.
 *
 * WEIGHT — the fail mark is deliberately lighter than the pass mark.
 * Its colour is the danger token, but drawn as a thin outline at reduced
 * opacity rather than a solid stamp. The complaint that removed the old FAIL
 * label was "a column of red", and a saturated red disc on every unsuccessful
 * row recreates it exactly. Half-filled reads as "partway" at a glance; the
 * exact score is already sitting next to it.
 *
 * "left early" takes no tone colour at all — the history row already renders
 * unfinished sessions muted and never coloured, and a third hue in that column
 * would undo it.
 *
 * ACCESSIBILITY — these are decoration with a text equivalent, always.
 * Every glyph is aria-hidden and every caller pairs it with a `sr-only` span
 * carrying the same fact in words, so colour and shape are never the only
 * channel. No tabindex and no handlers: the whole history row is one link, and
 * a focusable glyph inside it would add a tab stop that goes nowhere.
 *
 * No hooks and no client directive — this renders on the server.
 */

export type OutcomeGlyphKind = 'pass' | 'partial' | 'left-early';

/** Thin ring, so a not-passed row never reads as heavier than a passed one. */
const RING_STROKE = 2;
/** How far the fail mark is pulled back from full saturation. */
const FAIL_OPACITY = 0.65;

interface OutcomeGlyphProps {
  kind: OutcomeGlyphKind;
  /** Box size in px. 12 matches the score type it sits beside. */
  size?: number;
  className?: string;
}

export default function OutcomeGlyph({ kind, size = 12, className = '' }: OutcomeGlyphProps) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    focusable: false as const,
    className,
  };

  if (kind === 'pass') {
    return (
      <svg {...shared} fill="none" stroke={TONE_COLOUR.pass} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }

  if (kind === 'partial') {
    return (
      <svg {...shared} fill="none" stroke={TONE_COLOUR.fail} strokeWidth={RING_STROKE} opacity={FAIL_OPACITY}>
        <circle cx="12" cy="12" r="9" />
        {/* The left half of the same circle, filled: "some of the way". */}
        <path d="M 12 3 A 9 9 0 0 0 12 21 Z" fill={TONE_COLOUR.fail} stroke="none" />
      </svg>
    );
  }

  return (
    <svg
      {...shared}
      fill="none"
      stroke="currentColor"
      strokeWidth={RING_STROKE}
      strokeLinecap="round"
      className={`text-muted ${className}`}
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="5.6" y1="18.4" x2="18.4" y2="5.6" />
    </svg>
  );
}

interface LockGlyphProps {
  /**
   * What the lock means here. It is the glyph's accessible name, so it has to
   * name the thing being withheld, not the shape — "Locked" on its own tells a
   * screen-reader user nothing they can act on.
   */
  label: string;
  className?: string;
}

/**
 * Quiet marker for something the plan doesn't include.
 *
 * Extracted from AppNavbar, where the navbar's own rule is written down: the
 * tab stays, because hiding it means the trainee never learns the thing exists,
 * and disabling it reads as broken. The page behind it carries the upsell. The
 * library rows a cohort student can't open follow exactly that rule, so they
 * use exactly this glyph rather than a second drawing of it.
 */
export default function LockGlyph({ label, className = 'ml-1 opacity-40 inline-block align-[-1px]' }: LockGlyphProps) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-label={label} className={className}>
      <rect x="2.5" y="5.5" width="7" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

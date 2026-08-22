/**
 * Deadline arithmetic for the consultation and reading clocks.
 *
 * Counting down by decrementing a number once per `setInterval` tick is wrong on
 * a phone: iOS Safari and Chrome both throttle timers in a backgrounded tab (to
 * ~1/min, and to zero once the tab is frozen), so a 12-minute station that spent
 * two minutes behind the lock screen would still show ~10 minutes left. Storing
 * an absolute end timestamp and deriving the remaining time on every tick makes
 * the clock immune to how often — or whether — it ticks.
 */

/** Absolute epoch-ms deadline for a countdown started at `startMs`. */
export function deadlineFrom(startMs: number, durationSeconds: number): number {
  return startMs + Math.max(0, durationSeconds) * 1000;
}

/**
 * Whole seconds left, never negative. Rounded up so a countdown shows its full
 * duration on the first paint (12:00, not 11:59) and only reaches 0 at the
 * deadline itself.
 */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/** Zero-padded mm:ss. Minutes are not capped — a 90-minute clock reads "90:00". */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

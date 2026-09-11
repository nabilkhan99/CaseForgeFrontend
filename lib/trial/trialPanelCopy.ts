/**
 * Every sentence the dashboard's trial panel says, as pure functions.
 *
 * Split out of the component for one reason: this copy is the product's own
 * account of a deadline somebody is planning their week around, and getting it
 * wrong by a day is the kind of error that is only ever noticed by the person
 * it costs. A React component rendered in jsdom is an awkward place to pin
 * "four hours left reads as *Ends today*, not *0 days left*"; a function that
 * takes a number and returns a string is not. The panel renders these; it does
 * not decide them.
 *
 * THE COPY RULES, which are rules rather than taste (they come from the trial
 * handoff and hold across the panel, the wall and the two emails):
 *   * the reader is never told they are on a "trial". The offer is five cases,
 *     unlimited attempts, five days;
 *   * the five are CASES, never stations. "Station" is the whole bank's word
 *     (200 of them) and using it for the five makes two numbers about two
 *     things share a noun;
 *   * nothing is described as "cases left" any more — attempts are unlimited,
 *     so the only countable things are CASES TRIED and DAYS;
 *   * no invented urgency. The deadline is real (`trial_grants.expires_at`) and
 *     is stated as a date.
 */

/**
 * Counting words. The offer is five of everything, so this never needs to go
 * far — but it goes to ten so a hand-made grant with a longer window does not
 * suddenly render digits in the middle of a sentence.
 */
const NUMBER_WORD: readonly string[] = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]

/** The word for a small number, or the digits when it is out of range. */
export function numberWord(n: number): string {
  return NUMBER_WORD[n] ?? String(n)
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/**
 * The panel's title line: "Unlimited attempts · five cases".
 *
 * The count comes from the flagged stations rather than a literal five, so a
 * bank with four flagged (or a hand-made grant) describes itself honestly. The
 * "unlimited attempts" half is first on purpose — it is the part of the offer
 * that changed, and the part a trainee who saw the old five-consultation
 * version needs to have corrected.
 *
 * CASES, not stations, and it is the same word the progress line under it
 * uses: the two lines count the same five things and must not name them
 * differently. "Station" is the word the product uses for the whole bank — the
 * 200 — which is a different number about a different thing.
 */
export function trialTitleLine(caseCount: number): string {
  return `Unlimited attempts · ${numberWord(caseCount)} ${plural(caseCount, 'case', 'cases')}`
}

/** "three of five cases tried" — the progress line, in the panel's own words. */
export function trialProgressLine(casesTried: number, caseCount: number): string {
  const tried = Math.max(0, Math.min(casesTried, caseCount))
  return `${tried} of ${caseCount} ${plural(caseCount, 'case', 'cases')} tried`
}

export interface TrialCountdown {
  /** The line that carries the deadline. Always present. */
  headline: string
  /** "Ends Thursday 12 September", or null when there is no date to give yet. */
  endsOn: string | null
  /**
   * The last day, or already over. The panel tints itself on this rather than
   * re-deriving the rule — the same "status is quiet, a deadline that can still
   * change the outcome is not" convention the expiry prompts on that page use.
   */
  urgent: boolean
}

/**
 * "Thursday 12 September", in the reader's own timezone.
 *
 * NOT forced to UTC, unlike the coaching-day and plan-expiry dates on the
 * dashboard. Those are stored as calendar days (`YYYY-MM-DD`) and reading them
 * locally would shift them by one; this is a real instant, so the reader's own
 * day is the true answer to "when does this stop working".
 */
export function formatTrialEndDay(iso: string): string {
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return ''
  return when.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Where the five days stand, in one line.
 *
 * `daysLeft` is the server's own count (see /api/subscription) — null while the
 * window has not opened, and rounded up so a few hours left is 1 rather than 0.
 * Saying "your five days start with your first consultation" out loud is the
 * point of the null case: somebody handed a link on a Friday needs to know the
 * weekend is not being spent, and it is the single most common question the
 * old strip got wrong by staying silent.
 */
export function trialCountdown(
  daysLeft: number | null,
  expiresAt: string | null,
  windowDays: number,
): TrialCountdown {
  const endsOn = expiresAt ? formatTrialEndDay(expiresAt) || null : null

  if (daysLeft === null) {
    return {
      headline: `Your ${numberWord(windowDays)} days start with your first consultation`,
      endsOn: null,
      urgent: false,
    }
  }
  if (daysLeft <= 0) {
    return { headline: `Your ${numberWord(windowDays)} days are up`, endsOn, urgent: true }
  }
  if (daysLeft === 1) {
    return { headline: 'Ends today', endsOn, urgent: true }
  }
  return { headline: `${daysLeft} days left`, endsOn, urgent: false }
}

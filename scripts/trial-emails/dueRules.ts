import type { TrialEmailKind, TrialMark } from '@/lib/email/trialEmails'

/**
 * Who is due a trial email, decided as a pure function of facts.
 *
 * Split out of due.ts on purpose. The runner does IO against the production
 * database and can then SEND EMAIL TO REAL PEOPLE; the rules that decide who
 * receives one are the part most likely to be wrong and the part impossible to
 * test by running it. Everything here takes a record and a clock and returns a
 * decision, so every edge — a window that has not opened, a buyer, a founder's
 * own address, a day the script was not run — is a fixture rather than a live
 * experiment on somebody's inbox.
 */

const DAY_MS = 86_400_000

/** Day 3 of a 5-day window. The email says "two days left" and it has to be true. */
export const DAY3_AFTER_DAYS = 3

/**
 * How long the day-3 email stays sendable once it comes due.
 *
 * ONE DAY, and this is the interesting rule in the file. The subject line
 * counts the days left — a sentence that is true on day 3 and false on day 4.
 * The script is run by hand each morning, so a 24-hour window means a daily run
 * catches everybody exactly once, and a day Nabil does not run it means those
 * people simply do not get a day-3 email. That is the right trade-off: a missed
 * nudge costs nothing, and an email that tells somebody they have two days when
 * they have one is the product lying about its own deadline.
 */
export const DAY3_WINDOW_DAYS = 1

/**
 * How long after a trial ends the day-5 email may still go out.
 *
 * A backstop against the first run of this script mailing every trial account
 * that has ever existed. "Your five days are up" stays true for ever, which is
 * exactly why it needs a limit: nobody wants a summary of a week they finished
 * in the spring. Fourteen days is wide enough to survive a fortnight's holiday
 * and narrow enough that a first run cannot become a blast.
 */
export const DAY5_STALE_AFTER_DAYS = 14

/**
 * Addresses that are ours, not customers'.
 *
 * Matched as prefixes against the local part or the whole address, mirroring
 * the `nabilkhan%`, `ishaq%`, `hello@%` patterns the send list has always been
 * cleaned with by hand. These accounts run trials constantly while testing; a
 * founder receiving "your five stations have ended" is harmless, a founder's
 * address being in a Brevo send is a slightly worse sender reputation and a
 * confusing analytics row.
 */
export const INTERNAL_PREFIXES: readonly string[] = ['nabilkhan', 'ishaq', 'hello@']

/** Substrings anywhere in the address that mean the same thing. */
export const INTERNAL_SUBSTRINGS: readonly string[] = ['shalimar', 'useoffscript']

/**
 * Throwaway inbox providers.
 *
 * Somebody who signed up with a ten-minute address is not reachable, and
 * mailing a disposable domain earns bounces against a sending domain that has
 * to keep working for receipts and set-password links. Not exhaustive and never
 * will be — this is the list of the ones actually seen in `trial_leads`, plus
 * the common ones. Add to it rather than replacing it.
 */
export const DISPOSABLE_DOMAINS: readonly string[] = [
  '10minutemail.com',
  'dispostable.com',
  'guerrillamail.com',
  'getnada.com',
  'mailinator.com',
  'maildrop.cc',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]

/** True for an address that must never receive one of these emails. */
export function isExcludedAddress(rawEmail: string): boolean {
  const email = rawEmail.trim().toLowerCase()
  if (!email || !email.includes('@')) return true
  if (INTERNAL_PREFIXES.some((prefix) => email.startsWith(prefix))) return true
  if (INTERNAL_SUBSTRINGS.some((needle) => email.includes(needle))) return true
  const domain = email.slice(email.lastIndexOf('@') + 1)
  return DISPOSABLE_DOMAINS.some((bad) => domain === bad || domain.endsWith(`.${bad}`))
}

/** One account's facts, as the runner assembles them. */
export interface TrialEmailCandidate {
  userId: string
  email: string
  /** From `trial_leads.first_name`; null greets them as "there". */
  firstName: string | null
  /** How many cases the trial opens — the flagged five. */
  casesTotal: number
  /** How many of them they have actually sat. Attempts are unlimited, so this is 0–5. */
  casesTried: number
  windowDays: number
  /** Null until the first consultation — the clock is not running and nothing is due. */
  startedAt: Date | null
  /** `trial_grants.expires_at`; derived from `startedAt` when absent. */
  expiresAt: Date | null
  /**
   * Genuinely-scored consultations, for the day-5 summary. Can be MORE than
   * `casesTotal` now — five cases run three times each is fifteen marks — which
   * is exactly why the copy counts cases and consultations separately.
   */
  marks: readonly TrialMark[]
  /** Any `preorders` row for this address. They bought; they are not a prospect. */
  hasPurchase: boolean
  /** Kinds already recorded in `trial_email_sends`. */
  alreadySent: readonly TrialEmailKind[]
}

export type TrialEmailSkipReason =
  | 'not_started'
  | 'excluded_address'
  | 'buyer'
  | 'already_sent'
  | 'too_early'
  | 'day3_window_missed'
  | 'day5_stale'

export interface TrialEmailDue {
  due: true
  kind: TrialEmailKind
  /** Whole days to `endsAt`, rounded up and floored at zero. Zero for day 5. */
  daysLeft: number
  casesTried: number
  casesTotal: number
  endsAt: Date
}

export type TrialEmailDecision = TrialEmailDue | { due: false; reason: TrialEmailSkipReason }

/** `expires_at`, or what it would have been. Null while the window has not opened. */
export function windowEndsAt(candidate: TrialEmailCandidate): Date | null {
  if (candidate.expiresAt) return candidate.expiresAt
  if (!candidate.startedAt) return null
  return new Date(candidate.startedAt.getTime() + candidate.windowDays * DAY_MS)
}

/**
 * Which email, if any, this account is due right now.
 *
 * DAY 5 IS NOW DUE ON EXPIRY ALONE. It used to be due either when the window
 * closed or when the allowance ran out, and the second is gone: attempts are
 * unlimited, so nothing can be exhausted and the calendar is the whole rule.
 * That also removes the case the old ordering existed to handle — a trial that
 * had ended while its clock still said two days to go — so the order below is
 * simply exclusions, then expiry, then the day-3 window.
 */
export function decideTrialEmail(
  candidate: TrialEmailCandidate,
  now: Date = new Date(),
): TrialEmailDecision {
  if (isExcludedAddress(candidate.email)) return { due: false, reason: 'excluded_address' }
  // Checked before anything about dates: somebody who bought mid-window is a
  // customer, and the day-5 email's whole subject is an offer they have taken.
  if (candidate.hasPurchase) return { due: false, reason: 'buyer' }

  const endsAt = windowEndsAt(candidate)
  if (!candidate.startedAt || !endsAt) return { due: false, reason: 'not_started' }

  const sent = new Set<TrialEmailKind>(candidate.alreadySent)
  const counts = {
    casesTried: Math.max(0, Math.min(candidate.casesTried, candidate.casesTotal)),
    casesTotal: candidate.casesTotal,
    endsAt,
  }

  if (now.getTime() >= endsAt.getTime()) {
    if (sent.has('day5')) return { due: false, reason: 'already_sent' }
    if (now.getTime() > endsAt.getTime() + DAY5_STALE_AFTER_DAYS * DAY_MS) {
      return { due: false, reason: 'day5_stale' }
    }
    return { due: true, kind: 'day5', daysLeft: 0, ...counts }
  }

  // Live window.
  if (sent.has('day3')) return { due: false, reason: 'already_sent' }
  const day3At = candidate.startedAt.getTime() + DAY3_AFTER_DAYS * DAY_MS
  if (now.getTime() < day3At) return { due: false, reason: 'too_early' }
  if (now.getTime() >= day3At + DAY3_WINDOW_DAYS * DAY_MS) {
    return { due: false, reason: 'day3_window_missed' }
  }
  return { due: true, kind: 'day3', daysLeft: daysLeftUntil(endsAt, now), ...counts }
}

/** Whole days to the end of the window, rounded up and floored at zero. */
export function daysLeftUntil(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS))
}

/** Everyone due an email, with the ones who are not and why — a dry run prints both. */
export function selectDueTrialEmails(
  candidates: readonly TrialEmailCandidate[],
  now: Date = new Date(),
): {
  due: (TrialEmailDue & { candidate: TrialEmailCandidate })[]
  skipped: { candidate: TrialEmailCandidate; reason: TrialEmailSkipReason }[]
} {
  const due: (TrialEmailDue & { candidate: TrialEmailCandidate })[] = []
  const skipped: { candidate: TrialEmailCandidate; reason: TrialEmailSkipReason }[] = []

  for (const candidate of candidates) {
    const decision = decideTrialEmail(candidate, now)
    if (decision.due) {
      due.push({ ...decision, candidate })
    } else {
      skipped.push({ candidate, reason: decision.reason })
    }
  }

  return { due, skipped }
}

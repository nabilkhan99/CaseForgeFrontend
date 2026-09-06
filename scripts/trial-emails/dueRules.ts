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
 * ONE DAY, and this is the interesting rule in the file. The subject line is
 * "Two days and N stations left" — a sentence that is true on day 3 and false
 * on day 4. The script is run by hand each morning, so a 24-hour window means a
 * daily run catches everybody exactly once, and a day Nabil does not run it
 * means those people simply do not get a day-3 email. That is the right
 * trade-off: a missed nudge costs nothing, and an email that tells somebody
 * they have two days when they have one is the product lying about its own
 * deadline.
 */
export const DAY3_WINDOW_DAYS = 1

/**
 * How long after a trial ends the day-5 email may still go out.
 *
 * A backstop against the first run of this script mailing every trial account
 * that has ever existed. "Your five stations have ended" stays true for ever,
 * which is exactly why it needs a limit: nobody wants a summary of a week they
 * finished in the spring. Fourteen days is wide enough to survive a fortnight's
 * holiday and narrow enough that a first run cannot become a blast.
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
  allowance: number
  windowDays: number
  /** Null until the first consultation — the clock is not running and nothing is due. */
  startedAt: Date | null
  /** `trial_grants.expires_at`; derived from `startedAt` when absent. */
  expiresAt: Date | null
  /** Genuinely-scored consultations counted against the grant. */
  marks: readonly TrialMark[]
  /** When the most recent of those was marked, for the staleness clock. */
  lastMarkAt: Date | null
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

export type TrialEmailDecision =
  | { due: true; kind: TrialEmailKind; remaining: number; endsAt: Date }
  | { due: false; reason: TrialEmailSkipReason }

/** `expires_at`, or what it would have been. Null while the window has not opened. */
export function windowEndsAt(candidate: TrialEmailCandidate): Date | null {
  if (candidate.expiresAt) return candidate.expiresAt
  if (!candidate.startedAt) return null
  return new Date(candidate.startedAt.getTime() + candidate.windowDays * DAY_MS)
}

/**
 * Which email, if any, this account is due right now.
 *
 * Order matters and is deliberate:
 *   1. exclusions first, so a founder or a buyer is never even considered;
 *   2. day 5 before day 3, because a trial that has ENDED must not receive a
 *      note about how many days are left in it. That case is real — five
 *      stations run on day one exhausts the allowance while the clock still
 *      says two days to go;
 *   3. day 3 only inside its 24-hour window.
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

  const used = candidate.marks.length
  const remaining = Math.max(0, candidate.allowance - used)
  const sent = new Set<TrialEmailKind>(candidate.alreadySent)

  const spent = remaining <= 0
  const expired = now.getTime() >= endsAt.getTime()

  if (spent || expired) {
    if (sent.has('day5')) return { due: false, reason: 'already_sent' }
    // When the allowance ran out first, the trial ended at the last mark, not
    // at the date on the grant — so that is the moment staleness is measured
    // from. Without this a trainee who did all five on day one would be judged
    // stale four days later than they should be.
    const endedAt =
      spent && candidate.lastMarkAt && candidate.lastMarkAt.getTime() < endsAt.getTime()
        ? candidate.lastMarkAt
        : endsAt
    if (now.getTime() > endedAt.getTime() + DAY5_STALE_AFTER_DAYS * DAY_MS) {
      return { due: false, reason: 'day5_stale' }
    }
    return { due: true, kind: 'day5', remaining, endsAt }
  }

  // Live window, stations left.
  if (sent.has('day3')) return { due: false, reason: 'already_sent' }
  const day3At = candidate.startedAt.getTime() + DAY3_AFTER_DAYS * DAY_MS
  if (now.getTime() < day3At) return { due: false, reason: 'too_early' }
  if (now.getTime() >= day3At + DAY3_WINDOW_DAYS * DAY_MS) {
    return { due: false, reason: 'day3_window_missed' }
  }
  return { due: true, kind: 'day3', remaining, endsAt }
}

/** Everyone due an email, with the ones who are not and why — a dry run prints both. */
export function selectDueTrialEmails(
  candidates: readonly TrialEmailCandidate[],
  now: Date = new Date(),
): {
  due: { candidate: TrialEmailCandidate; kind: TrialEmailKind; remaining: number; endsAt: Date }[]
  skipped: { candidate: TrialEmailCandidate; reason: TrialEmailSkipReason }[]
} {
  const due: {
    candidate: TrialEmailCandidate
    kind: TrialEmailKind
    remaining: number
    endsAt: Date
  }[] = []
  const skipped: { candidate: TrialEmailCandidate; reason: TrialEmailSkipReason }[] = []

  for (const candidate of candidates) {
    const decision = decideTrialEmail(candidate, now)
    if (decision.due) {
      due.push({
        candidate,
        kind: decision.kind,
        remaining: decision.remaining,
        endsAt: decision.endsAt,
      })
    } else {
      skipped.push({ candidate, reason: decision.reason })
    }
  }

  return { due, skipped }
}

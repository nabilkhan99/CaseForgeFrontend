/**
 * Pure, dependency-free core for the refer-a-friend loop.
 *
 * Deliberately imports nothing (no Stripe / Supabase / next) so it is trivially
 * unit-testable and safe to import from both server routes and server components.
 * Every value here is a snapshot/constant — no I/O, no mutation.
 */

/** Reward paid to the referrer, keyed by the plan the *referee* bought. Pence. */
export const REWARD_BY_PLAN = {
  complete: 10000, // £100
  self_study: 2500, // £25
} as const

export type RewardablePlan = keyof typeof REWARD_BY_PLAN

/**
 * Reward (in pence) for a referred purchase of the given plan.
 * Unknown / non-rewardable plans (e.g. 'intensive') earn nothing rather than throw,
 * so the webhook can record the referral without crashing.
 */
export function rewardFor(plan: string): number {
  return (REWARD_BY_PLAN as Record<string, number>)[plan] ?? 0
}

/**
 * Unambiguous alphabet for generated codes: A–Z and 2–9 with the visually
 * confusable characters removed (no I, L, O, 0, 1).
 */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const AMBIGUOUS = /[ILO]/g

/**
 * Mint a share code: an optional human-readable prefix from the owner's name
 * plus four random characters from the unambiguous alphabet. The whole code is
 * guaranteed to contain only characters from {@link CODE_ALPHABET}.
 */
export function generateReferralCode(name?: string): string {
  const firstWord = (name ?? '').trim().split(/\s+/)[0] ?? ''
  const prefix =
    firstWord
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .replace(AMBIGUOUS, '')
      .slice(0, 4) || 'FF'

  let suffix = ''
  for (let i = 0; i < 4; i += 1) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return `${prefix}${suffix}`
}

/** Canonical form for a code: uppercased, trimmed, inner whitespace removed. */
export function normalizeCode(code: string): string {
  return code.trim().replace(/\s+/g, '').toUpperCase()
}

/** Canonical form for an email: lowercased and trimmed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** True when the referrer and referee are the same person (self-referral). */
export function isSelfReferral(referrerEmail: string, refereeEmail: string): boolean {
  return normalizeEmail(referrerEmail) === normalizeEmail(refereeEmail)
}

/** Days a referral must age (still-paid) before it qualifies for payout. */
export const QUALIFICATION_WINDOW_DAYS = 14

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * True once `now` is at least QUALIFICATION_WINDOW_DAYS after `createdAt`.
 * Boundary is inclusive: exactly 14 days qualifies, 13d23h does not.
 */
export function isPastQualificationWindow(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= QUALIFICATION_WINDOW_DAYS * MS_PER_DAY
}

/**
 * The latest `created_at` that already qualifies at `now`. A row qualifies iff
 * `created_at <= qualificationCutoff(now)` — by construction this is exactly
 * equivalent to {@link isPastQualificationWindow}, so DB queries (`.lte`) and
 * the tested helper share one boundary.
 */
export function qualificationCutoff(now: Date): Date {
  return new Date(now.getTime() - QUALIFICATION_WINDOW_DAYS * MS_PER_DAY)
}

/** Cookie that carries an attributed referral code through checkout. */
export const REFERRAL_COOKIE = 'ff_ref'

/** Full shareable link for a code, e.g. https://origin/r/CODE. */
export function referralUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/r/${code}`
}

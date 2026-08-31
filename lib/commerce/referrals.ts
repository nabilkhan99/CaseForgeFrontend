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
  self_study: 5000, // £50
  self_study_monthly: 5000, // £50, on the first payment
} as const

export type RewardablePlan = keyof typeof REWARD_BY_PLAN

/**
 * Cash paid back to the *referee* (the referred buyer) after purchase, keyed by
 * plan. Pence.
 *
 * Deliberately mirrors {@link REWARD_BY_PLAN} pound for pound, so a shared link
 * reads as "£100 for you, £100 for them" rather than a one-sided bounty.
 *
 * Paid AFTER the fact rather than discounted at checkout — founder decision
 * 2026-08-20 (Ishaq, agreed Nabil). The buyer pays the full list price, so their
 * receipt and their study-budget claim are for the full course, and the £100
 * reaches them separately. A checkout coupon would have cut the invoice instead,
 * and it also blocked Stripe's promo-code box (Stripe permits an automatic
 * discount or the code box, never both).
 *
 * Plans absent from this map pay the referee nothing — no exclusion logic needed
 * anywhere else.
 */
export const REFEREE_REWARD_BY_PLAN = {
  complete: 10000, // £100 back on £599
  self_study: 5000, // £50 back on £299
  self_study_monthly: 5000, // £50 back on the first month
} as const

/**
 * Largest referee reward across all plans — the honest ceiling for "up to £X
 * back" copy, derived so the marketing number can never drift from the engine.
 */
export const MAX_REFEREE_REWARD_PENCE = Math.max(...Object.values(REFEREE_REWARD_BY_PLAN))

/**
 * Cash (pence) a referred buyer gets back on the given plan. Unknown plans get
 * nothing rather than throwing, mirroring {@link rewardFor}.
 */
export function refereeRewardFor(plan: string): number {
  return (REFEREE_REWARD_BY_PLAN as Record<string, number>)[plan] ?? 0
}

/**
 * Minimum spend (pence) a referred purchase must clear before it earns a reward,
 * keyed by plan. Set to 50% of each plan's list price (complete £599, self_study
 * £299). Fraud rationale: `allow_promotion_codes` lets a buyer stack a 100%-off
 * code and pay £0 while the reward is keyed only on plan — a free purchase would
 * otherwise mint a £100/£50 payout. Gating on real spend removes that vector
 * while still rewarding a genuinely (but not fully) discounted purchase.
 *
 * Referred buyers pay full list price (their reward arrives later as cash, not
 * as a checkout discount), so a genuine referral clears these floors easily.
 * The floors exist for the promo-code case: a stacked 100%-off code paying £0
 * must not mint a payout.
 * Plans absent from this map are non-rewardable and therefore never gated.
 */
export const MIN_QUALIFYING_SPEND_BY_PLAN = {
  complete: 29950, // 50% of £599
  self_study: 14950, // 50% of £299
  self_study_monthly: 6450, // 50% of £129 — a referred first month (£79 after £50 off) must still qualify
} as const

/**
 * The reward a referral is ultimately worth: a per-code negotiated override when
 * present, otherwise the plan tier. Shared by {@link decideReferral} and the
 * first-payment credit path, so the precedence rule lives in exactly one place.
 */
export function resolveReward(plan: string, rewardOverridePence?: number | null): number {
  return typeof rewardOverridePence === 'number' ? rewardOverridePence : rewardFor(plan)
}

/**
 * True when a purchase clears the minimum qualifying spend for its plan. Plans
 * with no floor (non-rewardable — they earn nothing anyway) always pass, so the
 * gate never blocks a plan it doesn't reward.
 */
export function meetsMinimumSpend(
  plan: string,
  amountTotalPence: number,
  floorOverridePence?: number | null,
): boolean {
  const floor =
    typeof floorOverridePence === 'number'
      ? floorOverridePence
      : (MIN_QUALIFYING_SPEND_BY_PLAN as Record<string, number>)[plan]
  if (floor === undefined) return true
  return amountTotalPence >= floor
}

/**
 * Parse `REFERRAL_MIN_SPEND_OVERRIDE_PENCE` — a test-rig escape hatch that
 * lowers the qualifying floor for ALL plans (e.g. `1` so a £1 test purchase
 * behaves like a real one end-to-end). Returns null for unset/invalid values,
 * which restores the real per-plan floors. MUST be unset in production.
 */
export function parseMinSpendOverride(raw: string | undefined): number | null {
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

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

/**
 * Canonical form for a code: uppercased, with every character outside [A-Z0-9]
 * stripped (whitespace, punctuation, emoji, angle brackets, …) and the result
 * capped at 16 characters. An input with no usable characters yields ''. Minted
 * codes (a subset of {@link CODE_ALPHABET}) and hand-seeded codes like `TESTREF`
 * survive unchanged; hostile input like `<SCRIPT>X` collapses to `SCRIPTX`.
 */
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

/** Canonical form for an email: lowercased and trimmed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** True when the referrer and referee are the same person (self-referral). */
export function isSelfReferral(referrerEmail: string, refereeEmail: string): boolean {
  return normalizeEmail(referrerEmail) === normalizeEmail(refereeEmail)
}

/**
 * Days a referral must age (still-paid) before it qualifies for payout.
 * 5 days works because digital access (and the cancellation waiver that comes
 * with it) starts at the moment of purchase from launch day onward, so the
 * practical refund window is short. Founder decision 2026-07-17 (Nabil + Ishaq).
 */
export const QUALIFICATION_WINDOW_DAYS = 5

/**
 * No referral qualifies before launch (1 September 2026), however old it is:
 * pre-order buyers receive nothing until launch, so their refund exposure runs
 * to this date. Pre-launch referrals qualify on launch day itself (their 5-day
 * age is already served by then).
 */
export const PAYOUT_FLOOR_DATE = new Date('2026-09-01T00:00:00.000Z')

/**
 * Last day the public refer-a-friend links are live. Expressed as the exclusive
 * cutoff instant: midnight London at the END of 26 September 2026, which is
 * 23:00 UTC that day because the UK is on BST in September.
 *
 * Created here (rather than extracted from somewhere) because no end date
 * existed anywhere in the codebase — the campaign date lived only in Brevo and
 * in the founders' heads. Every piece of copy that quotes it derives from
 * {@link REFERRAL_LINKS_CLOSE_LABEL}, so moving the campaign is a one-line edit.
 */
export const REFERRAL_LINKS_CLOSE = new Date('2026-09-26T23:00:00.000Z')

/** Human label for {@link REFERRAL_LINKS_CLOSE}. Mirrors ACCESS_OPENS_LABEL. */
export const REFERRAL_LINKS_CLOSE_LABEL = '26 September'

/**
 * Format pence as a pound string: whole pounds bare (10000 -> "£100"), anything
 * with pence to two decimals (2550 -> "£25.50").
 *
 * Deliberately duplicated from `formatPounds` in lib/email/referralEmail.ts
 * rather than imported: that module pulls in the Brevo SDK at the top level, and
 * this one is imported by client components that must not ship it.
 */
export function formatPence(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * True once `now` is past {@link PAYOUT_FLOOR_DATE} AND at least
 * QUALIFICATION_WINDOW_DAYS after `createdAt`. Boundaries are inclusive:
 * exactly 5 days (and exactly the floor instant) qualifies.
 */
export function isPastQualificationWindow(createdAt: Date, now: Date): boolean {
  if (now.getTime() < PAYOUT_FLOOR_DATE.getTime()) return false
  return now.getTime() - createdAt.getTime() >= QUALIFICATION_WINDOW_DAYS * MS_PER_DAY
}

/**
 * The latest `created_at` that already qualifies at `now`. A row qualifies iff
 * `created_at <= qualificationCutoff(now)` — equivalent to
 * {@link isPastQualificationWindow} for any real row (created after 1970), so
 * DB queries (`.lte`) and the tested helper share one boundary. Before the
 * payout floor the cutoff is the epoch, which matches no real row.
 */
export function qualificationCutoff(now: Date): Date {
  if (now.getTime() < PAYOUT_FLOOR_DATE.getTime()) return new Date(0)
  return new Date(now.getTime() - QUALIFICATION_WINDOW_DAYS * MS_PER_DAY)
}

/**
 * The moment a referral becomes payable: five days after it was created, but
 * never before the launch floor. Pure counterpart to
 * {@link isPastQualificationWindow} — that answers "is it payable yet?", this
 * answers "when will it be?", which is what the payout queue needs to show a
 * referral that exists but can't be paid yet.
 */
export function payableFrom(createdAt: Date): Date {
  const window = new Date(createdAt.getTime() + QUALIFICATION_WINDOW_DAYS * MS_PER_DAY)
  return window.getTime() > PAYOUT_FLOOR_DATE.getTime() ? window : PAYOUT_FLOOR_DATE
}

/** Cookie that carries an attributed referral code through checkout. */
export const REFERRAL_COOKIE = 'ff_ref'

/**
 * Display-only companion to {@link REFERRAL_COOKIE}: a bare flag ('1') telling
 * the client to show the "you were recommended" notice. Carries no data and is
 * never trusted for attribution — checkout re-validates `ff_ref` against the
 * DB server-side.
 */
export const REFERRAL_DISPLAY_COOKIE = 'ff_ref_by'

/** Full shareable link for a code, e.g. https://origin/r/CODE. */
export function referralUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/r/${code}`
}

/** Why a referral was recorded as `void` rather than `pending`. */
export type ReferralVoidReason = 'self_referral' | 'below_min_spend'

export interface ReferralDecisionInput {
  ownerEmail: string
  refereeEmail: string
  plan: string
  amountTotalPence: number
  /**
   * Optional per-code flat reward (pence) that supersedes the plan tier — for a
   * negotiated affiliate/influencer deal (e.g. "£50 flat per signup"). When a
   * number is supplied it becomes the reward; null/undefined falls back to
   * {@link rewardFor}(plan).
   */
  rewardOverridePence?: number | null
  /**
   * Optional qualifying-floor override (pence) applied to ALL plans — the test-rig
   * escape hatch from {@link parseMinSpendOverride}. Null/undefined uses the real
   * per-plan floors.
   */
  minSpendOverridePence?: number | null
}

export interface ReferralDecision {
  status: 'pending' | 'void'
  voidReason: ReferralVoidReason | null
  /** Cash owed to the referrer. */
  rewardAmount: number
  /** Cash owed back to the referee. Voided referrals owe neither side. */
  refereeRewardAmount: number
}

/**
 * Central, pure decision for an attributed referral. Returns the row's status,
 * void reason, and reward amount without touching any I/O.
 *
 * `rewardAmount` is `rewardOverridePence` when a number is supplied (a per-code
 * negotiated flat fee), else {@link rewardFor}(plan). It is recorded even on
 * void rows so the admin view shows what was forfeited (matching the prior
 * behaviour). The override changes only the payout — the minimum-spend gate
 * STILL uses the plan floor via {@link meetsMinimumSpend}, so an override can
 * never mint a payout on a refunded/£0 purchase.
 *
 * Precedence:
 *   1. self-referral (referrer === referee) → void `self_referral`
 *   2. otherwise, a rewardable plan below its minimum spend → void `below_min_spend`
 *   3. otherwise → pending
 */
export function decideReferral(input: ReferralDecisionInput): ReferralDecision {
  const { ownerEmail, refereeEmail, plan, amountTotalPence, rewardOverridePence, minSpendOverridePence } =
    input
  const rewardAmount = resolveReward(plan, rewardOverridePence)
  // A per-code override is a negotiated affiliate rate for the SHARER only; the
  // buyer's side always follows the plan tier.
  const refereeRewardAmount = refereeRewardFor(plan)

  if (isSelfReferral(ownerEmail, refereeEmail)) {
    return { status: 'void', voidReason: 'self_referral', rewardAmount, refereeRewardAmount }
  }
  if (!meetsMinimumSpend(plan, amountTotalPence, minSpendOverridePence)) {
    return { status: 'void', voidReason: 'below_min_spend', rewardAmount, refereeRewardAmount }
  }
  return { status: 'pending', voidReason: null, rewardAmount, refereeRewardAmount }
}

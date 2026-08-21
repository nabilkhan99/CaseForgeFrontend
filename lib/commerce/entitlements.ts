import { ACCESS_OPENS, PLANS, isSubscriptionPlan } from './plans'

/**
 * What a user's purchases entitle them to, and until when.
 *
 * Pure computation over `preorders` rows — no schema of its own. A user is
 * matched to purchases by email (buying email = account email, by product
 * decision), so provisioning, tier gating and expiry all hang off
 * `computeEntitlement`.
 *
 * Access model (locked 2026-08-20):
 * - One-off plans run 3 calendar months from purchase, except preorder-era
 *   purchases, whose clock starts at launch (1 Sept 2026). Access is not live
 *   before the window starts: a preorder bought today is `none` until launch.
 * - Monthly runs while the subscription lives; Stripe ends it at period end
 *   (`customer.subscription.deleted` / a `canceled|unpaid|incomplete_expired`
 *   `customer.subscription.updated` → webhook flips status to `canceled`), so a
 *   `canceled` row means access has already lapsed.
 * - Lapsed access is read-only: history and feedback stay visible, stations
 *   and lectures lock behind a renew prompt.
 * - Lectures and coaching days belong to Complete only.
 */

/**
 * Launch day, derived from the offer's own `ACCESS_OPENS` so there is exactly
 * one source of truth for "the course goes live on".
 */
export const ACCESS_LAUNCH_DATE = new Date(`${ACCESS_OPENS}T00:00:00Z`)

/** "Your 3 months' access" — calendar months, as sold, not 90 days. */
export const ACCESS_WINDOW_MONTHS = 3

export type EntitlementState = 'active' | 'read_only' | 'none'

export interface EntitlementRow {
  plan: string
  status: string
  created_at: string
  coaching_day?: string | null
}

export interface Entitlement {
  state: EntitlementState
  /** The plan the entitlement derives from; undefined when there is no purchase. */
  plan?: string
  /** Complete-tier extras: lectures, coaching day. Active state only. */
  hasLectures: boolean
  coachingDay?: string | null
  /** One-off plans only; undefined for monthly (runs until canceled). */
  expiresAt?: Date
}

/**
 * Frozen so a caller cannot poison every subsequent no-purchase user by
 * mutating it. `computeEntitlement` returns a fresh object regardless.
 */
export const NO_ENTITLEMENT: Entitlement = Object.freeze({ state: 'none', hasLectures: false })

const KNOWN_PLANS: ReadonlySet<string> = new Set(PLANS.map((p) => p.key))

/**
 * One definition of "monthly", owned by the plan catalogue's `billing` shape.
 * Hardcoding `plan === 'self_study_monthly'` here would mean a second rolling
 * plan silently became a 90-day one-off: active for 90 days from purchase
 * whether or not the subscription was still alive.
 */
export const isMonthlyPlan = isSubscriptionPlan

/** Same day-of-month `months` later, clamped to the last day of a shorter month. */
function addCalendarMonthsUtc(date: Date, months: number): Date {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), daysInTargetMonth))
  return target
}

/** 23:59:59.999 UTC on the given day — nobody loses access mid-afternoon. */
function endOfUtcDay(date: Date): Date {
  const end = new Date(date)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

/** The UTC day before `date`. */
function previousUtcDay(date: Date): Date {
  const previous = new Date(date)
  previous.setUTCDate(previous.getUTCDate() - 1)
  return previous
}

/**
 * Access window of a one-off purchase: 3 calendar months from purchase, floored
 * at launch. `end` is the LAST instant of access (23:59:59.999 UTC), inclusive.
 *
 * The day before the +3-months date, not that date itself: an inclusive end on
 * the same day-of-month would sell "3 calendar months" and deliver 3 months and
 * a day (1 Sept -> 1 Dec 23:59 is 92 days). Buying on 1 Sept now runs to the
 * last instant of 30 Nov, which is what a customer reading "3 months" expects.
 */
export function accessWindow(createdAt: string): { start: Date; end: Date } {
  const purchased = new Date(createdAt)
  const start = purchased < ACCESS_LAUNCH_DATE ? ACCESS_LAUNCH_DATE : purchased
  const sameDayThreeMonthsOn = addCalendarMonthsUtc(start, ACCESS_WINDOW_MONTHS)
  return { start, end: endOfUtcDay(previousUtcDay(sameDayThreeMonthsOn)) }
}

function entitlementOf(row: EntitlementRow, now: Date): Entitlement | null {
  if (row.status === 'refunded') return null

  // An unrecognised plan string must never fail open into a full grant: a
  // typo'd Stripe metadata value or a retired SKU would otherwise buy access.
  if (!KNOWN_PLANS.has(row.plan)) {
    console.error('[entitlements] unknown plan string — granting nothing', { plan: row.plan })
    return null
  }

  if (isMonthlyPlan(row.plan)) {
    // Founder ruling, 21 Aug 2026: ALL plans activate on launch day — monthly
    // included. A pre-launch monthly buy is `none`-with-plan until 1 Sept
    // (the "you're in, access opens 1 September" state), exactly like a
    // one-off preorder. Known cost, accepted: Stripe bills the first month
    // from the purchase date, so a pre-launch subscriber pays for days they
    // cannot use — the launch runbook says to compensate any such buyer
    // (extend or credit) by hand; as of the ruling there were zero.
    // 'paid' = subscription alive; anything else = Stripe already ended it.
    // Status is checked BEFORE the launch floor: a canceled subscription is
    // dead whatever the date, and must never read as a pending plan.
    if (row.status !== 'paid') return { state: 'read_only', plan: row.plan, hasLectures: false }
    if (now < ACCESS_LAUNCH_DATE) return { state: 'none', plan: row.plan, hasLectures: false }
    return { state: 'active', plan: row.plan, hasLectures: false }
  }

  if (row.status !== 'paid') return null
  const { start, end } = accessWindow(row.created_at)
  const complete = row.plan === 'complete' || row.plan === 'intensive'

  // Before the window opens (preorder-era buys, whose clock starts at launch)
  // the purchase exists but grants nothing yet. `expiresAt` is still populated
  // so callers can say when access begins and ends.
  if (now < start) return { state: 'none', plan: row.plan, hasLectures: false, expiresAt: end }
  if (now > end) return { state: 'read_only', plan: row.plan, hasLectures: false, expiresAt: end }
  return {
    state: 'active',
    plan: row.plan,
    hasLectures: complete,
    coachingDay: complete ? row.coaching_day ?? null : undefined,
    expiresAt: end,
  }
}

/**
 * Where an entitlement sits on the ladder of "how good is this customer's
 * position", highest first.
 *
 * `none` is deliberately NOT one rank. Since the launch floor landed, a `none`
 * that carries a plan means "bought, window hasn't opened yet" — a pre-launch
 * pre-order — which is a strictly BETTER position than lapsed access, not a
 * worse one. Collapsing the two let an expired old row mask a live new purchase:
 * a user with a spent self_study plus a fresh Complete pre-order folded to the
 * expired self_study, and was shown its plan and its past expiry date.
 *
 * A `none` with no plan is the fold's empty seed — no purchase at all — and
 * must lose to every real row.
 */
const ACCESS_RANK = { active: 3, pending: 2, read_only: 1, nothing: 0 } as const

function accessRank(e: Entitlement): number {
  if (e.state === 'active') return ACCESS_RANK.active
  if (e.state === 'read_only') return ACCESS_RANK.read_only
  return e.plan ? ACCESS_RANK.pending : ACCESS_RANK.nothing
}

/**
 * How far into the future an entitlement runs, for tie-breaking. A live monthly
 * has no end date, so it outranks any fixed window; the empty seed (no plan at
 * all) ranks below every real purchase.
 */
function endRank(e: Entitlement): number {
  if (e.expiresAt) return e.expiresAt.getTime()
  return e.plan ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY
}

/**
 * Precedence keys, most significant first. Compared as a tuple: the first key
 * that differs decides, and a later key only ever breaks a tie in every key
 * before it.
 *
 * 1. {@link accessRank} — what the purchase is worth to the customer today.
 * 2. lectures — within one access level, Complete beats self-study.
 * 3. {@link endRank} — within that, the entitlement that runs longest wins.
 *    Callers select without an ORDER BY, so without this a customer who renews
 *    before expiry could be gated on the earlier of their two windows depending
 *    on unspecified Postgres row order.
 *
 * A tuple + comparator rather than a chain of ifs on purpose: the chain was
 * already hard enough to reason about that the `none`-masks-`read_only` bug
 * hid in it, and adding a fourth key here is now a one-line edit with the
 * precedence written down instead of implied by statement order.
 */
type PrecedenceKey = readonly [access: number, lectures: number, end: number]

function precedenceOf(e: Entitlement): PrecedenceKey {
  return [accessRank(e), e.hasLectures ? 1 : 0, endRank(e)]
}

/** Descending tuple comparison: > 0 when `a` is the better entitlement. */
function comparePrecedence(a: Entitlement, b: Entitlement): number {
  const keyA = precedenceOf(a)
  const keyB = precedenceOf(b)
  for (let i = 0; i < keyA.length; i += 1) {
    // Only subtract when they differ, so two infinite end ranks (two live
    // monthlies) compare equal instead of producing NaN.
    if (keyA[i] !== keyB[i]) return keyA[i] - keyB[i]
  }
  return 0
}

/**
 * Fold a user's purchase rows into their single best entitlement, by the
 * precedence above. Ties keep the incumbent, so the result does not depend on
 * row order.
 */
export function computeEntitlement(rows: EntitlementRow[], now: Date = new Date()): Entitlement {
  return rows
    .map((row) => entitlementOf(row, now))
    .filter((e): e is Entitlement => e !== null)
    .reduce<Entitlement>((best, e) => (comparePrecedence(e, best) > 0 ? e : best), {
      state: 'none',
      hasLectures: false,
    })
}

export interface AccessContext {
  /** Signed-in user's email — purchases and the admin allowlist both key off it. */
  email?: string | null
  /** Staged deployment (develop preview, local dev): testers count as entitled. */
  staged: boolean
  /** Normalized ADMIN_EMAILS allowlist — admins are never locked out of the product. */
  admins: Set<string>
  now?: Date
}

export interface AccessDecision {
  entitlement: Entitlement
  /** Access waived rather than bought: staged deployment or admin allowlist. */
  bypass: boolean
  /** May start a consultation. Read-only surfaces (history, feedback) ignore this. */
  allowed: boolean
}

/**
 * The one gate the page middleware and the server API chokepoints share, so a
 * route can never disagree with the middleware about who may practise.
 *
 * Pure by construction: env reading stays with the callers, which run in
 * different runtimes (edge middleware vs. node route handlers).
 */
export function decideAccess(rows: EntitlementRow[], ctx: AccessContext): AccessDecision {
  const entitlement = computeEntitlement(rows, ctx.now ?? new Date())
  const bypass = ctx.staged || ctx.admins.has((ctx.email ?? '').trim().toLowerCase())
  return { entitlement, bypass, allowed: entitlement.state === 'active' || bypass }
}

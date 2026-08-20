import { ACCESS_OPENS, PLANS } from './plans'

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

function isMonthly(plan: string): boolean {
  return plan === 'self_study_monthly'
}

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

/**
 * Access window of a one-off purchase: 3 calendar months from purchase, floored
 * at launch. `end` is the LAST instant of access (23:59:59.999 UTC), inclusive.
 */
export function accessWindow(createdAt: string): { start: Date; end: Date } {
  const purchased = new Date(createdAt)
  const start = purchased < ACCESS_LAUNCH_DATE ? ACCESS_LAUNCH_DATE : purchased
  return { start, end: endOfUtcDay(addCalendarMonthsUtc(start, ACCESS_WINDOW_MONTHS)) }
}

function entitlementOf(row: EntitlementRow, now: Date): Entitlement | null {
  if (row.status === 'refunded') return null

  // An unrecognised plan string must never fail open into a full grant: a
  // typo'd Stripe metadata value or a retired SKU would otherwise buy access.
  if (!KNOWN_PLANS.has(row.plan)) {
    console.error('[entitlements] unknown plan string — granting nothing', { plan: row.plan })
    return null
  }

  if (isMonthly(row.plan)) {
    // 'paid' = subscription alive; anything else = Stripe already ended it.
    if (row.status !== 'paid') return { state: 'read_only', plan: row.plan, hasLectures: false }
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

const STATE_RANK: Record<EntitlementState, number> = { active: 2, read_only: 1, none: 0 }

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
 * Fold a user's purchase rows into their single best entitlement.
 *
 * Active beats read-only; within a state, lectures access beats none; and
 * within that, the later end date wins. The last rule matters because the
 * middleware selects without an ORDER BY — without it, a customer who renews
 * before expiry could be shown (and gated on) the earlier of their two windows,
 * depending on unspecified Postgres row order.
 */
export function computeEntitlement(rows: EntitlementRow[], now: Date = new Date()): Entitlement {
  return rows
    .map((row) => entitlementOf(row, now))
    .filter((e): e is Entitlement => e !== null)
    .reduce<Entitlement>(
      (best, e) => {
        if (STATE_RANK[e.state] !== STATE_RANK[best.state]) {
          return STATE_RANK[e.state] > STATE_RANK[best.state] ? e : best
        }
        if (e.hasLectures !== best.hasLectures) return e.hasLectures ? e : best
        return endRank(e) > endRank(best) ? e : best
      },
      { state: 'none', hasLectures: false },
    )
}

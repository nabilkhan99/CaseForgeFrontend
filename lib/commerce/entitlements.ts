/**
 * What a user's purchases entitle them to, and until when.
 *
 * Pure computation over `preorders` rows — no schema of its own. A user is
 * matched to purchases by email (buying email = account email, by product
 * decision), so provisioning, tier gating and expiry all hang off
 * `computeEntitlement`.
 *
 * Access model (locked 2026-08-20):
 * - One-off plans run 90 days from purchase, except preorder-era purchases,
 *   whose clock starts at launch (1 Sept 2026).
 * - Monthly runs while the subscription lives; Stripe ends it at period end
 *   (`customer.subscription.deleted` → webhook flips status to `canceled`),
 *   so a `canceled` row means access has already lapsed.
 * - Lapsed access is read-only: history and feedback stay visible, stations
 *   and lectures lock behind a renew prompt.
 * - Lectures and coaching days belong to Complete only.
 */

export const ACCESS_LAUNCH_DATE = new Date('2026-09-01T00:00:00Z')
export const ACCESS_WINDOW_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export type EntitlementState = 'active' | 'read_only' | 'none'

export interface EntitlementRow {
  plan: string
  status: string
  created_at: string
  coaching_day?: string | null
}

export interface Entitlement {
  state: EntitlementState
  /** The plan the entitlement derives from; undefined when state is 'none'. */
  plan?: string
  /** Complete-tier extras: lectures, coaching day. Active state only. */
  hasLectures: boolean
  coachingDay?: string | null
  /** One-off plans only; undefined for monthly (runs until canceled). */
  expiresAt?: Date
}

export const NO_ENTITLEMENT: Entitlement = { state: 'none', hasLectures: false }

export function isMonthlyPlan(plan: string): boolean {
  return plan === 'self_study_monthly'
}

/** Access window of a one-off purchase: 90 days from purchase, floored at launch. */
export function accessWindow(createdAt: string): { start: Date; end: Date } {
  const purchased = new Date(createdAt)
  const start = purchased < ACCESS_LAUNCH_DATE ? ACCESS_LAUNCH_DATE : purchased
  return { start, end: new Date(start.getTime() + ACCESS_WINDOW_DAYS * DAY_MS) }
}

function entitlementOf(row: EntitlementRow, now: Date): Entitlement | null {
  if (row.status === 'refunded') return null

  if (isMonthlyPlan(row.plan)) {
    // 'paid' = subscription alive; 'canceled' = Stripe already ended it.
    if (row.status !== 'paid') return { state: 'read_only', plan: row.plan, hasLectures: false }
    return { state: 'active', plan: row.plan, hasLectures: false }
  }

  if (row.status !== 'paid') return null
  const { end } = accessWindow(row.created_at)
  const complete = row.plan === 'complete' || row.plan === 'intensive'
  if (now >= end) return { state: 'read_only', plan: row.plan, hasLectures: false, expiresAt: end }
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
 * Fold a user's purchase rows into their single best entitlement.
 * Active beats read-only; within a state, lectures access beats none.
 */
export function computeEntitlement(rows: EntitlementRow[], now: Date = new Date()): Entitlement {
  return rows
    .map((row) => entitlementOf(row, now))
    .filter((e): e is Entitlement => e !== null)
    .reduce((best, e) => {
      if (STATE_RANK[e.state] !== STATE_RANK[best.state]) {
        return STATE_RANK[e.state] > STATE_RANK[best.state] ? e : best
      }
      return e.hasLectures && !best.hasLectures ? e : best
    }, NO_ENTITLEMENT)
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

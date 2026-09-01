import { ACCESS_OPENS, PLANS, isRollingPlan } from './plans'
import type { CohortAccess } from './cohortAccess'

/**
 * What a user's purchases entitle them to, and until when.
 *
 * Pure computation over `preorders` rows — no schema of its own. A user is
 * matched to purchases by email (buying email = account email, by product
 * decision), so provisioning, tier gating and expiry all hang off
 * `computeEntitlement`.
 *
 * Access model (locked 2026-08-20, Stripe periods added 2026-08-22, launch
 * floor retired 2026-08-31):
 * - Access starts at the moment of purchase. The product is live and sold as
 *   "instant access", so nothing clamps a purchase date forward any more.
 * - Fixed-term plans run for the length of the Stripe subscription period
 *   recorded on the row (`access_starts_at` / `access_ends_at`), shifted
 *   forward so a pre-launch buyer loses none of it — see
 *   {@link stripeAccessWindow}. Rows written before those columns existed fall
 *   back to the calendar-month arithmetic in {@link accessWindow}.
 * - `launchDate` survives ONLY as the anchor those end dates were sold
 *   against. Retiring the start floor must not claw back the days the shift
 *   exists to give the pre-launch buyers, so the end still runs from
 *   max(purchase, launch) while the start no longer does.
 * - A purchase whose window has not opened is still possible, but now only
 *   deliberately: terms clause 3.3 lets us agree a later start in writing.
 * - A fixed-term row that has gone `canceled` keeps its window: that status is
 *   how a paid term ENDS (Stripe deletes a `cancel_at_period_end` subscription
 *   at period end), not how one is revoked. Only `refunded` revokes.
 * - Monthly runs while the subscription lives; Stripe ends it at period end
 *   (`customer.subscription.deleted` / a `canceled|unpaid|incomplete_expired`
 *   `customer.subscription.updated` → webhook flips status to `canceled`), so a
 *   `canceled` row means access has already lapsed. `access_ends_at` on a
 *   rolling row is the NEXT renewal date, and is display-only.
 * - Lapsed access is read-only: history and feedback stay visible, stations
 *   and lectures lock behind a renew prompt.
 * - Lectures and coaching days belong to Complete only.
 */

/**
 * Launch day, derived from the offer's own `ACCESS_OPENS` so there is exactly
 * one source of truth for "the course went live on".
 *
 * No longer gates the start of anyone's access. It is now purely the anchor the
 * pre-launch buyers' END dates were computed against, kept so retiring the
 * start floor cannot shorten a window that was already sold.
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
  /**
   * Start of the Stripe billing period behind this row. Optional: rows written
   * before the subscription migration (Sarah, Phyo, Pavi and the test rows)
   * have neither column, and fall back to calendar arithmetic on `created_at`.
   */
  access_starts_at?: string | null
  /**
   * End of the Stripe billing period behind this row (item-level
   * `current_period_end`). On a fixed-term plan this is when access ends, once
   * shifted for a pre-launch purchase. On the rolling plan it is the next
   * renewal date and is display-only.
   */
  access_ends_at?: string | null
}

export interface Entitlement {
  state: EntitlementState
  /** The plan the entitlement derives from; undefined when there is no purchase. */
  plan?: string
  /** Complete-tier extras: lectures, coaching day. Active state only. */
  hasLectures: boolean
  coachingDay?: string | null
  /** Fixed-term plans only; undefined for the rolling plan (runs until canceled). */
  expiresAt?: Date
  /**
   * Rolling plan only: when Stripe next charges. Display copy — deliberately
   * NOT `expiresAt`, because a live rolling plan has no end and must keep
   * outranking a fixed term in the precedence fold.
   */
  renewsAt?: Date
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
 *
 * Now bound to `isRollingPlan`, not `isSubscriptionPlan`: since the migration
 * every checkout plan IS a Stripe subscription, so "is a subscription" no
 * longer distinguishes anything. Renewal does.
 */
export const isMonthlyPlan = isRollingPlan

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
 * Access window of a one-off purchase: it opens the moment the purchase lands,
 * and runs 3 calendar months. `end` is the LAST instant of access
 * (23:59:59.999 UTC), inclusive.
 *
 * The day before the +3-months date, not that date itself: an inclusive end on
 * the same day-of-month would sell "3 calendar months" and deliver 3 months and
 * a day (1 Sept -> 1 Dec 23:59 is 92 days). Buying on 1 Sept runs to the last
 * instant of 30 Nov, which is what a customer reading "3 months" expects.
 *
 * The end is measured from `launchDate` for anyone who bought before it. Those
 * buyers were sold three months starting at launch, so counting from their
 * (earlier) purchase date instead would silently take days back off a window
 * that has already been promised.
 */
export function accessWindow(
  createdAt: string,
  launchDate: Date = ACCESS_LAUNCH_DATE,
): { start: Date; end: Date } {
  const purchased = new Date(createdAt)
  const endAnchor = purchased < launchDate ? launchDate : purchased
  const sameDayThreeMonthsOn = addCalendarMonthsUtc(endAnchor, ACCESS_WINDOW_MONTHS)
  return { start: purchased, end: endOfUtcDay(previousUtcDay(sameDayThreeMonthsOn)) }
}

/**
 * How far a pre-launch purchase's access has to be extended at the end, in ms.
 *
 * Stripe could not charge in August and start the billing period on 1 September
 * (see stripe-research.md §1c: `billing_cycle_anchor` prorates, `trial_end`
 * defers the money). So a buyer on 22 August got a Stripe period of
 * 22 Aug → 22 Nov against a course sold as three months from 1 September. Left
 * alone that silently eats 10 days.
 *
 * Still applied now the start floor is gone: those 10 days were sold, and the
 * fact that their access opened sooner than promised is not a reason to take
 * them off the end.
 *
 * Zero once launch has passed, so post-launch buyers are unaffected.
 */
export function preLaunchShiftMs(createdAt: string, launchDate: Date): number {
  const purchased = new Date(createdAt)
  if (Number.isNaN(purchased.getTime()) || purchased >= launchDate) return 0
  return launchDate.getTime() - purchased.getTime()
}

/**
 * Access window of a fixed-term purchase whose Stripe period we recorded.
 *
 * Start: the purchase itself. The course is live, so money changing hands is
 * the only event access waits on.
 *
 * End: Stripe's period end plus {@link preLaunchShiftMs}, so the customer gets
 * the full length they paid for however early they bought. The shift is kept
 * even though the start floor is gone: the days it adds were promised to the
 * pre-launch buyers and opening their access sooner is no reason to take them
 * back. The end is then squared to the last instant of the *previous* UTC day,
 * the same transform {@link accessWindow} applies — which makes the two agree
 * exactly for a post-launch purchase (a 5 Sept buy ends 4 Dec 23:59:59.999
 * either way) and leaves the worked pre-launch example ending on 1 Dec.
 */
export function stripeAccessWindow(
  createdAt: string,
  accessEndsAt: string,
  launchDate: Date = ACCESS_LAUNCH_DATE,
): { start: Date; end: Date } {
  const purchased = new Date(createdAt)
  const periodEnd = new Date(accessEndsAt)
  const shifted = new Date(periodEnd.getTime() + preLaunchShiftMs(createdAt, launchDate))
  return { start: purchased, end: endOfUtcDay(previousUtcDay(shifted)) }
}

/** A timestamp string that actually parses, or null. */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * The access window for a fixed-term row: Stripe's period when we have it,
 * calendar months from `created_at` when we do not.
 *
 * The fallback is not dead code — it covers the three hand-provisioned
 * pre-launch rows and every order taken before this migration, none of which
 * carry `access_ends_at`.
 */
function fixedTermWindow(row: EntitlementRow, launchDate: Date): { start: Date; end: Date } {
  const recorded = parseDate(row.access_ends_at)
  return recorded
    ? stripeAccessWindow(row.created_at, recorded.toISOString(), launchDate)
    : accessWindow(row.created_at, launchDate)
}

function entitlementOf(row: EntitlementRow, now: Date, launchDate: Date): Entitlement | null {
  if (row.status === 'refunded') return null

  // An unrecognised plan string must never fail open into a full grant: a
  // typo'd Stripe metadata value or a retired SKU would otherwise buy access.
  if (!KNOWN_PLANS.has(row.plan)) {
    console.error('[entitlements] unknown plan string — granting nothing', { plan: row.plan })
    return null
  }

  if (isMonthlyPlan(row.plan)) {
    // The rolling plan is live for as long as the subscription is: Stripe bills
    // from the purchase date, so access runs from it too. (Until the launch
    // floor was retired a monthly bought before 1 Sept waited for launch while
    // still being billed — the accepted cost of the 21 Aug ruling. Nobody waits
    // now, so nobody has to be compensated by hand for it either.)
    // 'paid' = subscription alive; anything else = Stripe already ended it.
    if (row.status !== 'paid') return { state: 'read_only', plan: row.plan, hasLectures: false }
    // `renewsAt` is display only — see the Entitlement doc comment. Access on a
    // rolling plan is decided by status, because Stripe is the thing that ends
    // it, and a payment that fails mid-period must not leave a stale end date
    // granting access.
    const renewsAt = parseDate(row.access_ends_at) ?? undefined
    return { state: 'active', plan: row.plan, hasLectures: false, renewsAt }
  }

  // A fixed term ENDS as a `canceled` subscription. It is sold by arming
  // `cancel_at_period_end`, so Stripe fires `customer.subscription.deleted` the
  // moment the paid period runs out and the webhook stamps the row `canceled` —
  // the normal close of a term the customer paid for in full, not a failure.
  // Two things go wrong if that status discards the row:
  //  - a pre-launch buyer loses the days {@link preLaunchShiftMs} added, which
  //    is precisely the shortfall the shift exists to repay. Stripe's clock
  //    stops on 22 November; the access they bought runs to 1 December.
  //  - after the window closes they read as "no purchase at all" rather than
  //    lapsed, losing the read-only history and the renew prompt.
  // The window is what decides access here; the status only has to say the
  // money is still theirs, which `refunded` (handled above) is the case that
  // does not. Anything else — `pending`, and any status a future writer
  // invents — still grants nothing, so a half-written row cannot buy access.
  if (row.status !== 'paid' && row.status !== 'canceled') return null
  const { start, end } = fixedTermWindow(row, launchDate)
  const complete = row.plan === 'complete' || row.plan === 'intensive'

  // Before the window opens the purchase exists but grants nothing yet. With
  // the launch floor retired the only way to reach this is a start date we
  // agreed in writing (terms 3.3) and recorded ahead of `now`, so it is rare
  // rather than routine — but it must still not read as "no purchase".
  // `expiresAt` is populated so callers can say when access ends, and the
  // coaching day comes with it: "you have not booked your day" is true — and
  // worth prompting — before the course opens.
  if (now < start)
    return {
      state: 'none',
      plan: row.plan,
      hasLectures: false,
      coachingDay: complete ? row.coaching_day ?? null : undefined,
      expiresAt: end,
    }
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
 * `none` is deliberately NOT one rank. A `none` that carries a plan means
 * "bought, window hasn't opened yet" — which is a strictly BETTER position than
 * lapsed access, not a worse one. Collapsing the two let an expired old row mask
 * a live new purchase: a user with a spent self_study plus a fresh Complete
 * purchase folded to the expired self_study, and was shown its plan and its past
 * expiry date.
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
export function computeEntitlement(
  rows: EntitlementRow[],
  now: Date = new Date(),
  launchDate: Date = ACCESS_LAUNCH_DATE,
): Entitlement {
  return rows
    .map((row) => entitlementOf(row, now, launchDate))
    .filter((e): e is Entitlement => e !== null)
    .reduce<Entitlement>((best, e) => (comparePrecedence(e, best) > 0 ? e : best), {
      state: 'none',
      hasLectures: false,
    })
}

export interface AccessContext {
  /** Signed-in user's email — purchases and the admin allowlist both key off it. */
  email?: string | null
  /** Normalized ADMIN_EMAILS allowlist — admins are never locked out of the product. */
  admins: Set<string>
  now?: Date
  /**
   * The date the course went live, used only to anchor the end of a window
   * bought before it (see {@link accessWindow}). It no longer holds any
   * purchase back. A staged deployment may still override it via
   * `effectiveLaunchDate`.
   */
  launchDate?: Date
  /**
   * The user's trainer-pilot seat, when they have one. Loaded by the caller
   * (see lib/commerce/cohortAccess.ts) so this function stays pure and edge-safe.
   */
  cohort?: CohortAccess | null
}

export interface AccessDecision {
  entitlement: Entitlement
  /** Access waived rather than bought: the ADMIN_EMAILS allowlist. */
  bypass: boolean
  /** May start a consultation. Read-only surfaces (history, feedback) ignore this. */
  allowed: boolean
  /** The cohort behind a pilot seat, or null. Present whether or not it is what granted access. */
  cohort: CohortAccess | null
  /**
   * Access rests on cohort membership ALONE — so it reaches
   * `/clinical-master/*` but only for `cohort.stationIds`.
   *
   * False for a cohort member who also bought a plan, and false for an admin:
   * both of those have the whole bank, and narrowing them to five cases because
   * they happen to sit in a pilot would be a regression, not a gate. This is the
   * flag every allowlist check keys off, never `cohort !== null`.
   *
   * Note what that does NOT carve out: the cohort's own trainer. He is a member
   * of his own cohort and, in the pilot, has no purchase — so this is true for
   * him and he practises the same five cases as his students. That is the
   * intended design, not an oversight. Only a real purchase or ADMIN_EMAILS
   * lifts the limit, for him exactly as for anybody else.
   */
  cohortOnly: boolean
}

/**
 * The one gate the page middleware and the server API chokepoints share, so a
 * route can never disagree with the middleware about who may practise.
 *
 * Pure by construction: env reading stays with the callers, which run in
 * different runtimes (edge middleware vs. node route handlers).
 */
export function decideAccess(rows: EntitlementRow[], ctx: AccessContext): AccessDecision {
  const entitlement = computeEntitlement(rows, ctx.now ?? new Date(), ctx.launchDate)
  // Previews used to waive the gate for every signed-in tester. That showed
  // testers (and any customer handed a preview link) the Complete product
  // regardless of what they bought, so the gate could never be seen working
  // before launch. Only the admin allowlist bypasses now; previews bring the
  // launch date forward instead (`ctx.launchDate`).
  const bypass = ctx.admins.has((ctx.email ?? '').trim().toLowerCase())
  const purchased = entitlement.state === 'active'
  const cohort = ctx.cohort ?? null
  // A pilot seat is a third way in, ranked below both of the others rather
  // than folded into the entitlement: it must not overwrite `state`, because a
  // lapsed customer who joins a cohort still has a lapsed purchase and the UI
  // has to be able to say so. It only ever ADDS access — a cohort member who
  // also bought the full library keeps the full library.
  const cohortOnly = !purchased && !bypass && cohort !== null
  return { entitlement, bypass, cohort, cohortOnly, allowed: purchased || bypass || cohortOnly }
}

/**
 * Single source of truth for the three-tier offer.
 * Amounts are display copy — the charged amount comes from the Stripe Price.
 */

export type PlanKey = 'self_study' | 'self_study_monthly' | 'complete' | 'intensive'

/**
 * How a plan bills, in the shape Stripe expresses it.
 *
 * Every checkout plan is now a Stripe **subscription** — the two course plans
 * are fixed-term subscriptions (one charge, three months, `renews: false`), the
 * rolling plan renews monthly. Nothing is sold in `payment` mode any more.
 *
 * `renews: false` is not something Stripe Checkout can express (there is no
 * `cancel_at` / `cancel_at_period_end` on `subscription_data` in API
 * 2026-06-24.dahlia), so the webhook arms `cancel_at_period_end: true` the
 * moment the session completes. This flag is what tells it which sales need it.
 */
export interface PlanBilling {
  /** Stripe `recurring.interval`. Everything we sell bills in months. */
  interval: 'month'
  /** Stripe `recurring.interval_count`: 3 for a course term, 1 for rolling. */
  intervalCount: number
  /** True only for the rolling plan. False = one charge, then it stops. */
  renews: boolean
}

/** £299 / £599 course plans: one charge, three months, no renewal. */
export const FIXED_THREE_MONTH_TERM: PlanBilling = {
  interval: 'month',
  intervalCount: 3,
  renews: false,
}

/** The rolling Self-Study plan: £129 a month until it is cancelled. */
export const ROLLING_MONTHLY: PlanBilling = {
  interval: 'month',
  intervalCount: 1,
  renews: true,
}

export interface Plan {
  key: PlanKey
  name: string
  displayPrice: string
  priceSuffix: string
  tagline: string
  /** 'checkout' plans go through Stripe; 'call' plans go to the booking link */
  cta: 'checkout' | 'call'
  ctaLabel: string
  highlighted: boolean
  /** Billing shape. See {@link isFixedTermPlan} / {@link isRollingPlan}. */
  billing: PlanBilling
}

export const PLANS: readonly Plan[] = [
  {
    key: 'self_study',
    name: 'Self-Study',
    displayPrice: '£299',
    priceSuffix: '/ 3 months',
    tagline: "One payment · 3 months' access",
    cta: 'checkout',
    ctaLabel: 'Pre-order now',
    highlighted: false,
    billing: FIXED_THREE_MONTH_TERM,
  },
  {
    key: 'self_study_monthly',
    name: 'Self-Study (monthly)',
    displayPrice: '£129',
    priceSuffix: '/month',
    tagline: 'Cancel any time',
    cta: 'checkout',
    ctaLabel: 'Start monthly',
    highlighted: false,
    billing: ROLLING_MONTHLY,
  },
  {
    key: 'complete',
    name: 'Complete',
    displayPrice: '£599',
    priceSuffix: '/ 3 months',
    tagline: "One payment · 3 months' access",
    cta: 'checkout',
    ctaLabel: 'Choose your coaching day',
    highlighted: true,
    billing: FIXED_THREE_MONTH_TERM,
  },
  {
    key: 'intensive',
    name: 'Intensive',
    displayPrice: 'From £2,999',
    priceSuffix: '',
    tagline: 'By application',
    cta: 'call',
    ctaLabel: 'Book a call',
    highlighted: false,
    billing: FIXED_THREE_MONTH_TERM,
  },
] as const

export function getPlan(key: string): Plan | undefined {
  return PLANS.find((p) => p.key === key)
}

/**
 * True when the plan is bought through Stripe Checkout — which now means, for
 * every one of them, `mode: 'subscription'`.
 *
 * Kept as a named helper rather than inlined because it is the thing the
 * checkout route branches on, and "which plans are subscriptions" is exactly
 * the fact that changed. Intensive is excluded: it is sold on a call.
 */
export function isSubscriptionPlan(key: string): boolean {
  return getPlan(key)?.cta === 'checkout'
}

/**
 * A fixed-term subscription: charged once, three months of access, then it
 * stops. The webhook arms `cancel_at_period_end` for exactly these.
 */
export function isFixedTermPlan(key: string): boolean {
  const plan = getPlan(key)
  return plan?.cta === 'checkout' && !plan.billing.renews
}

/** The rolling plan: renews until cancelled. */
export function isRollingPlan(key: string): boolean {
  const plan = getPlan(key)
  return plan?.cta === 'checkout' && plan.billing.renews
}

/** Server-only: map a checkout-able plan to its Stripe Price id. */
export function stripePriceIdFor(key: PlanKey): string {
  const id = stripePriceEnvFor(key)
  if (!id) throw new Error(`No Stripe price configured for plan "${key}"`)
  return id
}

/** The raw env value behind a plan's Price, or undefined when unset. */
function stripePriceEnvFor(key: PlanKey): string | undefined {
  const raw =
    key === 'self_study'
      ? process.env.STRIPE_PRICE_SELF_STUDY
      : key === 'self_study_monthly'
        ? process.env.STRIPE_PRICE_SELF_STUDY_MONTHLY
        : key === 'complete'
          ? process.env.STRIPE_PRICE_COMPLETE
          : undefined
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

/** The plans that have a Stripe Price, i.e. everything except Intensive. */
const PRICED_PLANS: readonly PlanKey[] = ['self_study', 'self_study_monthly', 'complete']

/**
 * Server-only: the inverse of {@link stripePriceIdFor}.
 *
 * The Customer Portal changes a subscription by swapping its Price, and the
 * resulting `customer.subscription.updated` carries no session metadata — the
 * price id is the only evidence of what the customer now holds. Returns null
 * for an unrecognised id so the caller can log loudly rather than silently
 * rewriting a row to the wrong plan.
 *
 * Read from env on every call, not memoised at module load: the env is not
 * populated at import time in tests, and three string reads are free next to
 * the Stripe round-trip that produced the id.
 */
export function planForStripePriceId(priceId: string | null | undefined): PlanKey | null {
  const wanted = priceId?.trim()
  if (!wanted) return null
  return PRICED_PLANS.find((key) => stripePriceEnvFor(key) === wanted) ?? null
}

/**
 * Server-only: the Stripe Coupon id granting the referee (referred buyer) their
 * side of a two-sided referral, or null when none is configured.
 *
 * Deliberately returns null instead of throwing, unlike {@link stripePriceIdFor}:
 * a missing coupon must degrade to a full-price sale, never block checkout. The
 * pound values themselves live in `REFEREE_DISCOUNT_BY_PLAN` — these coupons must
 * be created in Stripe to match (see scripts/create-referral-coupons.mjs).
 */
export function stripeRefereeCouponIdFor(key: PlanKey): string | null {
  const id =
    key === 'self_study'
      ? process.env.STRIPE_COUPON_REFERRED_SELF_STUDY
      : key === 'self_study_monthly'
        ? process.env.STRIPE_COUPON_REFERRED_SELF_STUDY_MONTHLY
        : key === 'complete'
          ? process.env.STRIPE_COUPON_REFERRED_COMPLETE
          : undefined
  const trimmed = id?.trim()
  return trimmed ? trimmed : null
}

/**
 * Server-only: an explicit Customer Portal configuration to open sessions
 * against, or null to use the account's default configuration.
 *
 * Optional on purpose — the portal works without it — but a configuration is
 * how plan switching, the proration behaviour and the cancel mode are set, so
 * production is expected to have one.
 *
 * This is the SWITCHING configuration: it lists both course prices, so the
 * customer it is opened for can move between them.
 */
export function stripePortalConfigurationId(): string | null {
  const id = process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim()
  return id ? id : null
}

/**
 * Server-only: the Customer Portal configuration with plan switching turned
 * OFF, for customers who already hold the top plan.
 *
 * Stripe has no "upgrades only" flag — `subscription_update.products` is a flat
 * allow-list and the switcher is symmetric over whatever it contains, so any
 * configuration that can sell Complete to a Self-Study customer can also sell
 * Self-Study to a Complete one. On a non-renewing term that downgrade is a
 * genuine loss for both sides: the customer's lectures and coaching day vanish
 * and Stripe issues a customer-balance CREDIT rather than a refund (negative
 * prorations are never refunded automatically), which nothing on a plan with no
 * next invoice will ever consume. The only mechanism that prevents it is
 * opening a different configuration per customer.
 *
 * Falls back to null so an unset env degrades to the switching configuration
 * rather than breaking billing — the founder can create Config B after launch.
 */
export function stripePortalNoSwitchConfigurationId(): string | null {
  const id = process.env.STRIPE_PORTAL_CONFIGURATION_ID_NO_SWITCH?.trim()
  return id ? id : null
}

/** Intensive booking link. */
export const BOOK_A_CALL_URL = 'https://calendly.com/hello-fourteenfisherman/30min'

export interface CoachingDayAvailability {
  day: string // ISO date of the coaching day, e.g. "2026-09-12"
  label: string // "Saturday 12 September 2026"
  capacity: number // displayed capacity, capped at 6
  places_left: number // displayed places remaining, capped at 6
  cutoff_at: string // bookings close: midnight (London) the day before
  status: 'open' | 'closed' | 'sold_out'
}

/** The course goes live on this date; purchases before it start then. */
export const ACCESS_OPENS = '2026-09-01'
export const ACCESS_OPENS_LABEL = '1 September 2026'

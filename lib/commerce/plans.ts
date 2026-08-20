/**
 * Single source of truth for the three-tier offer.
 * Amounts are display copy — the charged amount comes from the Stripe Price.
 */

export type PlanKey = 'self_study' | 'complete' | 'intensive'

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
}

export const PLANS: readonly Plan[] = [
  {
    key: 'self_study',
    name: 'Self-Study',
    displayPrice: '£299',
    priceSuffix: 'one-off',
    tagline: "3 months' access",
    cta: 'checkout',
    ctaLabel: 'Pre-order now',
    highlighted: false,
  },
  {
    key: 'complete',
    name: 'Complete',
    displayPrice: '£599',
    priceSuffix: 'one-off',
    tagline: "3 months' access",
    cta: 'checkout',
    ctaLabel: 'Choose your coaching day',
    highlighted: true,
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
  },
] as const

export function getPlan(key: string): Plan | undefined {
  return PLANS.find((p) => p.key === key)
}

/** Server-only: map a checkout-able plan to its Stripe Price id. */
export function stripePriceIdFor(key: PlanKey): string {
  const id =
    key === 'self_study'
      ? process.env.STRIPE_PRICE_SELF_STUDY
      : key === 'complete'
        ? process.env.STRIPE_PRICE_COMPLETE
        : undefined
  if (!id) throw new Error(`No Stripe price configured for plan "${key}"`)
  return id
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
      : key === 'complete'
        ? process.env.STRIPE_COUPON_REFERRED_COMPLETE
        : undefined
  const trimmed = id?.trim()
  return trimmed ? trimmed : null
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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PLANS,
  isFixedTermPlan,
  isRollingPlan,
  isSubscriptionPlan,
  planForStripePriceId,
  stripePortalConfigurationId,
  stripePriceIdFor,
} from './plans'

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY', 'price_self_study')
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY_MONTHLY', 'price_self_study_monthly')
  vi.stubEnv('STRIPE_PRICE_COMPLETE', 'price_complete')
})

describe('billing shape', () => {
  it('makes every checkout plan a subscription', () => {
    // The migration in one assertion: Self-Study and Complete used to be
    // `payment` mode. Nothing is sold as a one-off charge any more.
    expect(isSubscriptionPlan('self_study')).toBe(true)
    expect(isSubscriptionPlan('complete')).toBe(true)
    expect(isSubscriptionPlan('self_study_monthly')).toBe(true)
  })

  it('leaves Intensive out — it is sold on a call, not through Stripe', () => {
    expect(isSubscriptionPlan('intensive')).toBe(false)
    expect(isFixedTermPlan('intensive')).toBe(false)
    expect(isRollingPlan('intensive')).toBe(false)
  })

  it('separates the fixed-term plans from the rolling one', () => {
    // isFixedTermPlan is what decides whether the webhook arms
    // cancel_at_period_end, so getting it wrong silently auto-renews a course.
    expect(isFixedTermPlan('self_study')).toBe(true)
    expect(isFixedTermPlan('complete')).toBe(true)
    expect(isFixedTermPlan('self_study_monthly')).toBe(false)

    expect(isRollingPlan('self_study_monthly')).toBe(true)
    expect(isRollingPlan('self_study')).toBe(false)
    expect(isRollingPlan('complete')).toBe(false)
  })

  it('describes the terms the way Stripe prices them', () => {
    const byKey = Object.fromEntries(PLANS.map((p) => [p.key, p.billing]))
    expect(byKey.self_study).toEqual({ interval: 'month', intervalCount: 3, renews: false })
    expect(byKey.complete).toEqual({ interval: 'month', intervalCount: 3, renews: false })
    expect(byKey.self_study_monthly).toEqual({ interval: 'month', intervalCount: 1, renews: true })
  })

  it('refuses an unknown plan string everywhere', () => {
    expect(isSubscriptionPlan('lectures_only')).toBe(false)
    expect(isFixedTermPlan('lectures_only')).toBe(false)
    expect(isRollingPlan('lectures_only')).toBe(false)
  })
})

describe('planForStripePriceId', () => {
  it('inverts stripePriceIdFor for every priced plan', () => {
    for (const key of ['self_study', 'self_study_monthly', 'complete'] as const) {
      expect(planForStripePriceId(stripePriceIdFor(key))).toBe(key)
    }
  })

  it('returns null for an unknown price id', () => {
    // A Portal switch onto a price we do not recognise must NOT rewrite the
    // row to some default plan — the caller logs and leaves the plan alone.
    expect(planForStripePriceId('price_someone_elses')).toBeNull()
  })

  it('returns null for a blank or missing id', () => {
    expect(planForStripePriceId(null)).toBeNull()
    expect(planForStripePriceId(undefined)).toBeNull()
    expect(planForStripePriceId('   ')).toBeNull()
  })

  it('does not match a plan whose price env is unset', () => {
    // Otherwise an empty env var would make every unknown id resolve to that
    // plan, which is how a Complete customer gets downgraded by a typo.
    vi.stubEnv('STRIPE_PRICE_COMPLETE', '')
    expect(planForStripePriceId('')).toBeNull()
    expect(planForStripePriceId('price_complete')).toBeNull()
  })

  it('ignores surrounding whitespace on both sides', () => {
    vi.stubEnv('STRIPE_PRICE_COMPLETE', '  price_complete  ')
    expect(planForStripePriceId(' price_complete ')).toBe('complete')
  })
})

describe('stripePortalConfigurationId', () => {
  it('is null when unset, so the account default applies', () => {
    vi.stubEnv('STRIPE_PORTAL_CONFIGURATION_ID', '')
    expect(stripePortalConfigurationId()).toBeNull()
  })

  it('trims a configured id', () => {
    vi.stubEnv('STRIPE_PORTAL_CONFIGURATION_ID', ' bpc_123 ')
    expect(stripePortalConfigurationId()).toBe('bpc_123')
  })
})

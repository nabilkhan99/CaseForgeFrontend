import { describe, expect, it } from 'vitest'
import { computeEntitlement, type Entitlement } from './entitlements'
import { canSwitchPlan, upgradeEnquiryMailto, UPGRADE_CONTACT_EMAIL } from './upgrade'

function entitlement(over: Partial<Entitlement>): Entitlement {
  return { state: 'active', hasLectures: false, ...over }
}

describe('canSwitchPlan', () => {
  it('offers no self-serve switch to a Self-Study customer', () => {
    // The course terms are one-off sales again (2026-08-29), so there is no
    // subscription to switch and the Portal cannot move anyone onto a one-off
    // Price. Upgrades are quoted and taken by hand.
    expect(canSwitchPlan(entitlement({ plan: 'self_study' }))).toBe(false)
  })

  it('offers no self-serve switch to a monthly customer either', () => {
    // A subscription exists here, but its only destination would be a one-off
    // Price, which Stripe will not switch a subscription onto.
    expect(canSwitchPlan(entitlement({ plan: 'self_study_monthly' }))).toBe(false)
  })

  it('offers no self-serve switch to a pre-launch buyer whose window has not opened', () => {
    // `none` with a plan is a paid pre-order, not "no purchase" — but with
    // UPGRADEABLE_FROM empty there is nothing to offer them either.
    expect(canSwitchPlan(entitlement({ state: 'none', plan: 'self_study' }))).toBe(false)
  })

  it('refuses someone with no purchase at all', () => {
    expect(canSwitchPlan(entitlement({ state: 'none' }))).toBe(false)
  })

  it('refuses a lapsed Self-Study plan', () => {
    // Nothing left to switch — that is a fresh purchase, at the full price.
    expect(canSwitchPlan(entitlement({ state: 'read_only', plan: 'self_study' }))).toBe(false)
  })

  it('refuses someone who already holds Complete', () => {
    expect(
      canSwitchPlan(entitlement({ plan: 'complete', hasLectures: true })),
    ).toBe(false)
  })

  it('refuses a Self-Study holder who has already upgraded', () => {
    // The real defence against offering the upgrade twice: the fold ranks the
    // Complete row above the Self-Study one, so the check sees `complete`.
    const now = new Date('2026-10-01T12:00:00Z')
    const folded = computeEntitlement(
      [
        { plan: 'self_study', status: 'paid', created_at: '2026-09-01T00:00:00Z' },
        { plan: 'complete', status: 'paid', created_at: '2026-09-10T00:00:00Z' },
      ],
      now,
    )
    expect(folded.plan).toBe('complete')
    expect(canSwitchPlan(folded)).toBe(false)
  })

  it('refuses the Intensive tier', () => {
    expect(canSwitchPlan(entitlement({ plan: 'intensive', hasLectures: true }))).toBe(false)
  })
})

describe('upgradeEnquiryMailto', () => {
  it('addresses the founders and carries who is asking and what they hold', () => {
    const href = upgradeEnquiryMailto('gp@example.com', 'self_study_monthly')
    expect(href.startsWith(`mailto:${UPGRADE_CONTACT_EMAIL}?`)).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('subject')).toBe('Upgrade to Complete')
    expect(params.get('body')).toContain('Account email: gp@example.com')
    // The human-readable label, not the plan key — this lands in an inbox.
    expect(params.get('body')).toContain('Current plan: Self-Study, monthly')
  })

  it('quotes no price — the reply is the quote', () => {
    const body = new URLSearchParams(upgradeEnquiryMailto('gp@example.com', 'self_study').split('?')[1]).get('body')!
    expect(body).not.toMatch(/£|\d{3}/)
  })

  it('degrades to blank fields rather than "undefined" when auth is still resolving', () => {
    const body = new URLSearchParams(upgradeEnquiryMailto(undefined, null).split('?')[1]).get('body')!
    expect(body).toContain('Account email: \r\n')
    expect(body).not.toContain('undefined')
  })
})

import { describe, expect, it } from 'vitest'
import { computeEntitlement, type Entitlement } from './entitlements'
import { canUpgradeToComplete } from './upgrade'

function entitlement(over: Partial<Entitlement>): Entitlement {
  return { state: 'active', hasLectures: false, ...over }
}

describe('canUpgradeToComplete', () => {
  it('allows an active Self-Study customer', () => {
    expect(canUpgradeToComplete(entitlement({ plan: 'self_study' }))).toBe(true)
  })

  it('allows an active monthly Self-Study customer', () => {
    expect(canUpgradeToComplete(entitlement({ plan: 'self_study_monthly' }))).toBe(true)
  })

  it('allows a pre-launch Self-Study buyer whose window has not opened', () => {
    // `none` with a plan is a paid pre-order, not "no purchase". Refusing them
    // would mean nobody who bought before 1 September could ever top up.
    expect(canUpgradeToComplete(entitlement({ state: 'none', plan: 'self_study' }))).toBe(true)
  })

  it('refuses someone with no purchase at all', () => {
    expect(canUpgradeToComplete(entitlement({ state: 'none' }))).toBe(false)
  })

  it('refuses a lapsed Self-Study plan', () => {
    // Nothing left to upgrade — that is a renewal, at the full price.
    expect(canUpgradeToComplete(entitlement({ state: 'read_only', plan: 'self_study' }))).toBe(false)
  })

  it('refuses someone who already holds Complete', () => {
    expect(
      canUpgradeToComplete(entitlement({ plan: 'complete', hasLectures: true })),
    ).toBe(false)
  })

  it('refuses a Self-Study holder who has already upgraded', () => {
    // The real defence against buying the upgrade twice: the fold ranks the
    // Complete row above the Self-Study one, so the gate sees `complete`.
    const now = new Date('2026-10-01T12:00:00Z')
    const folded = computeEntitlement(
      [
        { plan: 'self_study', status: 'paid', created_at: '2026-09-01T00:00:00Z' },
        { plan: 'complete', status: 'paid', created_at: '2026-09-10T00:00:00Z' },
      ],
      now,
    )
    expect(folded.plan).toBe('complete')
    expect(canUpgradeToComplete(folded)).toBe(false)
  })

  it('refuses the Intensive tier', () => {
    expect(canUpgradeToComplete(entitlement({ plan: 'intensive', hasLectures: true }))).toBe(false)
  })
})

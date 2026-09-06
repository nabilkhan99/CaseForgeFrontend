import { describe, expect, it } from 'vitest'
import { accountCreatedDoor, dashboardOffer } from './verifiedAccount'

/**
 * The gate's half of Contract V, including the case that will be live until the
 * other half merges: no `account` block at all.
 */
describe('dashboardOffer', () => {
  it('offers nothing when the response carries no account', () => {
    expect(dashboardOffer(undefined)).toBeNull()
    expect(dashboardOffer(null)).toBeNull()
  })

  it('links at the signed link when there is one', () => {
    expect(dashboardOffer({ userId: 'u1', created: true, signInUrl: 'https://ff.com/auth/start?t=x' })).toEqual({
      href: 'https://ff.com/auth/start?t=x',
      label: 'Open your dashboard · 4 more stations, five days',
    })
  })

  it('falls back to ordinary sign-in when no link could be minted', () => {
    expect(dashboardOffer({ userId: 'u1', created: true, signInUrl: null })?.href).toBe('/auth/sign-in')
    expect(dashboardOffer({ userId: 'u1' })?.href).toBe('/auth/sign-in')
  })

  it('offers the dashboard to an account that already existed', () => {
    // `created: false` means we did not make it just now, not that they have none.
    expect(dashboardOffer({ userId: 'u1', created: false })).not.toBeNull()
  })
})

describe('accountCreatedDoor', () => {
  it('counts a created account against the guest door', () => {
    expect(accountCreatedDoor({ created: true })).toBe('guest')
  })

  it('counts nothing otherwise', () => {
    expect(accountCreatedDoor({ created: false })).toBeNull()
    expect(accountCreatedDoor({})).toBeNull()
    expect(accountCreatedDoor(undefined)).toBeNull()
  })
})

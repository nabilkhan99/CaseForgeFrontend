import { describe, expect, it } from 'vitest'
import { accountCreatedDoor, dashboardOffer } from './verifiedAccount'

/**
 * The gate's half of the verify contract, including the case it must survive:
 * no `account` block at all.
 *
 * The offer is the DASHBOARD now, not a one-time link — verifying the code sets
 * the session cookies, so there is nothing between the person and their board.
 */
describe('dashboardOffer', () => {
  it('offers nothing when the response carries no account', () => {
    expect(dashboardOffer(undefined)).toBeNull()
    expect(dashboardOffer(null)).toBeNull()
  })

  it('sends a verified account straight to the dashboard', () => {
    expect(dashboardOffer({ userId: 'u1', created: true })).toEqual({
      href: '/dashboard',
      label: 'Open your dashboard · 4 more stations, five days',
    })
  })

  it('never offers a bearer link, whatever the response carried', () => {
    // A one-time sign-in URL in a JSON body is a credential for the account.
    // The cookies on the same response do the job; nothing has to travel.
    const offer = dashboardOffer({ userId: 'u1' })
    expect(offer?.href).toBe('/dashboard')
    expect(offer?.href).not.toContain('token')
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

import { describe, expect, it } from 'vitest'
import {
  firstParam,
  guestNotice,
  openDashboardHref,
  openPrefill,
  startPrefill,
  stationParam,
} from './freeParams'

/**
 * The query states /free inherited when it stopped being a form.
 *
 * Two of them are sent by code that does not know the page changed — the
 * one-click door's two bounce paths, and the portfolio banner's `?email=…` —
 * and both were silently correct before, so both would be silently broken now.
 */

describe('why the one-click door sent somebody back', () => {
  it('recognises the two bounces it actually sends', () => {
    expect(guestNotice({ guest: 'limit' })).toBe('limit')
    expect(guestNotice({ guest: 'unavailable' })).toBe('unavailable')
  })

  it('shows nothing for an absent or unknown value', () => {
    expect(guestNotice({})).toBeNull()
    expect(guestNotice({ guest: 'banana' })).toBeNull()
    expect(guestNotice({ guest: '' })).toBeNull()
  })
})

describe('somebody arriving at /free with an address', () => {
  it('is handed on to /free/open with the address intact', () => {
    expect(openDashboardHref({ email: 'sam@example.com' })).toBe(
      '/free/open?email=sam%40example.com',
    )
  })

  it('keeps the code state, so the step they were promised is the step they get', () => {
    expect(openDashboardHref({ email: 'sam@example.com', code: 'sent' })).toBe(
      '/free/open?email=sam%40example.com&code=sent',
    )
  })

  it('is left on the picker when there is no address', () => {
    expect(openDashboardHref({})).toBeNull()
    expect(openDashboardHref({ code: 'sent' })).toBeNull()
    expect(openDashboardHref({ guest: 'limit' })).toBeNull()
  })

  it('does not drag the rest of the query along', () => {
    // utm tags and `ref` belong to the picker's analytics, not to the form.
    const href = openDashboardHref({ email: 'sam@example.com', utm_source: 'brevo', ref: 'abc' })
    expect(href).toBe('/free/open?email=sam%40example.com')
  })
})

describe('what /free/open opens with', () => {
  it('pre-fills the address', () => {
    expect(openPrefill({ email: 'sam@example.com' })).toEqual({
      email: 'sam@example.com',
      codeAlreadySent: false,
    })
  })

  it('starts on the code step when a code has already been sent', () => {
    expect(openPrefill({ email: 'sam@example.com', code: 'sent' })).toEqual({
      email: 'sam@example.com',
      codeAlreadySent: true,
    })
  })

  it('refuses a code step with no address to verify against', () => {
    // `?code=sent` alone would open six empty boxes and no way out of them.
    expect(openPrefill({ code: 'sent' })).toEqual({ email: undefined, codeAlreadySent: false })
  })

  it('ignores a code value that is not "sent"', () => {
    expect(openPrefill({ email: 'sam@example.com', code: '123456' }).codeAlreadySent).toBe(false)
  })
})

describe('a repeated or empty param', () => {
  it('takes the first value and treats blank as absent', () => {
    expect(firstParam(['a', 'b'])).toBe('a')
    expect(firstParam('  padded  ')).toBe('padded')
    expect(firstParam('   ')).toBeUndefined()
    expect(firstParam(undefined)).toBeUndefined()
  })

  it('still hands a repeated address on rather than dropping it', () => {
    expect(openDashboardHref({ email: ['sam@example.com', 'other@example.com'] })).toBe(
      '/free/open?email=sam%40example.com',
    )
  })
})

describe('what /free/start opens with', () => {
  it('carries a station id through the sign-up', () => {
    const station = '2b0d9a5e-0000-4000-8000-000000000000'
    expect(startPrefill({ station })).toEqual({ email: undefined, station })
  })

  it('lower-cases it, so one link and its shouted copy land on one case', () => {
    expect(stationParam({ station: '2B0D9A5E-0000-4000-8000-000000000000' })).toBe(
      '2b0d9a5e-0000-4000-8000-000000000000',
    )
  })

  it.each([
    'https://evil.example.com',
    '//evil.example.com/x',
    '../../dashboard',
    'not-a-uuid',
    '2b0d9a5e-0000-4000-8000-000000000000/../evil',
  ])('drops %s rather than carrying it into a redirect', (station) => {
    // It ends up in a `redirectTo` the browser follows after sign-in. The route
    // checks it again; this one keeps junk out of the form's hidden field.
    expect(stationParam({ station })).toBeUndefined()
  })

  it('takes the first of a repeated param, like every other reader here', () => {
    const first = '2b0d9a5e-0000-4000-8000-000000000000'
    expect(stationParam({ station: [first, 'other'] })).toBe(first)
  })

  it('prefills an address handed over from another surface', () => {
    expect(startPrefill({ email: 'sam@example.com' }).email).toBe('sam@example.com')
  })
})

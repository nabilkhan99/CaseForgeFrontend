import { describe, expect, it } from 'vitest'
import { cookiePostRefusal } from './cookiePostGuard'

/**
 * The CSRF guard on cookie-authorised admin POSTs: JSON only, and an Origin
 * header (when the browser sends one) must name this host.
 */

function post(headers: Record<string, string>, url = 'https://www.fourteenfisherman.com/api/admin/x') {
  return new Request(url, { method: 'POST', headers })
}

const JSON_TYPE = { 'Content-Type': 'application/json' }

describe('cookiePostRefusal', () => {
  it('lets a same-origin JSON request through', () => {
    expect(
      cookiePostRefusal(post({ ...JSON_TYPE, Origin: 'https://www.fourteenfisherman.com', Host: 'www.fourteenfisherman.com' })),
    ).toBeNull()
  })

  it('accepts a charset parameter and any letter case on the content type', () => {
    expect(cookiePostRefusal(post({ 'Content-Type': 'Application/JSON; charset=utf-8' }))).toBeNull()
  })

  it('lets a JSON request with no Origin header through (non-browser or older same-origin caller)', () => {
    expect(cookiePostRefusal(post(JSON_TYPE))).toBeNull()
  })

  it('falls back to the URL host when there is no Host header', () => {
    expect(cookiePostRefusal(post({ ...JSON_TYPE, Origin: 'https://www.fourteenfisherman.com' }))).toBeNull()
  })

  it.each([
    ['another site', 'https://evil.example'],
    ['a look-alike subdomain', 'https://www.fourteenfisherman.com.evil.example'],
    ['another port', 'https://www.fourteenfisherman.com:8443'],
    ['the opaque null origin', 'null'],
    ['garbage', 'not a url'],
  ])('refuses an Origin from %s with 403', (_label, origin) => {
    expect(
      cookiePostRefusal(post({ ...JSON_TYPE, Origin: origin, Host: 'www.fourteenfisherman.com' })),
    ).toMatchObject({ status: 403 })
  })

  it.each([
    ['a form post', { 'Content-Type': 'application/x-www-form-urlencoded' }],
    ['a multipart post', { 'Content-Type': 'multipart/form-data; boundary=x' }],
    ['text/plain', { 'Content-Type': 'text/plain' }],
    ['no content type', {}],
  ])('refuses %s with 415', (_label, headers) => {
    expect(cookiePostRefusal(post(headers as Record<string, string>))).toMatchObject({ status: 415 })
  })
})

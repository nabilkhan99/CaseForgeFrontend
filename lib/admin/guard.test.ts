import { describe, expect, it } from 'vitest'
import { parseAdminEmails } from './guard'

describe('parseAdminEmails', () => {
  it('fails closed on an unset allowlist', () => {
    const result = parseAdminEmails(undefined)
    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(0)
  })

  it('fails closed on an empty string', () => {
    expect(parseAdminEmails('').size).toBe(0)
  })

  it('lowercases and returns a set of the listed emails', () => {
    const result = parseAdminEmails('A@x.com, b@Y.com')
    expect(result).toBeInstanceOf(Set)
    expect([...result].sort()).toEqual(['a@x.com', 'b@y.com'])
  })

  it('tolerates trailing/double commas and surrounding whitespace', () => {
    const result = parseAdminEmails('  a@x.com , , b@y.com ,')
    expect([...result].sort()).toEqual(['a@x.com', 'b@y.com'])
  })
})

import { describe, expect, it } from 'vitest'
import { validateNewCode } from './advocates'

describe('validateNewCode', () => {
  it('accepts a happy path with an explicit code', () => {
    const result = validateNewCode({
      ownerName: '  Jane Doe  ',
      ownerEmail: '  Jane@Example.COM ',
      code: 'JANEVIP',
    })
    expect(result).toEqual({
      ok: true,
      value: {
        code: 'JANEVIP',
        ownerName: 'Jane Doe',
        ownerEmail: 'jane@example.com',
        rewardOverridePence: null,
      },
    })
  })

  it('auto-generates a code (prefix + 4 chars) when code is omitted', () => {
    const result = validateNewCode({ ownerName: 'Jane Doe', ownerEmail: 'jane@example.com' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.code.startsWith('JANE')).toBe(true)
    expect(result.value.code).toHaveLength(8)
    expect(result.value.code).toMatch(/^[A-Z2-9]+$/)
  })

  it('treats a blank/whitespace code as omitted and auto-generates', () => {
    const result = validateNewCode({ ownerName: 'Jane Doe', ownerEmail: 'jane@example.com', code: '   ' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.code.startsWith('JANE')).toBe(true)
    expect(result.value.code).toHaveLength(8)
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(validateNewCode({ ownerName: '', ownerEmail: 'jane@example.com' })).toEqual({
      ok: false,
      error: 'Name is required',
    })
    expect(validateNewCode({ ownerName: '   ', ownerEmail: 'jane@example.com' })).toEqual({
      ok: false,
      error: 'Name is required',
    })
    expect(validateNewCode({ ownerEmail: 'jane@example.com' })).toEqual({
      ok: false,
      error: 'Name is required',
    })
  })

  it('rejects malformed emails', () => {
    for (const ownerEmail of ['x', 'a@', 'a@b', '', 'no at sign', 'a b@c.com']) {
      expect(validateNewCode({ ownerName: 'Jane', ownerEmail })).toEqual({
        ok: false,
        error: 'A valid email is required',
      })
    }
  })

  it('normalizes and accepts a lowercase/spaced code', () => {
    const result = validateNewCode({
      ownerName: 'Jane',
      ownerEmail: 'jane@example.com',
      code: '  jane vip  ',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.code).toBe('JANEVIP')
  })

  it('rejects a code shorter than 3 chars after normalization', () => {
    expect(
      validateNewCode({ ownerName: 'Jane', ownerEmail: 'jane@example.com', code: 'ab' }),
    ).toEqual({ ok: false, error: 'Code must be 3–16 letters/numbers' })
  })

  it('rejects a code longer than 16 chars after normalization', () => {
    expect(
      validateNewCode({ ownerName: 'Jane', ownerEmail: 'jane@example.com', code: 'A'.repeat(17) }),
    ).toEqual({ ok: false, error: 'Code must be 3–16 letters/numbers' })
  })

  it('rejects a negative reward override', () => {
    expect(
      validateNewCode({
        ownerName: 'Jane',
        ownerEmail: 'jane@example.com',
        code: 'JANEVIP',
        rewardOverridePence: -1,
      }),
    ).toEqual({ ok: false, error: 'Reward override must be a whole number of pence, 0 or more' })
  })

  it('rejects a non-integer reward override', () => {
    expect(
      validateNewCode({
        ownerName: 'Jane',
        ownerEmail: 'jane@example.com',
        code: 'JANEVIP',
        rewardOverridePence: 50.5,
      }),
    ).toEqual({ ok: false, error: 'Reward override must be a whole number of pence, 0 or more' })
  })

  it('accepts a zero reward override', () => {
    const result = validateNewCode({
      ownerName: 'Jane',
      ownerEmail: 'jane@example.com',
      code: 'JANEVIP',
      rewardOverridePence: 0,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rewardOverridePence).toBe(0)
  })

  it('accepts a positive reward override', () => {
    const result = validateNewCode({
      ownerName: 'Jane',
      ownerEmail: 'jane@example.com',
      code: 'JANEVIP',
      rewardOverridePence: 5000,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rewardOverridePence).toBe(5000)
  })

  it('defaults a null reward override when the field is omitted', () => {
    const result = validateNewCode({ ownerName: 'Jane', ownerEmail: 'jane@example.com', code: 'JANEVIP' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rewardOverridePence).toBeNull()
  })
})

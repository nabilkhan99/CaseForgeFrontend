import { describe, expect, it } from 'vitest'
import { formatPounds } from './referralEmail'

describe('formatPounds', () => {
  it('renders whole pounds bare', () => {
    expect(formatPounds(10000)).toBe('£100')
    expect(formatPounds(2500)).toBe('£25')
    expect(formatPounds(0)).toBe('£0')
  })

  it('renders sub-pound and part-pound amounts to two decimals', () => {
    expect(formatPounds(2550)).toBe('£25.50')
    expect(formatPounds(99)).toBe('£0.99')
  })
})

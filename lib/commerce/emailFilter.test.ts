import { describe, expect, it } from 'vitest'
import { exactEmailPattern } from './emailFilter'

describe('exactEmailPattern', () => {
  it('leaves an ordinary address alone', () => {
    expect(exactEmailPattern('trainee@nhs.net')).toBe('trainee@nhs.net')
  })

  it('trims, because a stored address may carry whitespace', () => {
    expect(exactEmailPattern('  trainee@nhs.net ')).toBe('trainee@nhs.net')
  })

  it('does not lowercase — ilike is what makes the match case-insensitive', () => {
    expect(exactEmailPattern('Sarah@Nhs.net')).toBe('Sarah@Nhs.net')
  })

  it('escapes underscores, which are common in real addresses', () => {
    // Unescaped, sarah_jones@nhs.net would also match sarahXjones@nhs.net.
    expect(exactEmailPattern('sarah_jones@nhs.net')).toBe('sarah\\_jones@nhs.net')
  })

  it('escapes percent signs and backslashes', () => {
    expect(exactEmailPattern('%@nhs.net')).toBe('\\%@nhs.net')
    expect(exactEmailPattern('a\\b@nhs.net')).toBe('a\\\\b@nhs.net')
  })

  it('turns a missing email into a pattern that matches nothing real', () => {
    expect(exactEmailPattern(null)).toBe('')
    expect(exactEmailPattern(undefined)).toBe('')
  })
})

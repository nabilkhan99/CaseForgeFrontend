import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  QUALIFICATION_WINDOW_DAYS,
  REFERRAL_COOKIE,
  REWARD_BY_PLAN,
  generateReferralCode,
  isPastQualificationWindow,
  qualificationCutoff,
  isSelfReferral,
  normalizeCode,
  normalizeEmail,
  referralUrl,
  rewardFor,
} from './referrals'

describe('rewardFor', () => {
  it('pays £100 (10000p) for the complete plan', () => {
    expect(rewardFor('complete')).toBe(10000)
    expect(REWARD_BY_PLAN.complete).toBe(10000)
  })

  it('pays £25 (2500p) for the self_study plan', () => {
    expect(rewardFor('self_study')).toBe(2500)
    expect(REWARD_BY_PLAN.self_study).toBe(2500)
  })

  it('pays nothing for an unknown / non-rewardable plan', () => {
    expect(rewardFor('intensive')).toBe(0)
    expect(rewardFor('')).toBe(0)
    expect(rewardFor('nonsense')).toBe(0)
  })
})

describe('generateReferralCode', () => {
  it('uses a prefix derived from the first name plus four random chars', () => {
    const code = generateReferralCode('Jane Doe')
    expect(code.startsWith('JANE')).toBe(true)
    expect(code).toHaveLength(8)
  })

  it('falls back to an FF prefix when no usable name is given', () => {
    expect(generateReferralCode().startsWith('FF')).toBe(true)
    expect(generateReferralCode('   ').startsWith('FF')).toBe(true)
    // A name made only of ambiguous letters (I/L/O) leaves no prefix.
    expect(generateReferralCode('Lolo').startsWith('FF')).toBe(true)
  })

  it('never contains visually ambiguous characters (0 O 1 l I)', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = generateReferralCode('Oliver Ng')
      expect(code).toMatch(/^[A-Z2-9]+$/)
      expect(code).not.toMatch(/[OIL01]/)
    }
  })

  it('draws its random alphabet only from CODE_ALPHABET', () => {
    expect(CODE_ALPHABET).not.toMatch(/[OIL01]/)
    for (const ch of generateReferralCode('Zed')) {
      expect(CODE_ALPHABET).toContain(ch)
    }
  })
})

describe('normalizeCode', () => {
  it('uppercases, trims and strips inner whitespace', () => {
    expect(normalizeCode('  jane1a2b  ')).toBe('JANE1A2B')
    expect(normalizeCode('ja ne')).toBe('JANE')
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com')
  })
})

describe('isSelfReferral', () => {
  it('detects the same email regardless of case/whitespace', () => {
    expect(isSelfReferral('Jane@Example.com', ' jane@example.com ')).toBe(true)
  })

  it('is false for different emails', () => {
    expect(isSelfReferral('jane@example.com', 'john@example.com')).toBe(false)
  })
})

describe('isPastQualificationWindow', () => {
  const created = new Date('2026-01-01T00:00:00.000Z')

  it('exposes a 14 day window', () => {
    expect(QUALIFICATION_WINDOW_DAYS).toBe(14)
  })

  it('is false just inside the window (13d 23h)', () => {
    const now = new Date(created.getTime() + (13 * 24 + 23) * 60 * 60 * 1000)
    expect(isPastQualificationWindow(created, now)).toBe(false)
  })

  it('is true exactly on the boundary (14d)', () => {
    const now = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000)
    expect(isPastQualificationWindow(created, now)).toBe(true)
  })

  it('qualificationCutoff agrees with the window at, just before, and just after the boundary', () => {
    const now = new Date('2026-07-01T12:00:00.000Z')
    const cutoff = qualificationCutoff(now)
    for (const offsetMs of [-1, 0, 1]) {
      const createdAt = new Date(cutoff.getTime() + offsetMs)
      // created_at <= cutoff (the .lte DB query) must equal the tested helper
      expect(createdAt.getTime() <= cutoff.getTime()).toBe(isPastQualificationWindow(createdAt, now))
    }
  })
})

describe('referralUrl', () => {
  it('builds an /r/CODE link', () => {
    expect(referralUrl('https://www.fourteenfisherman.com', 'JANE1A2B')).toBe(
      'https://www.fourteenfisherman.com/r/JANE1A2B',
    )
  })

  it('does not double the slash when origin has a trailing slash', () => {
    expect(referralUrl('https://x.com/', 'AB12')).toBe('https://x.com/r/AB12')
  })
})

describe('REFERRAL_COOKIE', () => {
  it('is the ff_ref cookie', () => {
    expect(REFERRAL_COOKIE).toBe('ff_ref')
  })
})

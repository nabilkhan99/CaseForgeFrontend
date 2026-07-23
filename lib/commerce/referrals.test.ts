import { describe, expect, it } from 'vitest'
import {
  CODE_ALPHABET,
  MIN_QUALIFYING_SPEND_BY_PLAN,
  PAYOUT_FLOOR_DATE,
  QUALIFICATION_WINDOW_DAYS,
  REFERRAL_COOKIE,
  REWARD_BY_PLAN,
  decideReferral,
  generateReferralCode,
  isPastQualificationWindow,
  qualificationCutoff,
  isSelfReferral,
  meetsMinimumSpend,
  normalizeCode,
  normalizeEmail,
  referralUrl,
  rewardFor,
} from './referrals'
import { PLANS } from './plans'

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

  it('strips every character outside [A-Z0-9] (adversarial input)', () => {
    expect(normalizeCode('<script>x')).toBe('SCRIPTX')
    expect(normalizeCode('ab cd')).toBe('ABCD')
    expect(normalizeCode('a.b-c_d!')).toBe('ABCD')
    expect(normalizeCode('ref🎉code')).toBe('REFCODE')
    expect(normalizeCode('!!!')).toBe('')
  })

  it('caps the result at 16 characters', () => {
    expect(normalizeCode('a'.repeat(20))).toBe('A'.repeat(16))
    // Junk is stripped first, then the alnum remainder is truncated to 16.
    expect(normalizeCode('a-b-c-'.repeat(10))).toBe('ABCABCABCABCABCA')
    expect(normalizeCode('a-b-c-'.repeat(10))).toHaveLength(16)
  })

  it('leaves minted and hand-seeded codes intact', () => {
    expect(normalizeCode('JANE1A2B')).toBe('JANE1A2B')
    expect(normalizeCode('testref')).toBe('TESTREF')
  })
})

describe('meetsMinimumSpend', () => {
  it('gates rewardable plans at their floor (boundary inclusive)', () => {
    expect(meetsMinimumSpend('complete', 29950)).toBe(true)
    expect(meetsMinimumSpend('complete', 29949)).toBe(false)
    expect(meetsMinimumSpend('self_study', 14950)).toBe(true)
    expect(meetsMinimumSpend('self_study', 14949)).toBe(false)
  })

  it('passes plans with no floor regardless of amount (not gated)', () => {
    expect(meetsMinimumSpend('intensive', 0)).toBe(true)
    expect(meetsMinimumSpend('', 0)).toBe(true)
    expect(meetsMinimumSpend('sprint', 100)).toBe(true)
  })
})

describe('decideReferral', () => {
  it('records a full-price complete purchase as pending, £100', () => {
    expect(
      decideReferral({
        ownerEmail: 'owner@example.com',
        refereeEmail: 'buyer@example.com',
        plan: 'complete',
        amountTotalPence: 59900,
      }),
    ).toEqual({ status: 'pending', voidReason: null, rewardAmount: 10000 })
  })

  it('records a full-price self_study purchase as pending, £25', () => {
    expect(
      decideReferral({
        ownerEmail: 'owner@example.com',
        refereeEmail: 'buyer@example.com',
        plan: 'self_study',
        amountTotalPence: 19900,
      }),
    ).toEqual({ status: 'pending', voidReason: null, rewardAmount: 2500 })
  })

  it('voids a self-referral regardless of case/whitespace, reward still recorded', () => {
    expect(
      decideReferral({
        ownerEmail: 'Jane@Example.com',
        refereeEmail: ' jane@example.com ',
        plan: 'complete',
        amountTotalPence: 59900,
      }),
    ).toEqual({ status: 'void', voidReason: 'self_referral', rewardAmount: 10000 })
  })

  it('prefers self_referral over below_min_spend when both apply (£0 self-referral)', () => {
    expect(
      decideReferral({
        ownerEmail: 'jane@example.com',
        refereeEmail: 'jane@example.com',
        plan: 'complete',
        amountTotalPence: 0,
      }),
    ).toEqual({ status: 'void', voidReason: 'self_referral', rewardAmount: 10000 })
  })

  it('voids a £0 complete purchase as below_min_spend, reward still 10000', () => {
    expect(
      decideReferral({
        ownerEmail: 'owner@example.com',
        refereeEmail: 'buyer@example.com',
        plan: 'complete',
        amountTotalPence: 0,
      }),
    ).toEqual({ status: 'void', voidReason: 'below_min_spend', rewardAmount: 10000 })
  })

  it('applies the complete floor at the boundary (29950 pending, 29949 void)', () => {
    const base = {
      ownerEmail: 'owner@example.com',
      refereeEmail: 'buyer@example.com',
      plan: 'complete',
    }
    expect(decideReferral({ ...base, amountTotalPence: 29950 })).toEqual({
      status: 'pending',
      voidReason: null,
      rewardAmount: 10000,
    })
    expect(decideReferral({ ...base, amountTotalPence: 29949 })).toEqual({
      status: 'void',
      voidReason: 'below_min_spend',
      rewardAmount: 10000,
    })
  })

  it('applies the self_study floor at the boundary (14950 pending, 14949 void)', () => {
    const base = {
      ownerEmail: 'owner@example.com',
      refereeEmail: 'buyer@example.com',
      plan: 'self_study',
    }
    expect(decideReferral({ ...base, amountTotalPence: 14950 })).toEqual({
      status: 'pending',
      voidReason: null,
      rewardAmount: 2500,
    })
    expect(decideReferral({ ...base, amountTotalPence: 14949 })).toEqual({
      status: 'void',
      voidReason: 'below_min_spend',
      rewardAmount: 2500,
    })
  })

  it('leaves non-rewardable plans pending with zero reward, never gated', () => {
    for (const plan of ['intensive', 'sprint', '']) {
      expect(
        decideReferral({
          ownerEmail: 'owner@example.com',
          refereeEmail: 'buyer@example.com',
          plan,
          amountTotalPence: 0,
        }),
      ).toEqual({ status: 'pending', voidReason: null, rewardAmount: 0 })
    }
  })
})

describe('reward/min-spend catalogue drift guard', () => {
  const checkoutablePlanKeys = PLANS.filter((p) => p.cta === 'checkout').map((p) => p.key)

  it('every REWARD_BY_PLAN key is a checkout-able plan in PLANS', () => {
    for (const key of Object.keys(REWARD_BY_PLAN)) {
      const plan = PLANS.find((p) => p.key === key)
      expect(plan).toBeDefined()
      expect(plan?.cta).toBe('checkout')
    }
  })

  it('every checkout-able plan has a REWARD_BY_PLAN and MIN_QUALIFYING_SPEND_BY_PLAN entry', () => {
    for (const key of checkoutablePlanKeys) {
      expect(REWARD_BY_PLAN).toHaveProperty(key)
      expect(MIN_QUALIFYING_SPEND_BY_PLAN).toHaveProperty(key)
    }
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
  // Post-launch reference dates (the payout floor is 2026-09-01).
  const created = new Date('2026-10-01T00:00:00.000Z')

  it('exposes a 5 day window and the launch payout floor', () => {
    expect(QUALIFICATION_WINDOW_DAYS).toBe(5)
    expect(PAYOUT_FLOOR_DATE.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })

  it('is false just inside the window (4d 23h)', () => {
    const now = new Date(created.getTime() + (4 * 24 + 23) * 60 * 60 * 1000)
    expect(isPastQualificationWindow(created, now)).toBe(false)
  })

  it('is true exactly on the boundary (5d)', () => {
    const now = new Date(created.getTime() + 5 * 24 * 60 * 60 * 1000)
    expect(isPastQualificationWindow(created, now)).toBe(true)
  })

  it('never qualifies before the payout floor, however old the referral', () => {
    const preorderRow = new Date('2026-07-20T00:00:00.000Z') // weeks old by launch
    const beforeFloor = new Date('2026-08-31T23:59:59.999Z')
    expect(isPastQualificationWindow(preorderRow, beforeFloor)).toBe(false)
  })

  it('a pre-launch referral qualifies at the floor instant itself', () => {
    const preorderRow = new Date('2026-07-20T00:00:00.000Z')
    expect(isPastQualificationWindow(preorderRow, PAYOUT_FLOOR_DATE)).toBe(true)
  })

  it('a purchase within 5 days of launch still serves its full window', () => {
    const lateAugust = new Date('2026-08-29T00:00:00.000Z')
    expect(isPastQualificationWindow(lateAugust, PAYOUT_FLOOR_DATE)).toBe(false)
    const fiveDaysOn = new Date(lateAugust.getTime() + 5 * 24 * 60 * 60 * 1000)
    expect(isPastQualificationWindow(lateAugust, fiveDaysOn)).toBe(true)
  })

  it('qualificationCutoff agrees with the window at, just before, and just after the boundary', () => {
    const now = new Date('2026-10-15T12:00:00.000Z')
    const cutoff = qualificationCutoff(now)
    for (const offsetMs of [-1, 0, 1]) {
      const createdAt = new Date(cutoff.getTime() + offsetMs)
      // created_at <= cutoff (the .lte DB query) must equal the tested helper
      expect(createdAt.getTime() <= cutoff.getTime()).toBe(isPastQualificationWindow(createdAt, now))
    }
  })

  it('qualificationCutoff before the floor matches no real row', () => {
    const beforeFloor = new Date('2026-08-15T00:00:00.000Z')
    expect(qualificationCutoff(beforeFloor).getTime()).toBe(0)
    // Equivalence holds for any realistic created_at (post-2020)
    const createdAt = new Date('2026-07-20T00:00:00.000Z')
    expect(createdAt.getTime() <= 0).toBe(isPastQualificationWindow(createdAt, beforeFloor))
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

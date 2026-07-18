import { describe, expect, it } from 'vitest'
import {
  computeDashboardStats,
  type CodeRow,
  type ReferralRow,
} from './referralStats'

function code(overrides: Partial<CodeRow> = {}): CodeRow {
  return {
    code: 'ALICE23',
    owner_email: 'alice@example.com',
    owner_name: 'Alice',
    active: true,
    click_count: 0,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function ref(overrides: Partial<ReferralRow> = {}): ReferralRow {
  return {
    referral_code: 'ALICE23',
    plan: 'complete',
    amount: 59900,
    reward_amount: 10000,
    status: 'pending',
    created_at: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('computeDashboardStats — empty inputs', () => {
  it('returns all-zero totals and no advocates', () => {
    const stats = computeDashboardStats([], [])
    expect(stats).toEqual({
      totalClicks: 0,
      totalPurchases: 0,
      totalRevenuePence: 0,
      owedNowPence: 0,
      pendingPence: 0,
      paidPence: 0,
      advocates: [],
    })
  })

  it('ignores referrals when there are no codes at all', () => {
    const stats = computeDashboardStats([], [ref()])
    expect(stats.advocates).toEqual([])
    expect(stats.totalPurchases).toBe(0)
    expect(stats.totalRevenuePence).toBe(0)
  })
})

describe('computeDashboardStats — one code, no referrals', () => {
  it('surfaces a pre-first-sale advocate with clicks and a 0 conversion', () => {
    // Elizabeth has clicked-through traffic but no purchases yet — she must
    // still appear, with conversion 0 (not null: null is reserved for 0 clicks).
    const stats = computeDashboardStats(
      [code({ code: 'LIZ42', owner_name: 'Elizabeth', click_count: 7 })],
      [],
    )
    expect(stats.advocates).toHaveLength(1)
    const liz = stats.advocates[0]
    expect(liz.code).toBe('LIZ42')
    expect(liz.clicks).toBe(7)
    expect(liz.purchases).toBe(0)
    expect(liz.conversionPct).toBe(0)
    expect(liz.earnedPence).toBe(0)
    expect(liz.revenuePence).toBe(0)
    expect(stats.totalClicks).toBe(7)
  })

  it('has a null conversion when the code has zero clicks and no referrals', () => {
    const stats = computeDashboardStats(
      [code({ code: 'NEW00', click_count: 0 })],
      [],
    )
    expect(stats.advocates).toHaveLength(1)
    expect(stats.advocates[0].conversionPct).toBeNull()
  })
})

describe('computeDashboardStats — full status matrix', () => {
  const codes = [code({ code: 'ALICE23', click_count: 10 })]
  const referrals: ReferralRow[] = [
    ref({ status: 'pending', amount: 59900, reward_amount: 10000 }),
    ref({ status: 'qualified', amount: 19900, reward_amount: 2500 }),
    ref({ status: 'paid', amount: 59900, reward_amount: 10000 }),
    ref({ status: 'void', amount: 0, reward_amount: 10000 }),
  ]
  const stats = computeDashboardStats(codes, referrals)
  const a = stats.advocates[0]

  it('counts only non-void referrals as purchases', () => {
    expect(a.purchases).toBe(3)
  })

  it('sums revenue from non-void referrals only', () => {
    expect(a.revenuePence).toBe(59900 + 19900 + 59900)
  })

  it('breaks reward down by status', () => {
    expect(a.pendingPence).toBe(10000)
    expect(a.qualifiedPence).toBe(2500)
    expect(a.paidPence).toBe(10000)
    expect(a.voidPence).toBe(10000)
  })

  it('earnedPence excludes void', () => {
    expect(a.earnedPence).toBe(10000 + 2500 + 10000)
  })

  it('computes conversion to 1dp (3/10 => 30)', () => {
    expect(a.conversionPct).toBe(30)
  })

  it('rolls dashboard totals across all codes', () => {
    expect(stats.totalClicks).toBe(10)
    expect(stats.totalPurchases).toBe(3)
    expect(stats.totalRevenuePence).toBe(59900 + 19900 + 59900)
    expect(stats.owedNowPence).toBe(2500) // qualified only
    expect(stats.pendingPence).toBe(10000)
    expect(stats.paidPence).toBe(10000)
  })
})

describe('computeDashboardStats — conversion rounding', () => {
  it('rounds to a single decimal (1/3 => 33.3)', () => {
    const stats = computeDashboardStats(
      [code({ click_count: 3 })],
      [ref({ status: 'paid' })],
    )
    expect(stats.advocates[0].conversionPct).toBe(33.3)
  })

  it('returns null conversion even when there are purchases but zero clicks', () => {
    const stats = computeDashboardStats(
      [code({ click_count: 0 })],
      [ref({ status: 'paid' })],
    )
    expect(stats.advocates[0].clicks).toBe(0)
    expect(stats.advocates[0].purchases).toBe(1)
    expect(stats.advocates[0].conversionPct).toBeNull()
  })
})

describe('computeDashboardStats — sorting', () => {
  it('sorts by earnedPence desc, then clicks desc', () => {
    const codes = [
      code({ code: 'LOW', owner_email: 'low@x.com', click_count: 50 }),
      code({ code: 'HIGH', owner_email: 'high@x.com', click_count: 1 }),
      code({ code: 'MIDA', owner_email: 'mida@x.com', click_count: 5 }),
      code({ code: 'MIDB', owner_email: 'midb@x.com', click_count: 9 }),
    ]
    const referrals = [
      ref({ referral_code: 'HIGH', status: 'paid', reward_amount: 10000 }),
      ref({ referral_code: 'MIDA', status: 'qualified', reward_amount: 2500 }),
      ref({ referral_code: 'MIDB', status: 'pending', reward_amount: 2500 }),
      // LOW earns nothing (only clicks + a void)
      ref({ referral_code: 'LOW', status: 'void', reward_amount: 10000 }),
    ]
    const stats = computeDashboardStats(codes, referrals)
    // HIGH (10000) first; MIDA & MIDB tie on 2500 -> MIDB (9 clicks) before MIDA (5); LOW (0) last.
    expect(stats.advocates.map((a) => a.code)).toEqual(['HIGH', 'MIDB', 'MIDA', 'LOW'])
  })
})

describe('computeDashboardStats — unknown-code referrals', () => {
  it('ignores a referral whose code is not in the codes list', () => {
    const stats = computeDashboardStats(
      [code({ code: 'ALICE23', click_count: 4 })],
      [
        ref({ referral_code: 'ALICE23', status: 'paid', amount: 59900, reward_amount: 10000 }),
        ref({ referral_code: 'GHOST99', status: 'paid', amount: 59900, reward_amount: 10000 }),
      ],
    )
    expect(stats.advocates).toHaveLength(1)
    expect(stats.advocates[0].purchases).toBe(1)
    expect(stats.totalPurchases).toBe(1)
    expect(stats.totalRevenuePence).toBe(59900)
    expect(stats.paidPence).toBe(10000)
  })
})

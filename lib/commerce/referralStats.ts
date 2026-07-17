/**
 * Pure, dependency-free aggregation for the founders' referral dashboard.
 *
 * Imports nothing (no Supabase / next) so it is trivially unit-testable and safe
 * to import from server routes and server components alike. Every value is a
 * snapshot — no I/O, no mutation of the inputs.
 *
 * Money is always pence (integers); percentages are numbers.
 */

/** One advocate's share code, as stored in `referral_codes`. */
export interface CodeRow {
  code: string
  owner_email: string
  owner_name: string | null
  active: boolean
  click_count: number
  created_at: string
}

/** One attributed purchase, as stored in `referrals`. */
export interface ReferralRow {
  referral_code: string
  plan: string
  amount: number
  reward_amount: number
  status: 'pending' | 'qualified' | 'paid' | 'void'
  created_at: string
}

/** Per-advocate rollup. All pence fields exclude nothing except where noted. */
export interface AdvocateStats {
  code: string
  ownerEmail: string
  ownerName: string | null
  active: boolean
  clicks: number
  /** Non-void referrals only (a £0-promo / refunded buy isn't a real purchase). */
  purchases: number
  /** purchases / clicks * 100, 1dp; null when clicks === 0. */
  conversionPct: number | null
  /** Sum of `amount` across non-void referrals. */
  revenuePence: number
  /** pending + qualified + paid reward sums (excludes void). */
  earnedPence: number
  pendingPence: number
  qualifiedPence: number
  paidPence: number
  /** Reward sum of void rows — visible forfeits, not part of earned. */
  voidPence: number
}

/** Whole-dashboard rollup plus the per-advocate breakdown. */
export interface DashboardStats {
  totalClicks: number
  totalPurchases: number
  totalRevenuePence: number
  /** Sum of qualified reward across all codes — what is owed right now. */
  owedNowPence: number
  pendingPence: number
  paidPence: number
  advocates: AdvocateStats[]
}

interface MutableAdvocate {
  code: string
  ownerEmail: string
  ownerName: string | null
  active: boolean
  clicks: number
  purchases: number
  revenuePence: number
  pendingPence: number
  qualifiedPence: number
  paidPence: number
  voidPence: number
}

function conversion(purchases: number, clicks: number): number | null {
  if (clicks === 0) return null
  return Math.round((purchases / clicks) * 1000) / 10
}

/**
 * Aggregate raw code and referral rows into dashboard stats.
 *
 * Rules:
 *  - Purchases / revenue count NON-VOID referrals only.
 *  - earnedPence = pending + qualified + paid reward (excludes void).
 *  - voidPence = reward sum of void rows (visible forfeits).
 *  - conversionPct = purchases / clicks * 100, 1dp; null when clicks === 0.
 *  - owedNowPence = qualified reward summed across all codes.
 *  - Codes with zero referrals still appear (their clicks matter).
 *  - Referrals whose `referral_code` is not in `codes` are ignored.
 *  - Advocates sorted by earnedPence desc, then clicks desc.
 */
export function computeDashboardStats(
  codes: readonly CodeRow[],
  referrals: readonly ReferralRow[],
): DashboardStats {
  const byCode = new Map<string, MutableAdvocate>()

  for (const c of codes) {
    byCode.set(c.code, {
      code: c.code,
      ownerEmail: c.owner_email,
      ownerName: c.owner_name,
      active: c.active,
      clicks: c.click_count,
      purchases: 0,
      revenuePence: 0,
      pendingPence: 0,
      qualifiedPence: 0,
      paidPence: 0,
      voidPence: 0,
    })
  }

  for (const r of referrals) {
    const advocate = byCode.get(r.referral_code)
    if (!advocate) continue // ignore referrals for unknown codes

    if (r.status === 'void') {
      advocate.voidPence += r.reward_amount
      continue
    }

    // Non-void: a real purchase with real revenue.
    advocate.purchases += 1
    advocate.revenuePence += r.amount

    if (r.status === 'pending') advocate.pendingPence += r.reward_amount
    else if (r.status === 'qualified') advocate.qualifiedPence += r.reward_amount
    else if (r.status === 'paid') advocate.paidPence += r.reward_amount
  }

  const advocates: AdvocateStats[] = Array.from(byCode.values())
    .map((a) => ({
      code: a.code,
      ownerEmail: a.ownerEmail,
      ownerName: a.ownerName,
      active: a.active,
      clicks: a.clicks,
      purchases: a.purchases,
      conversionPct: conversion(a.purchases, a.clicks),
      revenuePence: a.revenuePence,
      earnedPence: a.pendingPence + a.qualifiedPence + a.paidPence,
      pendingPence: a.pendingPence,
      qualifiedPence: a.qualifiedPence,
      paidPence: a.paidPence,
      voidPence: a.voidPence,
    }))
    .sort((a, b) => b.earnedPence - a.earnedPence || b.clicks - a.clicks)

  const totals = advocates.reduce(
    (acc, a) => {
      acc.totalClicks += a.clicks
      acc.totalPurchases += a.purchases
      acc.totalRevenuePence += a.revenuePence
      acc.owedNowPence += a.qualifiedPence
      acc.pendingPence += a.pendingPence
      acc.paidPence += a.paidPence
      return acc
    },
    {
      totalClicks: 0,
      totalPurchases: 0,
      totalRevenuePence: 0,
      owedNowPence: 0,
      pendingPence: 0,
      paidPence: 0,
    },
  )

  return { ...totals, advocates }
}

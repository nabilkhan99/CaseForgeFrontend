/**
 * Pure, dependency-free aggregation for the admin orders view.
 *
 * Imports only the plan catalogue (no Supabase / next) so it is trivially
 * unit-testable and safe to import from server routes and server components
 * alike. Every value is a snapshot — no I/O, no mutation of the inputs.
 *
 * Money is always pence (integers); percentages are numbers.
 */

import { getPlan } from './plans'

/** One purchase, as stored in `preorders`. */
export interface OrderRow {
  plan: string
  amount: number
  /** 'paid' | 'refunded' | 'canceled' — only 'paid' counts as revenue. */
  status: string
  referral_code: string | null
  coaching_day: string | null
}

/** Per-plan rollup. Paid-only counts; the plan appears if it has any order. */
export interface PlanBreakdown {
  planKey: string
  /** Display name from the plan catalogue, falling back to the raw key. */
  planName: string
  paidCount: number
  revenuePence: number
}

/** Whole-orders rollup plus the per-plan breakdown. */
export interface OrderStats {
  paidCount: number
  refundedCount: number
  /** Sum of `amount` across paid orders only (refunded/canceled excluded). */
  grossRevenuePence: number
  /** Sum of `amount` across refunded orders — money handed back. */
  refundedPence: number
  /** Paid orders that carried a referral code. */
  referredPaidCount: number
  /** referredPaidCount / paidCount * 100, 1dp; null when paidCount === 0. */
  referredPct: number | null
  byPlan: PlanBreakdown[]
}

interface MutablePlan {
  planKey: string
  paidCount: number
  revenuePence: number
}

function referredShare(referredPaidCount: number, paidCount: number): number | null {
  if (paidCount === 0) return null
  return Math.round((referredPaidCount / paidCount) * 1000) / 10
}

/**
 * Aggregate raw preorder rows into the admin orders stats.
 *
 * Rules:
 *  - Revenue counts PAID orders only; refunded/canceled never add to gross.
 *  - refundedPence / refundedCount cover status 'refunded' (canceled orders
 *    took no money, so they sit in neither bucket).
 *  - referredPct = referred paid / paid * 100, 1dp; null when paidCount === 0.
 *  - byPlan counts and revenue are paid-only, but a plan appears as soon as it
 *    has ANY order — a fully refunded plan still shows, at zero.
 *  - Plan display names come from the catalogue; an unknown key shows raw.
 *  - byPlan sorted by revenuePence desc (the sort is stable, so plans tied on
 *    revenue keep first-seen order).
 */
export function computeOrderStats(orders: readonly OrderRow[]): OrderStats {
  const byPlanKey = new Map<string, MutablePlan>()
  let paidCount = 0
  let refundedCount = 0
  let grossRevenuePence = 0
  let refundedPence = 0
  let referredPaidCount = 0

  for (const o of orders) {
    let plan = byPlanKey.get(o.plan)
    if (!plan) {
      plan = { planKey: o.plan, paidCount: 0, revenuePence: 0 }
      byPlanKey.set(o.plan, plan)
    }

    if (o.status === 'paid') {
      paidCount += 1
      grossRevenuePence += o.amount
      if (o.referral_code) referredPaidCount += 1
      plan.paidCount += 1
      plan.revenuePence += o.amount
    } else if (o.status === 'refunded') {
      refundedCount += 1
      refundedPence += o.amount
    }
    // 'canceled' (and anything unexpected) only registers the plan's existence.
  }

  const byPlan: PlanBreakdown[] = Array.from(byPlanKey.values())
    .map((p) => ({
      planKey: p.planKey,
      planName: getPlan(p.planKey)?.name ?? p.planKey,
      paidCount: p.paidCount,
      revenuePence: p.revenuePence,
    }))
    .sort((a, b) => b.revenuePence - a.revenuePence)

  return {
    paidCount,
    refundedCount,
    grossRevenuePence,
    refundedPence,
    referredPaidCount,
    referredPct: referredShare(referredPaidCount, paidCount),
    byPlan,
  }
}

/**
 * Pure, dependency-free aggregation for the admin orders view.
 *
 * Imports only the plan catalogue and the coaching slot contract (no Supabase /
 * next) so it is trivially unit-testable and safe to import from server routes,
 * server components and the client table alike. Every value is a snapshot — no
 * I/O, no mutation of the inputs.
 *
 * Money is always pence (integers); percentages are numbers.
 */

import { getPlan } from './plans'
import { COACHING_SLOT_ORDER, isCoachingSlotKey, type CoachingSlotKey } from './coachingSlots'

/** One purchase, as stored in `preorders`. */
export interface OrderRow {
  plan: string
  amount: number
  /** 'paid' | 'refunded' | 'canceled' — only 'paid' counts as revenue. */
  status: string
  referral_code: string | null
  /** Date of the booked coaching session (ISO), Complete only. */
  coaching_day: string | null
  /** Slot of the booked coaching session; null on a booking made before slots existed. */
  coaching_slot?: string | null
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

/** One row of `coaching_slot_availability`, as the admin view reads it. */
export interface SlotAvailabilityRow {
  day: string
  slot: string
  /** 'open' | 'booked' | 'closed'. 'booked' covers a live checkout hold too. */
  status: string
  past: boolean
}

/** A purchase, as far as coaching session bookings are concerned. */
export interface SessionBookingOrder {
  email: string
  full_name: string | null
  plan: string
  status: string
  coaching_day: string | null
  coaching_slot?: string | null
}

/**
 * booked: a paid Complete order occupies the slot. held: no paid order, but a
 * buyer is in checkout on it right now. open: bookable. closed: bookings for the
 * date have closed with nobody in the slot.
 */
export type SlotBookingState = 'booked' | 'held' | 'open' | 'closed'

export interface SlotBooking {
  state: SlotBookingState
  /**
   * Who is booked into the slot (name, or email when there is no name). More
   * than one entry is a double booking and needs sorting out by hand.
   */
  bookedBy: string[]
}

/** One coaching date, with who (if anyone) is booked into each of its slots. */
export interface SessionDateBookings {
  day: string
  past: boolean
  slots: Record<CoachingSlotKey, SlotBooking>
}

/** Does this paid order occupy that slot? A booking with no slot takes the whole date. */
function occupies(order: SessionBookingOrder, day: string, slot: CoachingSlotKey): boolean {
  if (order.plan !== 'complete' || order.status !== 'paid' || order.coaching_day !== day) return false
  return !isCoachingSlotKey(order.coaching_slot) || order.coaching_slot === slot
}

function slotBooking(
  day: string,
  slot: CoachingSlotKey,
  availability: readonly SlotAvailabilityRow[],
  orders: readonly SessionBookingOrder[],
): SlotBooking {
  const bookedBy = orders
    .filter((o) => occupies(o, day, slot))
    .map((o) => o.full_name?.trim() || o.email)
  if (bookedBy.length > 0) return { state: 'booked', bookedBy }

  const viewStatus = availability.find((a) => a.day === day && a.slot === slot)?.status
  const state: SlotBookingState =
    viewStatus === 'booked' ? 'held' : viewStatus === 'closed' ? 'closed' : 'open'
  return { state, bookedBy: [] }
}

/**
 * Per-slot bookings for every configured coaching date, oldest date first.
 *
 * Each slot takes one booking. Who is in it comes from the paid orders (so the
 * view can name them); whether an empty slot is held, open or closed comes from
 * the availability view. A legacy booking with no slot shows in both slots of
 * its date, because that is the capacity it actually takes.
 */
export function computeSessionBookings(
  availability: readonly SlotAvailabilityRow[],
  orders: readonly SessionBookingOrder[],
): SessionDateBookings[] {
  const days = Array.from(new Set(availability.map((a) => a.day))).sort()
  return days.map((day) => {
    const past = availability.some((a) => a.day === day && a.past)
    const entries = COACHING_SLOT_ORDER.map(
      (slot) => [slot, slotBooking(day, slot, availability, orders)] as const,
    )
    return {
      day,
      past,
      slots: Object.fromEntries(entries) as Record<CoachingSlotKey, SlotBooking>,
    }
  })
}

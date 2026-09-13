import { describe, expect, it } from 'vitest'
import {
  computeOrderStats,
  computeSessionBookings,
  type OrderRow,
  type SessionBookingOrder,
  type SlotAvailabilityRow,
} from './orderStats'

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    plan: 'complete',
    amount: 59900,
    status: 'paid',
    referral_code: null,
    coaching_day: '2026-09-12',
    ...overrides,
  }
}

describe('computeOrderStats — empty input', () => {
  it('returns all-zero totals, a null referred share and no plans', () => {
    expect(computeOrderStats([])).toEqual({
      paidCount: 0,
      refundedCount: 0,
      grossRevenuePence: 0,
      refundedPence: 0,
      referredPaidCount: 0,
      referredPct: null,
      byPlan: [],
    })
  })
})

describe('computeOrderStats — mixed paid / refunded / canceled', () => {
  const orders: OrderRow[] = [
    order({ plan: 'complete', amount: 59900, status: 'paid' }),
    order({ plan: 'complete', amount: 59900, status: 'refunded' }),
    order({ plan: 'self_study', amount: 29900, status: 'paid' }),
    order({ plan: 'self_study', amount: 29900, status: 'canceled' }),
  ]
  const stats = computeOrderStats(orders)

  it('counts only paid orders', () => {
    expect(stats.paidCount).toBe(2)
  })

  it('excludes refunded and canceled money from gross revenue', () => {
    expect(stats.grossRevenuePence).toBe(59900 + 29900)
  })

  it('tracks refunded money and count separately', () => {
    expect(stats.refundedCount).toBe(1)
    expect(stats.refundedPence).toBe(59900)
  })

  it('leaves canceled orders out of both the paid and refunded buckets', () => {
    // The canceled self_study order took no money and was never refunded.
    expect(stats.refundedCount).toBe(1)
    expect(stats.paidCount).toBe(2)
  })
})

describe('computeOrderStats — referred share', () => {
  it('counts paid orders carrying a referral code', () => {
    const stats = computeOrderStats([
      order({ referral_code: 'ALICE23' }),
      order({ referral_code: 'ALICE23' }),
      order({ referral_code: null }),
      order({ referral_code: null }),
    ])
    expect(stats.referredPaidCount).toBe(2)
    expect(stats.referredPct).toBe(50)
  })

  it('rounds the referred share to a single decimal (1/3 => 33.3)', () => {
    const stats = computeOrderStats([
      order({ referral_code: 'LIZ42' }),
      order({ referral_code: null }),
      order({ referral_code: null }),
    ])
    expect(stats.referredPct).toBe(33.3)
  })

  it('ignores a referral code on a refunded order', () => {
    const stats = computeOrderStats([
      order({ status: 'paid', referral_code: null }),
      order({ status: 'refunded', referral_code: 'ALICE23' }),
    ])
    expect(stats.referredPaidCount).toBe(0)
    expect(stats.referredPct).toBe(0)
  })

  it('returns a null share when there are no paid orders at all', () => {
    const stats = computeOrderStats([
      order({ status: 'refunded', referral_code: 'ALICE23' }),
      order({ status: 'canceled' }),
    ])
    expect(stats.paidCount).toBe(0)
    expect(stats.referredPct).toBeNull()
  })
})

describe('computeOrderStats — by plan', () => {
  it('sorts plans by revenue desc and uses catalogue display names', () => {
    const stats = computeOrderStats([
      order({ plan: 'self_study', amount: 29900 }),
      order({ plan: 'self_study', amount: 29900 }),
      order({ plan: 'complete', amount: 59900 }),
      order({ plan: 'complete', amount: 59900 }),
    ])
    expect(stats.byPlan.map((p) => p.planKey)).toEqual(['complete', 'self_study'])
    expect(stats.byPlan.map((p) => p.planName)).toEqual(['Complete', 'Self-Study'])
    expect(stats.byPlan[0]).toEqual({
      planKey: 'complete',
      planName: 'Complete',
      paidCount: 2,
      revenuePence: 119800,
    })
    expect(stats.byPlan[1].revenuePence).toBe(59800)
  })

  it('still lists a plan whose only orders were refunded, at zero', () => {
    const stats = computeOrderStats([
      order({ plan: 'complete', amount: 59900, status: 'paid' }),
      order({ plan: 'self_study', amount: 29900, status: 'refunded' }),
    ])
    const selfStudy = stats.byPlan.find((p) => p.planKey === 'self_study')
    expect(selfStudy).toEqual({
      planKey: 'self_study',
      planName: 'Self-Study',
      paidCount: 0,
      revenuePence: 0,
    })
  })

  it('falls back to the raw key as the name for an unknown plan', () => {
    const stats = computeOrderStats([order({ plan: 'legacy_bundle', amount: 9900 })])
    expect(stats.byPlan).toEqual([
      { planKey: 'legacy_bundle', planName: 'legacy_bundle', paidCount: 1, revenuePence: 9900 },
    ])
  })
})

describe('computeOrderStats — purity', () => {
  it('does not mutate the input rows', () => {
    const rows: OrderRow[] = [order({ plan: 'complete' }), order({ plan: 'self_study' })]
    const snapshot = JSON.parse(JSON.stringify(rows))
    computeOrderStats(rows)
    expect(rows).toEqual(snapshot)
  })
})

describe('computeSessionBookings — one booking per slot', () => {
  const view = (day: string, slot: string, status = 'open', past = false): SlotAvailabilityRow => ({
    day,
    slot,
    status,
    past,
  })
  const booking = (over: Partial<SessionBookingOrder> = {}): SessionBookingOrder => ({
    email: 'buyer@nhs.net',
    full_name: 'Jane Okonkwo',
    plan: 'complete',
    status: 'paid',
    coaching_day: '2026-11-07',
    coaching_slot: 'morning',
    ...over,
  })

  it('lists each configured date once, oldest first, with both slots', () => {
    const result = computeSessionBookings(
      [
        view('2026-11-08', 'morning'),
        view('2026-11-07', 'afternoon'),
        view('2026-11-07', 'morning'),
        view('2026-11-08', 'afternoon'),
      ],
      [],
    )
    expect(result.map((d) => d.day)).toEqual(['2026-11-07', '2026-11-08'])
    expect(Object.keys(result[0].slots)).toEqual(['morning', 'afternoon'])
  })

  it('names who is booked into a slot and leaves the other slot open', () => {
    const [date] = computeSessionBookings(
      [view('2026-11-07', 'morning', 'booked'), view('2026-11-07', 'afternoon')],
      [booking()],
    )
    expect(date.slots.morning).toEqual({ state: 'booked', bookedBy: ['Jane Okonkwo'] })
    expect(date.slots.afternoon).toEqual({ state: 'open', bookedBy: [] })
  })

  it('falls back to the email when the order has no name', () => {
    const [date] = computeSessionBookings(
      [view('2026-11-07', 'morning', 'booked')],
      [booking({ full_name: '  ' })],
    )
    expect(date.slots.morning.bookedBy).toEqual(['buyer@nhs.net'])
  })

  it('shows a slot the view calls booked, with no paid order behind it, as held', () => {
    // A buyer is in checkout on it right now.
    const [date] = computeSessionBookings([view('2026-11-07', 'afternoon', 'booked')], [])
    expect(date.slots.afternoon).toEqual({ state: 'held', bookedBy: [] })
  })

  it('shows an empty slot on a closed date as closed, and a booked one as booked', () => {
    const [date] = computeSessionBookings(
      [view('2026-11-07', 'morning', 'closed', true), view('2026-11-07', 'afternoon', 'closed', true)],
      [booking({ coaching_slot: 'afternoon' })],
    )
    expect(date.past).toBe(true)
    expect(date.slots.morning.state).toBe('closed')
    expect(date.slots.afternoon.state).toBe('booked')
  })

  it('puts a legacy booking with no slot in both slots of its date', () => {
    const [date] = computeSessionBookings(
      [view('2026-11-07', 'morning', 'booked'), view('2026-11-07', 'afternoon', 'booked')],
      [booking({ coaching_slot: null, full_name: 'Old Format' })],
    )
    expect(date.slots.morning.bookedBy).toEqual(['Old Format'])
    expect(date.slots.afternoon.bookedBy).toEqual(['Old Format'])
  })

  it('surfaces a double booking as two names in one slot', () => {
    const [date] = computeSessionBookings(
      [view('2026-11-07', 'morning', 'booked')],
      [booking({ full_name: 'First' }), booking({ full_name: 'Second', email: 'second@nhs.net' })],
    )
    expect(date.slots.morning.bookedBy).toEqual(['First', 'Second'])
  })

  it('ignores refunded, canceled, non-Complete and other-date orders', () => {
    const [date] = computeSessionBookings(
      [view('2026-11-07', 'morning')],
      [
        booking({ status: 'refunded' }),
        booking({ status: 'canceled' }),
        booking({ plan: 'self_study' }),
        booking({ coaching_day: '2026-11-08' }),
      ],
    )
    expect(date.slots.morning).toEqual({ state: 'open', bookedBy: [] })
  })

  it('does not mutate its inputs', () => {
    const availability = [view('2026-11-07', 'morning', 'booked')]
    const orders = [booking()]
    const snapshot = JSON.parse(JSON.stringify({ availability, orders }))
    computeSessionBookings(availability, orders)
    expect({ availability, orders }).toEqual(snapshot)
  })
})

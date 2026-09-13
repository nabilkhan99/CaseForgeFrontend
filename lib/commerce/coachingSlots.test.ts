import { describe, expect, it } from 'vitest'
import {
  coachingSessionCheckoutLine,
  coachingSessionLabel,
  formatCoachingDate,
  formatCoachingDateCompact,
  groupSlotsByMonth,
  isCoachingSlotKey,
  isIsoDate,
  monthAvailabilityLine,
  slotTimeRange,
  type CoachingSlotAvailability,
} from './coachingSlots'

const slot = (
  day: string,
  s: CoachingSlotAvailability['slot'],
  status: CoachingSlotAvailability['status'] = 'open',
): CoachingSlotAvailability => ({ day, slot: s, status, cutoff_at: `${day}T00:00:00+01:00` })

describe('labels', () => {
  it('describes a session with weekday, date and time range', () => {
    expect(coachingSessionLabel('2026-11-07', 'morning')).toBe('Saturday 7 November 2026, 09:00 to 12:00')
    expect(coachingSessionLabel('2026-10-04', 'afternoon')).toBe('Sunday 4 October 2026, 13:00 to 16:00')
  })

  it('writes the Stripe payment page line without the year', () => {
    expect(coachingSessionCheckoutLine('2026-11-07', 'morning')).toBe(
      'Coaching session: Saturday 7 November, 09:00 to 12:00',
    )
  })

  it('formats compact and long dates independent of time zone', () => {
    expect(formatCoachingDate('2026-10-03')).toBe('Saturday 3 October 2026')
    expect(formatCoachingDateCompact('2026-10-03')).toBe('Sat 3 Oct')
    expect(slotTimeRange('afternoon')).toBe('13:00 to 16:00')
  })

  it('never uses a dash in customer-facing strings', () => {
    const strings = [
      coachingSessionLabel('2026-11-07', 'morning'),
      coachingSessionCheckoutLine('2026-11-08', 'afternoon'),
      monthAvailabilityLine(0).text,
      monthAvailabilityLine(1).text,
    ]
    for (const s of strings) expect(s).not.toMatch(/[–—]/)
  })
})

describe('guards', () => {
  it('accepts only the two slot keys', () => {
    expect(isCoachingSlotKey('morning')).toBe(true)
    expect(isCoachingSlotKey('afternoon')).toBe(true)
    expect(isCoachingSlotKey('evening')).toBe(false)
    expect(isCoachingSlotKey(undefined)).toBe(false)
  })

  it('accepts only real ISO calendar dates', () => {
    expect(isIsoDate('2026-11-07')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('7 Nov')).toBe(false)
    expect(isIsoDate(20261107)).toBe(false)
  })
})

describe('groupSlotsByMonth', () => {
  // The spec's illustration: 4 Oct morning and 7 Nov morning are booked.
  const slots = [
    slot('2026-11-08', 'afternoon'),
    slot('2026-10-03', 'morning'),
    slot('2026-10-03', 'afternoon'),
    slot('2026-10-04', 'afternoon'),
    slot('2026-10-04', 'morning', 'booked'),
    slot('2026-11-07', 'morning', 'booked'),
    slot('2026-11-07', 'afternoon'),
    slot('2026-11-08', 'morning'),
  ]

  it('groups chronologically by month with slots in morning, afternoon order', () => {
    const months = groupSlotsByMonth(slots)
    expect(months.map((m) => m.monthLabel)).toEqual(['October', 'November'])
    expect(months[0].dates.map((d) => d.day)).toEqual(['2026-10-03', '2026-10-04'])
    expect(months[0].dates[1].slots.map((s) => s.slot)).toEqual(['morning', 'afternoon'])
  })

  it('counts open slots per month from slot state', () => {
    const months = groupSlotsByMonth(slots)
    expect(months.map((m) => m.slotsLeft)).toEqual([3, 3])
  })

  it('marks a date sold out only when every slot is booked', () => {
    const months = groupSlotsByMonth([
      slot('2026-12-05', 'morning', 'booked'),
      slot('2026-12-05', 'afternoon', 'booked'),
      slot('2026-12-06', 'morning', 'booked'),
      slot('2026-12-06', 'afternoon'),
    ])
    expect(months[0].dates.map((d) => d.status)).toEqual(['sold_out', 'open'])
    expect(months[0].slotsLeft).toBe(1)
  })

  it('marks a date closed when nothing is open and it is not simply sold out', () => {
    const months = groupSlotsByMonth([
      slot('2026-09-19', 'morning', 'closed'),
      slot('2026-09-19', 'afternoon', 'booked'),
    ])
    expect(months[0].dates[0].status).toBe('closed')
    expect(months[0].slotsLeft).toBe(0)
  })

  it('adds the year to months outside the first year', () => {
    const months = groupSlotsByMonth([slot('2026-12-05', 'morning'), slot('2027-01-09', 'morning')])
    expect(months.map((m) => m.monthLabel)).toEqual(['December', 'January 2027'])
  })

  it('returns nothing for no slots', () => {
    expect(groupSlotsByMonth([])).toEqual([])
  })
})

describe('monthAvailabilityLine', () => {
  it('is standard at 3 or more', () => {
    expect(monthAvailabilityLine(3)).toEqual({ text: 'Only 3 slots left', tone: 'standard' })
    expect(monthAvailabilityLine(4)).toEqual({ text: 'Only 4 slots left', tone: 'standard' })
  })

  it('is urgent at 1 or 2', () => {
    expect(monthAvailabilityLine(2)).toEqual({ text: 'Only 2 slots left', tone: 'urgent' })
    expect(monthAvailabilityLine(1)).toEqual({ text: 'Only 1 slot left', tone: 'urgent' })
  })

  it('is neutral when fully booked', () => {
    expect(monthAvailabilityLine(0)).toEqual({ text: 'Fully booked', tone: 'neutral' })
  })
})

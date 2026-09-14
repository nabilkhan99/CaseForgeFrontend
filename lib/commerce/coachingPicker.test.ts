import { describe, expect, it } from 'vitest'
import {
  cutoffCountdownLabel,
  hasOpenSlot,
  isSelectionOpen,
  openSlotOrder,
  parseCoachingSlots,
  selectionKey,
  slotAriaLabel,
  slotOptionParts,
  stepSelection,
  type CoachingSlotSelection,
} from './coachingPicker'
import { groupSlotsByMonth, type CoachingSlotAvailability } from './coachingSlots'

const slot = (
  day: string,
  s: CoachingSlotAvailability['slot'],
  status: CoachingSlotAvailability['status'] = 'open',
): CoachingSlotAvailability => ({ day, slot: s, status, cutoff_at: `${day}T00:00:00+01:00` })

const HOUR = 60 * 60 * 1000

describe('slot option copy', () => {
  it('names an open slot with its time range', () => {
    expect(slotOptionParts(slot('2026-10-03', 'morning'))).toEqual({
      name: 'Morning',
      detail: '09:00 to 12:00',
    })
    expect(slotOptionParts(slot('2026-10-03', 'afternoon'))).toEqual({
      name: 'Afternoon',
      detail: '13:00 to 16:00',
    })
  })

  it('marks a booked slot sold out and a closed one closed', () => {
    expect(slotOptionParts(slot('2026-10-04', 'morning', 'booked'))).toEqual({
      name: 'Morning',
      detail: 'SOLD OUT',
    })
    expect(slotOptionParts(slot('2026-10-04', 'afternoon', 'closed')).detail).toBe('Closed')
  })

  it('gives each radio a name that carries its date', () => {
    expect(slotAriaLabel(slot('2026-10-03', 'morning'))).toBe('Saturday 3 October 2026, Morning, 09:00 to 12:00')
    expect(slotAriaLabel(slot('2026-10-04', 'morning', 'booked'))).toBe('Sunday 4 October 2026, Morning, sold out')
    expect(slotAriaLabel(slot('2026-10-04', 'afternoon', 'closed'))).toBe(
      'Sunday 4 October 2026, Afternoon, bookings closed',
    )
  })

  it('never uses a dash', () => {
    const strings = [
      cutoffCountdownLabel('2026-10-03T00:00:00Z', Date.parse('2026-10-02T10:00:00Z')),
      slotAriaLabel(slot('2026-10-03', 'afternoon', 'booked')),
      ...Object.values(slotOptionParts(slot('2026-10-03', 'afternoon'))),
    ]
    for (const s of strings) expect(s).not.toMatch(/[–—]/)
  })
})

describe('cutoffCountdownLabel', () => {
  const cutoff = '2026-10-03T00:00:00Z'
  const cutoffMs = Date.parse(cutoff)

  it('counts down inside the final 72 hours', () => {
    expect(cutoffCountdownLabel(cutoff, cutoffMs - (5 * HOUR + 7 * 60 * 1000))).toBe('Closes in 5h 7m')
    expect(cutoffCountdownLabel(cutoff, cutoffMs - 72 * HOUR)).toBe('Closes in 72h 0m')
  })

  it('stays quiet outside the window, after the cut-off, or for a bad timestamp', () => {
    expect(cutoffCountdownLabel(cutoff, cutoffMs - 72 * HOUR - 1)).toBeNull()
    expect(cutoffCountdownLabel(cutoff, cutoffMs)).toBeNull()
    expect(cutoffCountdownLabel('not a date', cutoffMs)).toBeNull()
  })
})

describe('selection state', () => {
  const slots = [
    slot('2026-10-03', 'morning'),
    slot('2026-10-03', 'afternoon', 'booked'),
    slot('2026-10-04', 'morning', 'closed'),
    slot('2026-10-04', 'afternoon'),
  ]

  it('knows whether a selection is still bookable', () => {
    expect(isSelectionOpen(slots, { day: '2026-10-03', slot: 'morning' })).toBe(true)
    expect(isSelectionOpen(slots, { day: '2026-10-03', slot: 'afternoon' })).toBe(false)
    expect(isSelectionOpen(slots, { day: '2026-10-09', slot: 'morning' })).toBe(false)
    expect(isSelectionOpen(null, { day: '2026-10-03', slot: 'morning' })).toBe(false)
    expect(isSelectionOpen(slots, null)).toBe(false)
  })

  it('knows whether anything at all can be booked', () => {
    expect(hasOpenSlot(slots)).toBe(true)
    expect(hasOpenSlot([slot('2026-10-03', 'morning', 'booked')])).toBe(false)
    expect(hasOpenSlot(null)).toBe(false)
  })

  it('keys a selection by date and slot', () => {
    expect(selectionKey({ day: '2026-10-03', slot: 'afternoon' })).toBe('2026-10-03:afternoon')
  })
})

describe('keyboard order', () => {
  const months = groupSlotsByMonth([
    slot('2026-11-07', 'afternoon'),
    slot('2026-10-03', 'morning'),
    slot('2026-10-03', 'afternoon', 'booked'),
    slot('2026-11-07', 'morning', 'booked'),
    slot('2026-10-04', 'morning'),
  ])
  const order = openSlotOrder(months)
  const at = (i: number): CoachingSlotSelection => order[i]

  it('lists only open slots, chronologically', () => {
    expect(order.map(selectionKey)).toEqual(['2026-10-03:morning', '2026-10-04:morning', '2026-11-07:afternoon'])
  })

  it('steps forward and back, wrapping at the ends', () => {
    expect(stepSelection(order, at(0), 1)).toEqual(at(1))
    expect(stepSelection(order, at(2), 1)).toEqual(at(0))
    expect(stepSelection(order, at(0), -1)).toEqual(at(2))
  })

  it('jumps to the first and last open slot', () => {
    expect(stepSelection(order, at(1), 'first')).toEqual(at(0))
    expect(stepSelection(order, at(1), 'last')).toEqual(at(2))
  })

  it('starts from the ends when nothing usable is selected', () => {
    expect(stepSelection(order, null, 1)).toEqual(at(0))
    expect(stepSelection(order, null, -1)).toEqual(at(2))
    expect(stepSelection(order, { day: '2026-10-03', slot: 'afternoon' }, 1)).toEqual(at(0))
  })

  it('has nowhere to go when nothing is open', () => {
    expect(stepSelection([], null, 1)).toBeNull()
  })
})

describe('parseCoachingSlots', () => {
  it('keeps well formed rows', () => {
    const rows = [slot('2026-10-03', 'morning'), slot('2026-10-03', 'afternoon', 'booked')]
    expect(parseCoachingSlots(rows)).toEqual(rows)
  })

  it('drops rows that do not match the contract', () => {
    const good = slot('2026-10-03', 'morning')
    expect(
      parseCoachingSlots([
        good,
        { ...good, slot: 'evening' },
        { ...good, day: '3 Oct' },
        { ...good, status: 'sold_out' },
        { ...good, cutoff_at: 42 },
        null,
        'row',
      ]),
    ).toEqual([good])
  })

  it('refuses a payload that is not a list', () => {
    expect(() => parseCoachingSlots(undefined)).toThrow()
    expect(() => parseCoachingSlots({ slots: [] })).toThrow()
  })
})

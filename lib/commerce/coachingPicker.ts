/**
 * Pure state and copy for the coaching session picker.
 *
 * The picker component renders; this file decides. Kept apart so the rules a
 * buyer relies on (which slot is still bookable, what a sold out slot says,
 * where the arrow keys go) are tested without a DOM, and so the booking page
 * and the dashboard picker cannot drift. Builds on the shared contract in
 * `coachingSlots.ts` and never redefines it.
 *
 * Copy rules: UK English, no em or en dashes.
 */

import {
  COACHING_SLOTS,
  formatCoachingDate,
  isCoachingSlotKey,
  isIsoDate,
  slotTimeRange,
  type CoachingMonthGroup,
  type CoachingSlotAvailability,
  type CoachingSlotKey,
} from './coachingSlots'

/** What the buyer has picked: a coaching date and one of its two slots. */
export interface CoachingSlotSelection {
  day: string
  slot: CoachingSlotKey
}

/** "2026-10-03:morning", for React keys and element lookups. */
export function selectionKey(selection: CoachingSlotSelection): string {
  return `${selection.day}:${selection.slot}`
}

/** Only the final stretch before a cut-off earns a countdown. */
export const COUNTDOWN_WINDOW_MS = 72 * 60 * 60 * 1000

/** "Closes in 5h 7m" inside the final 72 hours before the cut-off, otherwise null. */
export function cutoffCountdownLabel(cutoffAt: string, now: number): string | null {
  const cutoffMs = Date.parse(cutoffAt)
  if (Number.isNaN(cutoffMs)) return null
  const remaining = cutoffMs - now
  if (remaining <= 0 || remaining > COUNTDOWN_WINDOW_MS) return null
  const hours = Math.floor(remaining / (60 * 60 * 1000))
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
  return `Closes in ${hours}h ${minutes}m`
}

export interface SlotOptionParts {
  /** "Morning" */
  name: string
  /** "09:00 to 12:00", "SOLD OUT" or "Closed" */
  detail: string
}

/** The two halves of a slot option, rendered as "Morning · 09:00 to 12:00". */
export function slotOptionParts(slot: CoachingSlotAvailability): SlotOptionParts {
  const name = COACHING_SLOTS[slot.slot].name
  if (slot.status === 'booked') return { name, detail: 'SOLD OUT' }
  if (slot.status === 'closed') return { name, detail: 'Closed' }
  return { name, detail: slotTimeRange(slot.slot) }
}

/**
 * The radio's accessible name. Carries the full date, because a screen reader
 * announces each radio on its own, away from the date row it sits in.
 */
export function slotAriaLabel(slot: CoachingSlotAvailability): string {
  const name = COACHING_SLOTS[slot.slot].name
  const state =
    slot.status === 'booked'
      ? 'sold out'
      : slot.status === 'closed'
        ? 'bookings closed'
        : slotTimeRange(slot.slot)
  return `${formatCoachingDate(slot.day)}, ${name}, ${state}`
}

/** True when the selection names a slot that can still be booked. */
export function isSelectionOpen(
  slots: readonly CoachingSlotAvailability[] | null,
  selection: CoachingSlotSelection | null,
): boolean {
  if (!slots || !selection) return false
  return slots.some((s) => s.day === selection.day && s.slot === selection.slot && s.status === 'open')
}

/** True when at least one slot can be booked, i.e. a continue button is worth showing. */
export function hasOpenSlot(slots: readonly CoachingSlotAvailability[] | null): boolean {
  return (slots ?? []).some((s) => s.status === 'open')
}

/** Every open slot, in the order the picker shows them. The arrow keys walk this list. */
export function openSlotOrder(months: readonly CoachingMonthGroup[]): CoachingSlotSelection[] {
  return months.flatMap((month) =>
    month.dates.flatMap((date) =>
      date.slots.filter((s) => s.status === 'open').map((s) => ({ day: s.day, slot: s.slot })),
    ),
  )
}

export type SelectionStep = 1 | -1 | 'first' | 'last'

/**
 * Where a radio group arrow key lands: the next or previous open slot,
 * wrapping at the ends, as the ARIA radio group pattern expects. With no
 * usable current selection, forward starts at the first slot and back at the
 * last.
 */
export function stepSelection(
  order: readonly CoachingSlotSelection[],
  current: CoachingSlotSelection | null,
  step: SelectionStep,
): CoachingSlotSelection | null {
  if (order.length === 0) return null
  if (step === 'first') return order[0]
  if (step === 'last') return order[order.length - 1]
  const index = current
    ? order.findIndex((s) => s.day === current.day && s.slot === current.slot)
    : -1
  if (index === -1) return step === 1 ? order[0] : order[order.length - 1]
  return order[(index + step + order.length) % order.length]
}

const SLOT_STATUSES: ReadonlySet<string> = new Set(['open', 'booked', 'closed'])

function isSlotRow(value: unknown): value is CoachingSlotAvailability {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return (
    isIsoDate(row.day) &&
    isCoachingSlotKey(row.slot) &&
    typeof row.status === 'string' &&
    SLOT_STATUSES.has(row.status) &&
    typeof row.cutoff_at === 'string'
  )
}

/**
 * Validates the `slots` array from `GET /api/coaching-sessions`. A payload that
 * is not a list is a failed load and throws; a malformed row inside a good
 * list is dropped rather than rendered as something a buyer could pick.
 */
export function parseCoachingSlots(value: unknown): CoachingSlotAvailability[] {
  if (!Array.isArray(value)) throw new Error('Coaching sessions payload has no slots list')
  return value.filter(isSlotRow).map((row) => ({
    day: row.day,
    slot: row.slot,
    status: row.status,
    cutoff_at: row.cutoff_at,
  }))
}

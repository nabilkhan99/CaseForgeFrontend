/**
 * The one to one coaching session: the shared contract for how a booking is
 * described, grouped and counted.
 *
 * Complete comes with one 3 hour one to one coaching session. Every configured
 * coaching date (`coaching_days`) splits into two slots, and each slot takes
 * exactly one booking. The database view `coaching_slot_availability` is the
 * live source of slot state; everything in this file is pure presentation over
 * that state, so the booking page, the dashboard picker, checkout, the webhook,
 * receipts and emails all describe a session in the same words.
 *
 * Copy rules for anything built from these strings: UK English, no em or en
 * dashes, and never a reference to the old small group format.
 */

export type CoachingSlotKey = 'morning' | 'afternoon'

export interface CoachingSlotDefinition {
  key: CoachingSlotKey
  /** "Morning" */
  name: string
  /** "09:00" (Europe/London) */
  start: string
  /** "12:00" (Europe/London) */
  end: string
}

export const COACHING_SLOTS: Readonly<Record<CoachingSlotKey, CoachingSlotDefinition>> = Object.freeze({
  morning: Object.freeze({ key: 'morning', name: 'Morning', start: '09:00', end: '12:00' }),
  afternoon: Object.freeze({ key: 'afternoon', name: 'Afternoon', start: '13:00', end: '16:00' }),
})

/** Display order within a date. */
export const COACHING_SLOT_ORDER: readonly CoachingSlotKey[] = ['morning', 'afternoon']

/** Length of the session, for copy. */
export const COACHING_SESSION_HOURS = 3

/** Taught hours across the Complete course: 8.5 lecture hours plus the 3 hour session. */
export const COMPLETE_TOTAL_TAUGHT_HOURS = '11.5'

export function isCoachingSlotKey(value: unknown): value is CoachingSlotKey {
  return value === 'morning' || value === 'afternoon'
}

/** True for a well-formed ISO calendar date, e.g. "2026-11-07". */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** "09:00 to 12:00" */
export function slotTimeRange(slot: CoachingSlotKey): string {
  const def = COACHING_SLOTS[slot]
  return `${def.start} to ${def.end}`
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

interface DateParts {
  year: number
  monthIndex: number
  day: number
  weekdayIndex: number
}

/**
 * Parts of a calendar date. Computed in UTC from the ISO string so the
 * weekday never shifts with the server's or the browser's time zone: a
 * coaching date is a calendar date in London, not an instant.
 */
function dateParts(dayIso: string): DateParts {
  const [y, m, d] = dayIso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return { year: y, monthIndex: m - 1, day: d, weekdayIndex: date.getUTCDay() }
}

/** "Saturday 7 November 2026" */
export function formatCoachingDate(dayIso: string): string {
  const p = dateParts(dayIso)
  return `${WEEKDAYS[p.weekdayIndex]} ${p.day} ${MONTHS[p.monthIndex]} ${p.year}`
}

/** "Saturday 7 November" */
export function formatCoachingDateNoYear(dayIso: string): string {
  const p = dateParts(dayIso)
  return `${WEEKDAYS[p.weekdayIndex]} ${p.day} ${MONTHS[p.monthIndex]}`
}

/** "Sat 7 Nov", for the compact picker rows. */
export function formatCoachingDateCompact(dayIso: string): string {
  const p = dateParts(dayIso)
  return `${WEEKDAYS[p.weekdayIndex].slice(0, 3)} ${p.day} ${MONTHS[p.monthIndex].slice(0, 3)}`
}

/**
 * The full description of a booked session, used on receipts, in the
 * confirmation email, on the dashboard and in Stripe metadata:
 * "Saturday 7 November 2026, 09:00 to 12:00".
 */
export function coachingSessionLabel(dayIso: string, slot: CoachingSlotKey): string {
  return `${formatCoachingDate(dayIso)}, ${slotTimeRange(slot)}`
}

/**
 * The line shown on Stripe's payment page before the customer pays:
 * "Coaching session: Saturday 7 November, 09:00 to 12:00".
 */
export function coachingSessionCheckoutLine(dayIso: string, slot: CoachingSlotKey): string {
  return `Coaching session: ${formatCoachingDateNoYear(dayIso)}, ${slotTimeRange(slot)}`
}

/** The coaching session a Stripe Checkout Session was for, read off its metadata. */
export interface CoachingSessionMetadata {
  /** ISO date, or null when absent or malformed. */
  date: string | null
  /** Null when absent, unknown, or on a session opened before slots existed. */
  slot: CoachingSlotKey | null
  /** "Saturday 7 November 2026, 09:00 to 12:00"; the date alone on an older session. */
  label: string | null
}

/**
 * Reads the coaching session off Stripe Checkout metadata. Checkout writes
 * `coaching_date`, `coaching_slot` and `coaching_session_label`; sessions
 * created before one to one sessions carry `coaching_day` and
 * `coaching_day_label`, so both spellings are accepted. Server-side readers
 * (webhook, thanks page, admin) share this so they cannot disagree.
 */
export function readCoachingSessionMetadata(
  metadata: Readonly<Record<string, string | undefined>> | null | undefined,
): CoachingSessionMetadata {
  const rawDate = metadata?.coaching_date ?? metadata?.coaching_day ?? null
  const date = isIsoDate(rawDate) ? rawDate : null
  const rawSlot = metadata?.coaching_slot
  const slot = isCoachingSlotKey(rawSlot) ? rawSlot : null
  const label =
    metadata?.coaching_session_label ??
    (date && slot ? coachingSessionLabel(date, slot) : null) ??
    metadata?.coaching_day_label ??
    null
  return { date, slot, label }
}

/** One row of `coaching_slot_availability`, as `GET /api/coaching-sessions` returns it. */
export interface CoachingSlotAvailability {
  /** ISO date, e.g. "2026-11-07" */
  day: string
  slot: CoachingSlotKey
  /**
   * open: selectable. booked: taken by a paid booking or a live checkout hold.
   * closed: bookings for the date have closed (cut-off passed, or the date was
   * closed by hand).
   */
  status: 'open' | 'booked' | 'closed'
  /** When bookings for the date close: midnight (Europe/London) the day before. */
  cutoff_at: string
}

export type CoachingDateStatus = 'open' | 'sold_out' | 'closed'

export interface CoachingDateGroup {
  day: string
  slots: CoachingSlotAvailability[]
  /**
   * open: at least one slot can be booked. sold_out: every slot is booked.
   * closed: nothing can be booked and at least one slot is closed rather than
   * booked.
   */
  status: CoachingDateStatus
  cutoffAt: string
}

export interface CoachingMonthGroup {
  /** "2026-10" */
  monthKey: string
  /** "October", or "January 2027" when the month is not in the first group's year. */
  monthLabel: string
  dates: CoachingDateGroup[]
  /** Open slots in this month only. Derived from slot state, never a constant. */
  slotsLeft: number
}

function dateStatus(slots: readonly CoachingSlotAvailability[]): CoachingDateStatus {
  if (slots.some((s) => s.status === 'open')) return 'open'
  if (slots.length > 0 && slots.every((s) => s.status === 'booked')) return 'sold_out'
  return 'closed'
}

function slotOrder(slot: CoachingSlotKey): number {
  return COACHING_SLOT_ORDER.indexOf(slot)
}

/**
 * Groups live slot state into month blocks, each with its own count of open
 * slots. Input order does not matter; output is chronological.
 */
export function groupSlotsByMonth(slots: readonly CoachingSlotAvailability[]): CoachingMonthGroup[] {
  const sorted = [...slots].sort((a, b) =>
    a.day === b.day ? slotOrder(a.slot) - slotOrder(b.slot) : a.day < b.day ? -1 : 1,
  )

  const byDay = new Map<string, CoachingSlotAvailability[]>()
  for (const slot of sorted) {
    byDay.set(slot.day, [...(byDay.get(slot.day) ?? []), slot])
  }

  const byMonth = new Map<string, CoachingDateGroup[]>()
  for (const [day, daySlots] of byDay) {
    const group: CoachingDateGroup = {
      day,
      slots: daySlots,
      status: dateStatus(daySlots),
      cutoffAt: daySlots[0].cutoff_at,
    }
    const monthKey = day.slice(0, 7)
    byMonth.set(monthKey, [...(byMonth.get(monthKey) ?? []), group])
  }

  const firstYear = sorted.length > 0 ? dateParts(sorted[0].day).year : null
  return [...byMonth.entries()].map(([monthKey, dates]) => {
    const p = dateParts(`${monthKey}-01`)
    const monthName = MONTHS[p.monthIndex]
    return {
      monthKey,
      monthLabel: p.year === firstYear ? monthName : `${monthName} ${p.year}`,
      dates,
      slotsLeft: dates.reduce((n, d) => n + d.slots.filter((s) => s.status === 'open').length, 0),
    }
  })
}

export interface MonthAvailabilityLine {
  text: string
  /** standard: 3 or more left. urgent: 1 or 2 left. neutral: none left. */
  tone: 'standard' | 'urgent' | 'neutral'
}

/** The per-month availability indicator. */
export function monthAvailabilityLine(slotsLeft: number): MonthAvailabilityLine {
  if (slotsLeft <= 0) return { text: 'Fully booked', tone: 'neutral' }
  const text = slotsLeft === 1 ? 'Only 1 slot left' : `Only ${slotsLeft} slots left`
  return { text, tone: slotsLeft <= 2 ? 'urgent' : 'standard' }
}

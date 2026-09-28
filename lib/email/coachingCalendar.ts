import { COACHING_SLOTS, isIsoDate, type CoachingSlotKey } from '@/lib/commerce/coachingSlots'
import { BRAND } from './chrome'

/**
 * The calendar invite (.ics) attached to the coaching session confirmation.
 *
 * Hand-built rather than a library: one VEVENT is a few lines of RFC 5545, and
 * the parts that actually go wrong (the London offset either side of the clocks
 * changing, line folding, TEXT escaping) are exactly the parts pinned by tests.
 *
 * Times are emitted in UTC (`...Z`) rather than with a TZID. A TZID needs a
 * matching VTIMEZONE block, which Outlook in particular is fussy about; a UTC
 * instant is imported identically everywhere and shown in the reader's zone.
 */

const TIME_ZONE = 'Europe/London'
const MINUTE_MS = 60_000

/** One formatter, reused: constructing Intl formatters is not free. */
const LONDON_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** London's offset from UTC at `instantMs`, in milliseconds (BST = +3 600 000). */
function londonOffsetMs(instantMs: number): number {
  const parts: Record<string, number> = {}
  for (const part of LONDON_PARTS.formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  // Offsets are whole minutes; drop the sub-second remainder of the instant.
  return Math.round((wallAsUtc - instantMs) / MINUTE_MS) * MINUTE_MS
}

/**
 * The instant at which it is `hhmm` on `dayIso` in London.
 *
 * Treats the wall time as if it were UTC, subtracts London's offset at that
 * guess, then re-checks the offset at the result (the second pass only matters
 * within an hour of a clock change, which no coaching slot is near, but it
 * keeps the function honest for any time of day).
 *
 * Throws RangeError on a malformed date or time: a calendar invite for the
 * wrong instant is worse than no invite.
 */
export function londonWallTimeToUtc(dayIso: string, hhmm: string): Date {
  if (!isIsoDate(dayIso)) throw new RangeError(`Not an ISO date: ${dayIso}`)
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!time) throw new RangeError(`Not an HH:MM time: ${hhmm}`)

  const [y, m, d] = dayIso.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, Number(time[1]), Number(time[2]))
  const first = guess - londonOffsetMs(guess)
  const offsetAtResult = londonOffsetMs(first)
  return new Date(guess - offsetAtResult)
}

/** `20261004T080000Z` */
function icsUtc(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '')
}

/** RFC 5545 section 3.3.11: backslash, semicolon, comma and newline escaped. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const MAX_LINE_OCTETS = 75

/**
 * RFC 5545 section 3.1: lines longer than 75 octets are split, and each
 * continuation starts with one space (which counts towards its 75). Counted in
 * UTF-8 octets, and split only between code points, never inside one.
 */
function foldLine(line: string): string {
  const out: string[] = []
  let current = ''
  let currentOctets = 0
  for (const char of line) {
    const octets = Buffer.byteLength(char, 'utf8')
    if (currentOctets + octets > MAX_LINE_OCTETS) {
      out.push(current)
      current = ' '
      currentOctets = 1
    }
    current += char
    currentOctets += octets
  }
  out.push(current)
  return out.join('\r\n')
}

export interface CoachingIcsArgs {
  orderId: string
  /** ISO date of the session, e.g. "2026-10-04". */
  day: string
  slot: CoachingSlotKey
  /** How the coach is named to the student, e.g. "Dr Hassan Khan". */
  coachName: string
  /** The video call link; must already have passed `parseMeetingUrl`. */
  meetingUrl: string
  /** DTSTAMP; defaults to the current time. */
  now?: Date
}

/**
 * The .ics file for one booked session.
 *
 * The UID depends on the order alone, so a resend (a changed link, a new coach)
 * lands on the same calendar entry rather than a second one beside it.
 */
export function buildCoachingIcs({ orderId, day, slot, coachName, meetingUrl, now }: CoachingIcsArgs): string {
  const definition = COACHING_SLOTS[slot]
  const start = londonWallTimeToUtc(day, definition.start)
  const end = londonWallTimeToUtc(day, definition.end)

  const description = [
    `3 hour one to one coaching session with ${coachName}.`,
    `Join the session: ${meetingUrl}`,
  ].join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Fourteen Fisherman//Coaching//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:coaching-${orderId}@fourteenfisherman.com`,
    `DTSTAMP:${icsUtc(now ?? new Date())}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${escapeText(`SCA coaching session with ${coachName}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(meetingUrl)}`,
    // URL is a URI value, not TEXT, so it is not backslash-escaped.
    `URL:${meetingUrl}`,
    `ORGANIZER;CN=${BRAND.senderName}:mailto:${BRAND.senderEmail}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(`SCA coaching session with ${coachName} starts in 30 minutes`)}`,
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

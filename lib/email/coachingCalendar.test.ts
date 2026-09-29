import { describe, expect, it } from 'vitest'
import { buildCoachingIcs, londonWallTimeToUtc } from './coachingCalendar'

/**
 * The calendar invite attached to the coaching confirmation email.
 *
 * Pinned hardest: the session lands at the right instant on both sides of the
 * clocks going back (4 Oct is BST, 7 Nov is GMT), and the file is valid enough
 * RFC 5545 that Outlook, Gmail and Apple Calendar all import it.
 */

const ORDER_ID = '4b082b91-3db7-4a79-99c3-c7ed5c507e45'
const NOW = new Date('2026-09-28T14:05:09.123Z')

const BASE = {
  orderId: ORDER_ID,
  day: '2026-10-04',
  slot: 'morning' as const,
  coachName: 'Dr Hassan Khan',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
  now: NOW,
}

/** RFC 5545 section 3.1: a CRLF followed by one space or tab is removed. */
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, '')
}

function lines(ics: string): string[] {
  return unfold(ics).split('\r\n')
}

function property(ics: string, name: string): string | undefined {
  return lines(ics).find((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`))
}

describe('londonWallTimeToUtc', () => {
  it('reads a British Summer Time date as UTC+1', () => {
    expect(londonWallTimeToUtc('2026-10-04', '09:00').toISOString()).toBe('2026-10-04T08:00:00.000Z')
  })

  it('reads a Greenwich Mean Time date as UTC+0', () => {
    expect(londonWallTimeToUtc('2026-11-07', '09:00').toISOString()).toBe('2026-11-07T09:00:00.000Z')
  })

  it('switches on the right side of the clock changes', () => {
    // Clocks go back 01:00 UTC on Sunday 25 Oct 2026, forward on Sunday 29 Mar 2026.
    expect(londonWallTimeToUtc('2026-10-24', '13:00').toISOString()).toBe('2026-10-24T12:00:00.000Z')
    expect(londonWallTimeToUtc('2026-10-25', '13:00').toISOString()).toBe('2026-10-25T13:00:00.000Z')
    expect(londonWallTimeToUtc('2026-03-28', '09:00').toISOString()).toBe('2026-03-28T09:00:00.000Z')
    expect(londonWallTimeToUtc('2026-03-29', '09:00').toISOString()).toBe('2026-03-29T08:00:00.000Z')
  })

  it('handles minutes and the end of the day', () => {
    expect(londonWallTimeToUtc('2026-07-01', '23:30').toISOString()).toBe('2026-07-01T22:30:00.000Z')
    expect(londonWallTimeToUtc('2026-12-31', '00:15').toISOString()).toBe('2026-12-31T00:15:00.000Z')
  })

  it.each([
    ['2026-02-30', '09:00'],
    ['4 Oct 2026', '09:00'],
    ['2026-10-04', '9:00'],
    ['2026-10-04', '24:00'],
    ['2026-10-04', '09:60'],
  ])('refuses %s %s rather than inventing an instant', (day, time) => {
    expect(() => londonWallTimeToUtc(day, time)).toThrow(RangeError)
  })
})

describe('buildCoachingIcs: structure', () => {
  const ics = buildCoachingIcs(BASE)

  it('uses CRLF line endings throughout and ends with one', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('carries the calendar header', () => {
    const all = lines(ics)
    expect(all[0]).toBe('BEGIN:VCALENDAR')
    expect(all).toContain('PRODID:-//Fourteen Fisherman//Coaching//EN')
    expect(all).toContain('VERSION:2.0')
    expect(all).toContain('CALSCALE:GREGORIAN')
    expect(all).toContain('METHOD:PUBLISH')
  })

  it('has exactly one event with a reminder 30 minutes before', () => {
    const all = lines(ics)
    expect(all.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1)
    expect(all.filter((l) => l === 'END:VEVENT')).toHaveLength(1)
    const alarmStart = all.indexOf('BEGIN:VALARM')
    const alarmEnd = all.indexOf('END:VALARM')
    expect(alarmStart).toBeGreaterThan(all.indexOf('BEGIN:VEVENT'))
    expect(alarmEnd).toBeLessThan(all.indexOf('END:VEVENT'))
    const alarm = all.slice(alarmStart, alarmEnd)
    expect(alarm).toContain('ACTION:DISPLAY')
    expect(alarm).toContain('TRIGGER:-PT30M')
    expect(alarm.some((l) => l.startsWith('DESCRIPTION:'))).toBe(true)
  })

  it('stamps DTSTAMP with the build time in UTC, to the second', () => {
    expect(property(ics, 'DTSTAMP')).toBe('DTSTAMP:20260928T140509Z')
  })

  it('names the coach, the link and the organiser', () => {
    expect(property(ics, 'SUMMARY')).toBe('SUMMARY:SCA coaching session with Dr Hassan Khan')
    expect(property(ics, 'LOCATION')).toBe('LOCATION:https://meet.google.com/abc-defg-hij')
    expect(property(ics, 'URL')).toBe('URL:https://meet.google.com/abc-defg-hij')
    expect(property(ics, 'ORGANIZER')).toBe(
      'ORGANIZER;CN=Fourteen Fisherman:mailto:hello@fourteenfisherman.com',
    )
  })

  it('describes a 3 hour one to one session and carries the join link', () => {
    const description = property(ics, 'DESCRIPTION')
    expect(description).toContain('3 hour one to one coaching session')
    expect(description).toContain('https://meet.google.com/abc-defg-hij')
  })

  it('never uses an em or en dash', () => {
    expect(ics).not.toMatch(/[–—]/)
  })
})

describe('buildCoachingIcs: times', () => {
  it.each([
    ['2026-10-04', 'morning', '20261004T080000Z', '20261004T110000Z'],
    ['2026-10-04', 'afternoon', '20261004T120000Z', '20261004T150000Z'],
    ['2026-11-07', 'morning', '20261107T090000Z', '20261107T120000Z'],
    ['2026-11-07', 'afternoon', '20261107T130000Z', '20261107T160000Z'],
  ] as const)('%s %s runs %s to %s', (day, slot, start, end) => {
    const ics = buildCoachingIcs({ ...BASE, day, slot })
    expect(property(ics, 'DTSTART')).toBe(`DTSTART:${start}`)
    expect(property(ics, 'DTEND')).toBe(`DTEND:${end}`)
  })
})

describe('buildCoachingIcs: UID', () => {
  it('is derived from the order alone, so a resend updates rather than duplicates', () => {
    const first = buildCoachingIcs(BASE)
    const resend = buildCoachingIcs({
      ...BASE,
      coachName: 'Dr Someone Else',
      meetingUrl: 'https://zoom.us/j/123',
      now: new Date('2026-10-01T10:00:00Z'),
    })
    expect(property(first, 'UID')).toBe(`UID:coaching-${ORDER_ID}@fourteenfisherman.com`)
    expect(property(resend, 'UID')).toBe(property(first, 'UID'))
  })
})

describe('buildCoachingIcs: escaping and folding', () => {
  it('escapes commas, semicolons and backslashes in TEXT values', () => {
    const ics = buildCoachingIcs({ ...BASE, coachName: 'Khan, Hassan; MRCGP \\ GP' })
    expect(property(ics, 'SUMMARY')).toBe('SUMMARY:SCA coaching session with Khan\\, Hassan\\; MRCGP \\\\ GP')
  })

  it('escapes the newlines in the description rather than breaking the line', () => {
    const description = property(buildCoachingIcs(BASE), 'DESCRIPTION') ?? ''
    expect(description).toContain('\\n')
  })

  it('folds a long link so no line exceeds 75 octets, and unfolds back to the original', () => {
    const longUrl = `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${'N'.repeat(180)}%40thread.v2/0?context=%7b%22Tid%22%3a%22abc%22%7d`
    const ics = buildCoachingIcs({ ...BASE, meetingUrl: longUrl })
    const physical = ics.split('\r\n')
    for (const line of physical) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
    }
    expect(physical.some((line) => line.startsWith(' '))).toBe(true)
    expect(property(ics, 'URL')).toBe(`URL:${longUrl}`)
  })

  it('never splits a multi-byte character across a fold', () => {
    const coachName = `Dr ${'Ł'.repeat(20)}😀${'Ł'.repeat(40)} Évora`
    const ics = buildCoachingIcs({ ...BASE, coachName })
    for (const line of ics.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
      // A split character (or a split surrogate pair) would decode to U+FFFD.
      expect(Buffer.from(line, 'utf8').toString('utf8')).not.toContain('�')
    }
    expect(property(ics, 'SUMMARY')).toBe(`SUMMARY:SCA coaching session with ${coachName}`)
  })
})

/**
 * London wall-clock helpers for the call log. Callers think in UK time ("ring
 * Tuesday after clinic"), the database stores instants, and these are the only
 * places the two meet. Self-contained and browser-safe: the admin page uses
 * the same rules to preview a next action before it is saved.
 */

const MINUTE_MS = 60_000

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const PARTS_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Today's calendar date in London, as YYYY-MM-DD. */
export function londonToday(now: Date = new Date()): string {
  return DAY_FORMAT.format(now)
}

/** London's offset from UTC at `instantMs`, in milliseconds (BST = +3 600 000). */
function londonOffsetMs(instantMs: number): number {
  const parts: Record<string, number> = {}
  for (const part of PARTS_FORMAT.formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.round((wallAsUtc - instantMs) / MINUTE_MS) * MINUTE_MS
}

/**
 * The instant at which it is `hhmm` on `dayIso` in London. Guesses with the
 * offset at the wall time read as UTC, then re-checks the offset at the result,
 * which keeps it right on the days the clocks change.
 */
export function londonWallTimeToUtc(dayIso: string, hhmm: string): Date {
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayIso) || !time) throw new RangeError(`Not a London day and time: ${dayIso} ${hhmm}`)
  const [y, m, d] = dayIso.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, Number(time[1]), Number(time[2]))
  const first = guess - londonOffsetMs(guess)
  return new Date(guess - londonOffsetMs(first))
}

const HOUR_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** HH:MM in London at `instant`. */
export function londonTime(instant: Date): string {
  return HOUR_FORMAT.format(instant)
}

/** The London hour (0-23) at `instant`. */
export function londonHour(instant: Date): number {
  return Number(londonTime(instant).slice(0, 2))
}

/** `dayIso` plus `days` calendar days, as YYYY-MM-DD. */
export function addDays(dayIso: string, days: number): string {
  const [y, m, d] = dayIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** "Tue 6 Oct 2026" for a YYYY-MM-DD date. */
export function dayLabel(dayIso: string): string {
  const [y, m, d] = dayIso.split('-').map(Number)
  return WEEKDAY_FORMAT.format(new Date(Date.UTC(y, m - 1, d))).replace(/,/g, '')
}

/** "Tue 6 Oct" for a YYYY-MM-DD date. */
export function shortDayLabel(dayIso: string): string {
  return dayLabel(dayIso).replace(/ \d{4}$/, '')
}

/** "Tue 6 Oct" for the London day of `instant`. */
export function londonDayLabel(instant: Date): string {
  return shortDayLabel(londonToday(instant))
}

/** The first Monday on or after `dayIso`. */
export function mondayOnOrAfter(dayIso: string): string {
  const [y, m, d] = dayIso.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return addDays(dayIso, (8 - weekday) % 7)
}

/** The first day of the month `offset` months after the month of `dayIso`, as YYYY-MM-DD. */
export function monthStart(dayIso: string, offset: number): string {
  const [y, m] = dayIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10)
}

/** The instant it is `hhmm` on the London day `days` after the day of `from`. */
export function londonAt(from: Date, days: number, hhmm: string): Date {
  return londonWallTimeToUtc(addDays(londonToday(from), days), hhmm)
}

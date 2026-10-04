/**
 * When a lead sits the SCA, and how soon that is: the biggest single input to
 * how hot they are. Ported from the customer-lead-report skill so the page and
 * the report agree.
 *
 * Three sources, best first: a date or month the lead told us on a call, the
 * exact date on their profile, and the month they picked on the old trial form
 * (`trial_leads.sca_sitting`, e.g. `oct_2026`, `early_2027`, `not_sure`).
 */

export type ExamClass = 'now' | 'prime' | 'soon' | 'far' | 'sat' | 'unknown'

export interface ExamTiming {
  label: string
  cls: ExamClass
  /** Days until an exact exam date; null when only a month is known. */
  days: number | null
  /** The exact date, YYYY-MM-DD, when known. */
  date: string | null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const SEASON_MONTH: Record<string, number> = { early: 2, mid: 6, late: 11, later: 6 }

const EXACT_LABEL = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })

const NOT_GIVEN: ExamTiming = { label: 'Not given', cls: 'unknown', days: null, date: null }

function utc(dayIso: string): Date {
  return new Date(`${dayIso}T00:00:00Z`)
}

function daysFrom(today: string, dayIso: string): number {
  return Math.round((utc(dayIso).getTime() - utc(today).getTime()) / 86_400_000)
}

/** An exact exam date: "now" within a fortnight, "prime" within ten weeks. */
export function examFromDate(today: string, dayIso: string): ExamTiming {
  const days = daysFrom(today, dayIso)
  const label = EXACT_LABEL.format(utc(dayIso))
  if (days < 0) return { label: `${label} (sat)`, cls: 'sat', days, date: dayIso }
  if (days <= 14) return { label: `${label} · ${days}d`, cls: 'now', days, date: dayIso }
  if (days <= 70) return { label: `${label} · ${days}d`, cls: 'prime', days, date: dayIso }
  return { label, cls: days <= 180 ? 'soon' : 'far', days, date: dayIso }
}

/** A month only: classed by how many calendar months ahead it is. */
export function examFromMonth(today: string, year: number, month: number, label: string): ExamTiming {
  const [ty, tm] = today.split('-').map(Number)
  const ahead = (year - ty) * 12 + month - tm
  if (ahead < 0) return { label: `Sat in ${label}`, cls: 'sat', days: null, date: null }
  const cls: ExamClass = ahead === 0 ? 'now' : ahead <= 2 ? 'prime' : ahead <= 6 ? 'soon' : 'far'
  return { label, cls, days: null, date: null }
}

/** A `trial_leads.sca_sitting` key from the old trial form. */
export function examFromSitting(today: string, key: string | null): ExamTiming {
  const match = /^([a-z]+)_(\d{4})$/.exec(key ?? '')
  if (!match) return key === 'not_sure' ? { ...NOT_GIVEN, label: 'Not sure yet' } : NOT_GIVEN
  const [, word, yearText] = match
  const year = Number(yearText)
  const monthIndex = MONTHS.indexOf(word)
  if (monthIndex >= 0) {
    return examFromMonth(today, year, monthIndex + 1, MONTH_LABEL.format(new Date(Date.UTC(year, monthIndex, 1))))
  }
  if (word in SEASON_MONTH) {
    const label = word === 'later' ? String(year) : `${word[0].toUpperCase()}${word.slice(1)} ${year}`
    return examFromMonth(today, year, SEASON_MONTH[word], label)
  }
  return NOT_GIVEN
}

/** What the lead told us on a call: a YYYY-MM-DD date or a YYYY-MM month. */
export function examFromCall(today: string, date: string | null, month: string | null): ExamTiming | null {
  if (date) return examFromDate(today, date)
  if (!month) return null
  const [year, m] = month.split('-').map(Number)
  return examFromMonth(today, year, m, MONTH_LABEL.format(new Date(Date.UTC(year, m - 1, 1))))
}

export interface ExamSources {
  callDate: string | null
  callMonth: string | null
  profileDate: string | null
  sitting: string | null
}

/** Best source first: the call, then the profile, then the old trial form. */
export function resolveExam(today: string, sources: ExamSources): ExamTiming {
  return (
    examFromCall(today, sources.callDate, sources.callMonth) ??
    (sources.profileDate ? examFromDate(today, sources.profileDate) : examFromSitting(today, sources.sitting))
  )
}

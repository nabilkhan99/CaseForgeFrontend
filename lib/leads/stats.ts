import { londonToday } from './time'

/**
 * A lead's practice so far, from `clinical_sessions` and `session_results`.
 * A row still in `reading` never started; everything past it counts as a
 * consultation, as the customer report counts them.
 */

export interface SessionRow {
  id: string
  user_id: string | null
  station_id: string
  status: string
  started_at: string | null
}

export interface ResultRow {
  session_id: string
  verdict: string | null
  weighted_score: number | string | null
}

export interface PracticeStats {
  consultations: number
  /** Distinct stations attempted; consultations beyond this are redos. */
  stationsTried: number
  passes: number
  best: number | null
  /** London days with at least one consultation. */
  activeDays: number
  last: Date | null
}

const PASS_VERDICTS: ReadonlySet<string> = new Set(['Pass', 'Bare Pass'])

export const NO_PRACTICE: PracticeStats = { consultations: 0, stationsTried: 0, passes: 0, best: null, activeDays: 0, last: null }

export function practiceStats(sessions: readonly SessionRow[], results: ReadonlyMap<string, ResultRow>): PracticeStats {
  const real = sessions.filter((s) => s.status !== 'reading' && s.started_at)
  if (real.length === 0) return NO_PRACTICE
  const marked = real.map((s) => results.get(s.id)).filter((r): r is ResultRow => Boolean(r))
  const scores = marked
    .filter((r) => r.weighted_score !== null && r.weighted_score !== '')
    .map((r) => Number(r.weighted_score))
    .filter(Number.isFinite)
  const starts = real.map((s) => new Date(s.started_at as string))
  return {
    consultations: real.length,
    stationsTried: new Set(real.map((s) => s.station_id)).size,
    passes: marked.filter((r) => r.verdict && PASS_VERDICTS.has(r.verdict)).length,
    best: scores.length ? Math.max(...scores) : null,
    activeDays: new Set(starts.map((d) => londonToday(d))).size,
    last: new Date(Math.max(...starts.map((d) => d.getTime()))),
  }
}

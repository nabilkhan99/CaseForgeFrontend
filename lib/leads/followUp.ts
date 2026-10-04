import {
  MISSED_OUTCOMES,
  REACHED_OUTCOMES,
  type CallRecord,
  type NextAction,
  type NextKind,
  type SuggestedNext,
} from './types'
import { addDays, londonAt, londonDayLabel, londonHour, londonTime, londonWallTimeToUtc } from './time'

/**
 * What to do next with a lead, decided as a pure function of the calls so far.
 *
 * Two layers, as Ishaq asked for them. Most calls follow a standard path (no
 * answer: what next?), so that path is a fixed ladder here. A call that came
 * with its own timing ("ring Tuesday after clinic", "after my exam") carries a
 * suggestion from the AI, and that wins over the ladder: the person told us
 * when. The caller can still override either by hand; that never reaches here.
 */

/** Before this London hour a missed call is retried in the evening, otherwise at lunchtime. */
const AFTERNOON_HOUR = 15
const LUNCHTIME = '12:30'
const EVENING = '18:00'
const MORNING = '10:00'

/** Days to wait after a conversation that set no next step. */
const FOLLOW_UP_AFTER_TALK_DAYS = 3
/** Days to wait after a text, an email or a note. */
const FOLLOW_UP_AFTER_OTHER_DAYS = 2
/** A voicemail gets at least this long for them to ring back. */
const VOICEMAIL_GAP_DAYS = 2
/** A not-yet-reached lead is called this long before their trial ends. */
const TRIAL_LEAD_MS = 3 * 3_600_000
/** Calling hours, London time: a rule never schedules a call outside them. */
const FIRST_CALL_HOUR = 9
const LAST_CALL_HOUR = 20

/**
 * ASSUMPTION, to confirm: roughly when SCA results land after a sitting. Only
 * used to schedule "check in after results" for people who have already sat.
 */
export const RESULTS_LAG_DAYS = 28

/** The no-answer ladder, indexed by consecutive misses minus one. The next miss closes the lead. */
const LADDER: ReadonlyArray<{ gapDays: number; label: string }> = [
  { gapDays: 1, label: 'Call again' },
  { gapDays: 1, label: 'Call again and send a text' },
  { gapDays: 3, label: 'Last call, then email if no answer' },
]

export type Heat = 'hot' | 'warm' | 'cool'

/** What the list knows about a lead that the rules care about. */
export interface LeadStanding {
  heat: Heat
  notCandidate: boolean
  /** Exact exam date, YYYY-MM-DD, when known. */
  examDate: string | null
  /** They have already sat: a past exam date or a past sitting month. */
  examSat: boolean
  trialEndsAt: Date | null
}

export interface FollowUpInput {
  now: Date
  standing: LeadStanding
  /** Oldest first, including the call just logged. */
  calls: readonly CallRecord[]
  /** From the latest call only; older suggestions are history. */
  suggested: SuggestedNext | null
}

function open(label: string, kind: NextKind, due: Date | null, why: string, source: NextAction['source'] = 'rules'): NextAction {
  return { label, kind, dueAt: due ? due.toISOString() : null, source, status: 'open', closedReason: null, why }
}

function closed(reason: string, why: string): NextAction {
  return { label: reason, kind: 'none', dueAt: null, source: 'rules', status: 'closed', closedReason: reason, why }
}

/** Not the same part of the day as the last attempt: lunchtime after a morning miss, evening otherwise. */
function otherWindow(lastAttempt: Date): string {
  return londonHour(lastAttempt) < AFTERNOON_HOUR ? EVENING : LUNCHTIME
}

/** The half hour they picked up at, kept within calling hours. */
function sameTimeOfDay(reached: Date): string {
  const [h, m] = londonTime(reached).split(':').map(Number)
  const hour = Math.min(Math.max(h, 9), 20)
  return `${String(hour).padStart(2, '0')}:${m >= 30 && hour === h ? '30' : '00'}`
}

/** Consecutive misses at the end of the log. Texts, emails and notes neither count nor break the run. */
export function trailingMisses(calls: readonly CallRecord[]): number {
  let misses = 0
  for (let i = calls.length - 1; i >= 0; i--) {
    const { outcome } = calls[i]
    if (MISSED_OUTCOMES.has(outcome)) misses++
    else if (outcome !== 'other') break
  }
  return misses
}

function afterResults(standing: LeadStanding): NextAction {
  const due = standing.examDate ? londonWallTimeToUtc(addDays(standing.examDate, RESULTS_LAG_DAYS), MORNING) : null
  return open('Check in after results', 'call', due, 'Already sat the exam; a resit lead if needed')
}

/** A lead nobody has called yet. */
function firstContact(standing: LeadStanding, now: Date): NextAction {
  if (standing.notCandidate) return closed('Not an SCA candidate', 'Not in GP training')
  if (standing.examSat) return afterResults(standing)
  if (standing.trialEndsAt && standing.trialEndsAt > now) {
    return open('First call', 'call', now, `Trial ends ${londonDayLabel(standing.trialEndsAt)}`)
  }
  if (standing.heat === 'cool') return open('Nurture list', 'none', null, 'Cool lead, not called')
  return open('First call', 'call', now, `${standing.heat === 'hot' ? 'Hot' : 'Warm'} lead, not called yet`)
}

function fromSuggestion(suggested: SuggestedNext, latest: CallRecord, now: Date): NextAction {
  const reached = REACHED_OUTCOMES.has(latest.outcome)
  const time = suggested.time ?? (suggested.kind === 'call' ? (reached ? sameTimeOfDay(new Date(latest.at)) : EVENING) : MORNING)
  const due = londonWallTimeToUtc(suggested.date, time)
  return open(suggested.label, suggested.kind, due < now ? now : due, suggested.why, 'call')
}

function afterMisses(misses: number, latest: CallRecord, standing: LeadStanding): NextAction {
  if (misses > LADDER.length) return closed(`No answer after ${misses} tries`, 'Moved to the nurture list')
  if (standing.examSat) return afterResults(standing)
  const step = LADDER[misses - 1]
  const at = new Date(latest.at)
  const gap = latest.outcome === 'voicemail' ? Math.max(step.gapDays, VOICEMAIL_GAP_DAYS) : step.gapDays
  const why = `${misses} missed call${misses === 1 ? '' : 's'}${latest.outcome === 'voicemail' ? ', voicemail left' : ''}`
  return open(step.label, 'call', londonAt(at, gap, otherWindow(at)), why)
}

function fromRules(latest: CallRecord, calls: readonly CallRecord[], standing: LeadStanding, now: Date): NextAction {
  const at = new Date(latest.at)
  switch (latest.outcome) {
    case 'spoke':
      return open('Follow up', 'call', londonAt(at, FOLLOW_UP_AFTER_TALK_DAYS, sameTimeOfDay(at)), `Spoke ${londonDayLabel(at)}`)
    case 'no_answer':
    case 'voicemail':
      return afterMisses(trailingMisses(calls), latest, standing)
    case 'wrong_number':
      return open('Email them, the number did not work', 'email', now, 'Wrong number')
    default:
      return open('Follow up', 'call', londonAt(at, FOLLOW_UP_AFTER_OTHER_DAYS, MORNING), 'Waiting for a reply')
  }
}

/**
 * Keep a scheduled call inside calling hours: before 09:00 becomes 18:00 the
 * evening before, after 20:00 becomes 18:00 that day, and never in the past.
 */
function intoCallingHours(target: Date, now: Date): Date {
  const hour = londonHour(target)
  if (hour >= FIRST_CALL_HOUR && hour < LAST_CALL_HOUR) return target
  const slot = londonAt(target, hour < FIRST_CALL_HOUR ? -1 : 0, EVENING)
  return slot < now ? now : slot
}

/** Pull a not-yet-reached lead's next call in front of their trial ending. */
function beforeTrialEnds(action: NextAction, input: FollowUpInput): NextAction {
  const { trialEndsAt } = input.standing
  const everReached = input.calls.some((call) => REACHED_OUTCOMES.has(call.outcome))
  if (!trialEndsAt || trialEndsAt <= input.now || everReached) return action
  if (action.status !== 'open' || action.kind !== 'call' || action.source !== 'rules' || !action.dueAt) return action
  const latest = intoCallingHours(new Date(Math.max(input.now.getTime(), trialEndsAt.getTime() - TRIAL_LEAD_MS)), input.now)
  if (new Date(action.dueAt) <= latest) return action
  return { ...action, dueAt: latest.toISOString(), why: `${action.why}, before the trial ends` }
}

export function decideNextAction(input: FollowUpInput): NextAction {
  const latest = input.calls.at(-1)
  if (!latest) return beforeTrialEnds(firstContact(input.standing, input.now), input)
  if (latest.outcome === 'not_interested') return closed('Not interested', 'Said no on the call')
  if (input.suggested) return fromSuggestion(input.suggested, latest, input.now)
  return beforeTrialEnds(fromRules(latest, input.calls, input.standing, input.now), input)
}

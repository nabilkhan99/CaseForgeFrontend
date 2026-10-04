import {
  CALL_OUTCOMES,
  INTENTS,
  NEXT_KINDS,
  type CallDraft,
  type CallFacts,
  type CallOutcome,
  type CallPoint,
  type ExamMention,
  type Intent,
  type NextKind,
  type SuggestedNext,
} from './types'
import { addDays, londonToday, mondayOnOrAfter, monthStart } from './time'

/**
 * Turn whatever the model returned into a CallDraft we are willing to show.
 *
 * Structured outputs make the shape right; they do not make the content safe.
 * Everything is clamped and checked here. A broken outcome means the draft is
 * unusable (throw); a broken next step or fact is dropped so the standard
 * follow-up applies instead, which is always a safe answer.
 */

export class DraftParseError extends Error {}

const MAX_POINTS = 8
const MAX_POINT_CHARS = 300
const MAX_LABEL_CHARS = 30
/** The furthest ahead a call may schedule: a little over a year covers any sitting. */
const MAX_DAYS_AHEAD = 400

/** Labels that are this prompt's field names leaking through, not words a person would write. */
const FIELD_NAME_LABELS: ReadonlySet<string> = new Set(['intent', 'outcome', 'facts', 'competitors list'])
/** Labels for a point that restates the next step, which has its own column. */
const NEXT_STEP_LABELS: ReadonlySet<string> = new Set(['next step', 'next steps', 'next call', 'next action', 'follow up'])

const EMPTY_FACTS: CallFacts = { firstName: null, exam: null, competitors: [], intent: 'unknown' }
const NOTHING_LEARNED: ReadonlySet<CallOutcome> = new Set(['no_answer', 'voicemail', 'wrong_number'])

/** House style: no em or en dashes in copy, the model's included. */
export function stripDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*(?=\d)/g, '-')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, ', ')
    .replace(/,\s*,/g, ',')
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = stripDashes(value.replace(/\s+/g, ' ').trim())
  return text ? text.slice(0, max) : null
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

/** A real calendar date, not just a string that looks like one. */
export function isRealDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function parsePoints(value: unknown): CallPoint[] {
  if (!Array.isArray(value)) return []
  return value
    .map(asRecord)
    .flatMap((point) => {
      const text = point ? cleanText(point.text, MAX_POINT_CHARS) : null
      const label = cleanText(point?.label, MAX_LABEL_CHARS)
      return text ? [{ label: label && FIELD_NAME_LABELS.has(label.toLowerCase()) ? null : label, text }] : []
    })
    .slice(0, MAX_POINTS)
}

/** Drop points that only restate the next step, once the next step has its own field. */
function withoutNextStepPoints(points: CallPoint[], suggested: SuggestedNext | null): CallPoint[] {
  if (!suggested) return points
  return points.filter((point) => !point.label || !NEXT_STEP_LABELS.has(point.label.toLowerCase()))
}

function parseExam(value: unknown): ExamMention | null {
  const exam = asRecord(value)
  const text = exam ? cleanText(exam.text, 40) : null
  if (!exam || !text) return null
  const month = typeof exam.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(exam.month) ? exam.month : null
  return { text, date: isRealDate(exam.date) ? exam.date : null, month }
}

function parseFirstName(value: unknown): string | null {
  const name = cleanText(value, 40)
  return name && /^[\p{L}][\p{L}' -]*$/u.test(name) ? name : null
}

function parseFacts(value: unknown): CallFacts {
  const facts = asRecord(value) ?? {}
  const competitors = Array.isArray(facts.competitors)
    ? [...new Set(facts.competitors.map((c) => cleanText(c, 40)).filter((c): c is string => Boolean(c)))].slice(0, 5)
    : []
  return {
    firstName: parseFirstName(facts.first_name),
    exam: parseExam(facts.exam),
    competitors,
    intent: oneOf<Intent>(facts.intent, INTENTS) ?? 'unknown',
  }
}

function parseNextStep(value: unknown, now: Date): SuggestedNext | null {
  const step = asRecord(value)
  if (!step) return null
  const label = cleanText(step.label, 80)
  const kind = oneOf<NextKind>(step.kind, NEXT_KINDS)
  if (!label || !kind || !isRealDate(step.date)) return null
  const today = londonToday(now)
  // Yesterday is tolerated (a call logged just after midnight); anything older is a mistake.
  if (step.date < addDays(today, -1) || step.date > addDays(today, MAX_DAYS_AHEAD)) return null
  const time = typeof step.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(step.time) ? step.time : null
  return { label, kind, date: step.date, time, why: cleanText(step.why, 120) ?? '' }
}

/**
 * The next step the facts imply when the model left next_step empty. The
 * model misses these often enough (an offer of feedback "after the exam" is
 * not always read as a timing cue) that they are decided here instead, from
 * facts it does extract reliably.
 */
export function impliedNextStep(facts: CallFacts, now: Date): SuggestedNext | null {
  return facts.intent === 'buying' ? checkPurchase(now) : feedbackAfterExam(facts, now)
}

function checkPurchase(now: Date): SuggestedNext {
  return { label: 'Check they have bought', kind: 'check_purchase', date: addDays(londonToday(now), 3), time: null, why: 'Said they will sign up' }
}

/** Feedback offered "after the exam": the first Monday after the exam day, or after the exam month ends. */
function feedbackAfterExam(facts: CallFacts, now: Date): SuggestedNext | null {
  if (facts.intent !== 'feedback_only' || !facts.exam) return null
  const after = facts.exam.date
    ? mondayOnOrAfter(addDays(facts.exam.date, 1))
    : facts.exam.month
      ? mondayOnOrAfter(monthStart(`${facts.exam.month}-01`, 1))
      : null
  if (!after || after <= londonToday(now)) return null
  return { label: 'Ask for feedback after the exam', kind: 'call', date: after, time: null, why: 'Offered feedback once the exam is done' }
}

/**
 * The model's next step, checked against what the facts imply: filled in when
 * it is missing, and moved when it contradicts them (feedback "after the
 * exam" dated before the exam month is over).
 */
function reconcile(suggested: SuggestedNext | null, facts: CallFacts, now: Date): SuggestedNext | null {
  const implied = impliedNextStep(facts, now)
  if (!suggested) return implied
  if (facts.intent === 'feedback_only' && implied && suggested.date < implied.date) return implied
  return suggested
}

/** Parse the model's JSON text into a draft. Throws DraftParseError when it is unusable. */
export function parseCallDraft(content: string, model: string, now: Date): CallDraft {
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new DraftParseError('The AI reply was not JSON.')
  }
  const record = asRecord(raw)
  const outcome = record ? oneOf<CallOutcome>(record.outcome, CALL_OUTCOMES) : null
  if (!record || !outcome) throw new DraftParseError('The AI reply had no usable outcome.')
  // Nobody was reached, so nothing was learned: whatever the model put in facts came from the context.
  const facts = NOTHING_LEARNED.has(outcome) ? EMPTY_FACTS : parseFacts(record.facts)
  const suggestedNext = reconcile(parseNextStep(record.next_step, now), facts, now)
  return { outcome, points: withoutNextStepPoints(parsePoints(record.points), suggestedNext), facts, suggestedNext, model }
}

/**
 * A draft sent back by the admin page, possibly edited by the caller. Given
 * the same checks as the model's reply: the browser is not trusted either.
 */
export function parseClientDraft(value: unknown, now: Date): CallDraft | null {
  const draft = asRecord(value)
  const outcome = draft ? oneOf<CallOutcome>(draft.outcome, CALL_OUTCOMES) : null
  if (!draft || !outcome) return null
  const raw = asRecord(draft.facts) ?? {}
  const facts = NOTHING_LEARNED.has(outcome)
    ? EMPTY_FACTS
    : parseFacts({ first_name: raw.firstName, exam: raw.exam, competitors: raw.competitors, intent: raw.intent })
  return {
    outcome,
    points: parsePoints(draft.points),
    facts,
    suggestedNext: parseNextStep(draft.suggestedNext, now),
    model: typeof draft.model === 'string' ? draft.model.slice(0, 60) : null,
  }
}

/** The draft when no AI is available: the notes as written, outcome left to the caller. */
export function manualDraft(notes: string, outcome: CallOutcome): CallDraft {
  const text = cleanText(notes, 2000)
  return {
    outcome,
    points: text ? [{ label: null, text }] : [],
    facts: EMPTY_FACTS,
    suggestedNext: null,
    model: null,
  }
}

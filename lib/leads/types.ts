/**
 * The lead call log's shared vocabulary.
 *
 * A lead is anyone who took a free case or a 5-day trial and never bought.
 * Calls are logged one lead at a time: the caller types or dictates what
 * happened, the AI turns it into a few points and an outcome, and the
 * follow-up rules decide the next action. Nothing here holds personal data;
 * this repo is public.
 */

/** What happened on one contact attempt. Picked by the AI from the notes, or by a one-tap button. */
export const CALL_OUTCOMES = [
  'no_answer',
  'voicemail',
  'spoke',
  'not_interested',
  'wrong_number',
  'other',
] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]

/** Outcomes where nobody was reached. They count towards the no-answer ladder. */
export const MISSED_OUTCOMES: ReadonlySet<CallOutcome> = new Set(['no_answer', 'voicemail'])

/** Outcomes that mean we have actually spoken to the person at least once. */
export const REACHED_OUTCOMES: ReadonlySet<CallOutcome> = new Set(['spoke', 'not_interested'])

export const NEXT_KINDS = ['call', 'text', 'email', 'check_purchase', 'none'] as const
export type NextKind = (typeof NEXT_KINDS)[number]

export const INTENTS = [
  'buying',
  'considering',
  'not_now',
  'not_interested',
  'feedback_only',
  'unknown',
] as const
export type Intent = (typeof INTENTS)[number]

/**
 * One point in a tidied note. The label is chosen per call ("Exam", "Why us",
 * "Worry"), never a fixed form field, and is null when a plain sentence reads
 * better.
 */
export interface CallPoint {
  label: string | null
  text: string
}

export interface ExamMention {
  /** As the caller put it, tidied: "February 2027", "18 Nov". */
  text: string
  /** YYYY-MM-DD, only when a specific day was given. */
  date: string | null
  /** YYYY-MM, when only the month is known. */
  month: string | null
}

/** Things the call taught us, kept apart from the prose so the list can use them. */
export interface CallFacts {
  firstName: string | null
  exam: ExamMention | null
  competitors: string[]
  intent: Intent
}

/**
 * A next step the call itself asked for: "ring Tuesday after clinic", "check
 * he has bought". Null when the call gave no cue and the standard follow-up
 * should apply.
 */
export interface SuggestedNext {
  label: string
  kind: NextKind
  /** London calendar date, YYYY-MM-DD. */
  date: string
  /** London wall time, HH:MM, or null when the call named only a day. */
  time: string | null
  why: string
}

/** What the caller reviews before saving. Produced by the AI, or by hand when it is unavailable. */
export interface CallDraft {
  outcome: CallOutcome
  points: CallPoint[]
  facts: CallFacts
  suggestedNext: SuggestedNext | null
  /** The deployment that wrote it; null when nobody but the caller did. */
  model: string | null
}

export type NextSource = 'rules' | 'call' | 'manual'

/** The next action column. Closed actions have no due time. */
export interface NextAction {
  label: string
  kind: NextKind
  /** ISO instant, or null when closed or not scheduled. */
  dueAt: string | null
  source: NextSource
  status: 'open' | 'closed'
  closedReason: string | null
  /** A few words on why, shown under the action. */
  why: string
}

/** A logged call as the follow-up rules see it. */
export interface CallRecord {
  outcome: CallOutcome
  /** ISO instant. */
  at: string
}

import { CALL_OUTCOMES, INTENTS, NEXT_KINDS, type CallOutcome } from './types'
import { addDays, dayLabel, londonDayLabel, londonTime, londonToday, mondayOnOrAfter, monthStart } from './time'

/**
 * The prompt that turns a caller's rough notes about ONE call into a record.
 *
 * Written fresh for this job, not adapted from another prompt. The notes are
 * typed or dictated straight after a call, so they are messy; the output is
 * read by the other founder before the next call, so it must be short and
 * must never invent anything. Points are free-form on purpose: Ishaq asked for
 * points that follow the call, not boxes to fill.
 *
 * Dates are the classic failure, so the model never does date arithmetic: it
 * copies dates from a calendar printed into the message.
 */

/** How many days of calendar the model sees. Further out it writes the date itself. */
export const CALENDAR_DAYS = 28

export const CALL_NOTES_SYSTEM_PROMPT = `You turn a caller's rough notes about one phone call into a short, tidy record.

Context: Fourteen Fisherman sells practice for the SCA, the clinical exam UK GP trainees sit to qualify. The two founders ring doctors who tried a free practice case or a free 5-day trial, to hear how they got on and whether they will buy. The notes were typed or dictated straight after the call, so expect typos, dictation errors and missing punctuation. The other founder will read your record before the next call to this doctor.

POINTS
- Write 0 to 6 short points, most useful first. Each point is one fact or one thing the doctor said.
- Keep the caller's meaning, including any doubt ("probably February", "18 Nov, she thinks"). Fix spelling and obvious dictation errors; do not add anything that is not in the notes.
- Give a point a short label in sentence case (one to three words, such as "Exam", "Interested", "Currently uses", "Why us", "Worried about", "Asked for", "Feedback", "Busy") only when it makes the point faster to scan, and only when the label is true: "Worried about" is for a worry, not for being busy. Labels are words a person would write, never the field names in this prompt ("Intent", "Competitors", "Outcome", "Next step"). Labels are not a form: never add a point to fill a label, and never write "not mentioned" or "unknown".
- Leave out pleasantries (thanked us, said goodbye). Never write a point about the next call or next step: it has its own field below.
- Plain British English, no emoji, and no dashes used as punctuation: use commas or full stops.
- When the notes only say nobody answered, return no points.

OUTCOME (pick exactly one)
- no_answer: they did not pick up, or the call did not connect.
- voicemail: the caller left a voicemail or a message on their phone.
- spoke: any conversation, however short, including "busy, call back later".
- not_interested: spoke, and they clearly said no: already passed, not sitting, or settled elsewhere.
- wrong_number: the number belongs to someone else or does not work.
- other: no call was made, for example the caller sent a text, WhatsApp or email, or is adding a note. A reply by text is still other, not spoke.

FACTS (only from the caller's notes, never from "What we already know"; when nothing new was learned, use null and empty values)
- first_name: the doctor's first name if the notes give it, otherwise null.
- exam: when they sit the SCA, if the notes say. "text" is their wording tidied ("February 2027", "this month"). "date" is YYYY-MM-DD only when a specific day is given. "month" is YYYY-MM when a month is known. A month with no year means the next one from today. null when not mentioned.
- competitors: other SCA practice products or courses they mention, by name. Not websites or forums such as Reddit or YouTube.
- intent: buying (said they will buy or sign up), considering, not_now (a later sitting, busy, or come back later), not_interested, feedback_only (happy to talk or give feedback, not buying now), unknown.

NEXT STEP (only when the notes give one)
- Set next_step when the notes contain a timing cue or an agreed action: "ring Tuesday after clinic", "call me after my exam", "send her the study budget letter", "he'll sign up this week", "she'll have a look at the weekend" (follow up on the coming Monday), "happy to give feedback after the exam" (ask for feedback after it). Otherwise next_step is null and the system applies its standard follow-up for the outcome.
- date: copy it from the calendar or the anchor dates; never work it out yourself. "Next week" means the week that starts on the coming Monday. "After my exam" with only the month known means the anchor "first Monday after that month ends". If they will buy or sign up and gave no day, use the anchor "three days from today". Further out than the calendar, write the YYYY-MM-DD of the right day. If you cannot place it at all, use null for next_step.
- time: use the time words in the anchor list ("after clinic" is 18:00), an explicit time as given, otherwise null.
- kind: call, text, email, check_purchase (they said they will buy: check it went through), or none.
- label: a short instruction to the caller starting with a verb: "Call back", "Check he has bought", "Ask for feedback", "Ask how the exam went". When they also asked for something to be sent, say both: "Send the study budget letter, then call back".
- why: a few words from the notes that justify it.`

/** Strict JSON schema for Azure structured outputs: every key required, nullable where optional. */
export const CALL_NOTES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['outcome', 'points', 'facts', 'next_step'],
  properties: {
    outcome: { type: 'string', enum: [...CALL_OUTCOMES] },
    points: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'text'],
        properties: {
          label: { type: ['string', 'null'] },
          text: { type: 'string' },
        },
      },
    },
    facts: {
      type: 'object',
      additionalProperties: false,
      required: ['first_name', 'exam', 'competitors', 'intent'],
      properties: {
        first_name: { type: ['string', 'null'] },
        exam: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'date', 'month'],
              properties: {
                text: { type: 'string' },
                date: { type: ['string', 'null'] },
                month: { type: ['string', 'null'] },
              },
            },
          ],
        },
        competitors: { type: 'array', items: { type: 'string' } },
        intent: { type: 'string', enum: [...INTENTS] },
      },
    },
    next_step: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'kind', 'date', 'time', 'why'],
          properties: {
            label: { type: 'string' },
            kind: { type: 'string', enum: [...NEXT_KINDS] },
            date: { type: 'string' },
            time: { type: ['string', 'null'] },
            why: { type: 'string' },
          },
        },
      ],
    },
  },
} as const

const OUTCOME_WORDS: Record<CallOutcome, string> = {
  no_answer: 'no answer',
  voicemail: 'voicemail left',
  spoke: 'spoke',
  not_interested: 'not interested',
  wrong_number: 'wrong number',
  other: 'note',
}

export interface EarlierCall {
  at: Date
  outcome: CallOutcome
  /** The tidied points of that call, joined, or null. */
  summary: string | null
}

/** What we already know about the doctor. No email or phone: the model does not need them. */
export interface CallNotesLeadContext {
  name: string | null
  /** As shown on the list: "7 Oct 2026", "February 2027", or null. */
  examOnFile: string | null
  trial: { endsAt: Date } | null
  consultations: number
  passes: number
  /** Most recent last; only the last few are sent. */
  earlierCalls: readonly EarlierCall[]
}

export interface CallNotesInput {
  notes: string
  lead: CallNotesLeadContext
  now: Date
}

const LONG_DAY = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' })

/**
 * Dates the model is most often asked for and most often gets wrong, worked
 * out here so it can copy them: the coming Monday, three days out, and the
 * first Monday after this month and each of the next few months end.
 */
export function anchorLines(now: Date): string[] {
  const today = londonToday(now)
  const line = (label: string, day: string) => `${label}: ${dayLabel(day)} = ${day}`
  const tomorrow = addDays(today, 1)
  return [
    line('Tomorrow', tomorrow),
    line('The coming Monday (start of "next week")', mondayOnOrAfter(tomorrow)),
    line('Three days from today', addDays(today, 3)),
    ...[0, 1, 2, 3, 4, 5].map((offset) => {
      const month = MONTH_NAME.format(new Date(`${monthStart(today, offset)}T00:00:00Z`))
      return line(`First Monday after ${month} ends`, mondayOnOrAfter(monthStart(today, offset + 1)))
    }),
  ]
}

/** One line per day for the next four weeks: "Tue 6 Oct 2026 = 2026-10-06". */
export function calendarLines(now: Date, days: number = CALENDAR_DAYS): string[] {
  const today = londonToday(now)
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i)
    return `${dayLabel(day)} = ${day}${i === 0 ? ' (today)' : ''}`
  })
}

function trialLine(lead: CallNotesLeadContext, now: Date): string {
  if (!lead.trial) return 'none, they tried a single free case'
  const when = `${londonDayLabel(lead.trial.endsAt)} at ${londonTime(lead.trial.endsAt)}`
  return lead.trial.endsAt > now ? `running, ends ${when}` : `ended ${when}`
}

function earlierCallsLine(lead: CallNotesLeadContext): string {
  const recent = lead.earlierCalls.slice(-3)
  if (recent.length === 0) return 'none'
  return recent
    .map((c) => `${londonDayLabel(c.at)} ${londonTime(c.at)}, ${OUTCOME_WORDS[c.outcome]}${c.summary ? `: ${c.summary}` : ''}`)
    .join('; ')
}

/** The user message: today, the calendar, what we know, then the notes verbatim. */
export function buildCallNotesUserMessage({ notes, lead, now }: CallNotesInput): string {
  return [
    `Today is ${LONG_DAY.format(now).replace(/,/g, '')}, ${londonTime(now)} UK time.`,
    '',
    'Calendar (copy dates from here):',
    ...calendarLines(now),
    '',
    'Anchor dates:',
    ...anchorLines(now),
    '',
    'Anchor times: "after clinic", "after work" or "evening" = 18:00; "lunchtime" = 12:30; "morning" = 09:30.',
    '',
    'What we already know about this doctor:',
    `- Name on file: ${lead.name ?? 'none, they signed up with only an email address'}`,
    `- Exam on file: ${lead.examOnFile ?? 'not given'}`,
    `- Free trial: ${trialLine(lead, now)}`,
    `- Practice so far: ${lead.consultations} consultation${lead.consultations === 1 ? '' : 's'}, ${lead.passes} passed`,
    `- Earlier calls: ${earlierCallsLine(lead)}`,
    '',
    "The caller's notes, typed or dictated just now:",
    '"""',
    notes.trim(),
    '"""',
  ].join('\n')
}

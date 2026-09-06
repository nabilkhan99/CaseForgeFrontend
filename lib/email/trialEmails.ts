import { BrevoClient, BrevoError } from '@getbrevo/brevo'
import { BRAND, button, emailShell, fallbackLink, paragraph, row, signoff } from './chrome'

/**
 * The two emails the five-station free trial sends: one on day 3, one on day 5.
 *
 * WHAT THESE ARE NOT. There is no AI in this file. Every sentence about a
 * trainee's results is composed here, from counts, by rules you can read — a
 * second model writing a friendly summary of a first model's marking is a new
 * place for the product to be wrong about somebody's exam performance, in a
 * medium they cannot reply to and we cannot take back. The marking engine has
 * already said what it thinks; these emails only count what it said.
 *
 * COPY RULES, and they are rules rather than taste:
 *   * never the word "trial" at the reader (decision 2 in the handoff) — it is
 *     "five free stations", and what has run out is stations and days;
 *   * no invented scarcity. The deadline is real (`expires_at`) and is stated
 *     as a date; nothing counts down, nothing is "about to close";
 *   * NO GUARANTEE WORDING. The £500 pass guarantee belongs to plan holders.
 *     Putting it in front of somebody who has paid nothing would be a promise
 *     we have not made, and the terms live in the FAQ, not here;
 *   * no testimonials, no social proof. These are somebody's own results.
 *
 * Built on the house chrome ({@link ./chrome}) like {@link ./accountEmail}, so
 * a brand change reaches them for free. Deliberately no `server-only` import:
 * the builders are pure and are exercised by unit tests and by the send script,
 * neither of which is a React server component.
 */

/** A built email, ready to hand to Brevo or to print in a dry run. */
export interface RenderedEmail {
  subject: string
  html: string
  text: string
  /** The greeting line, so a caller can assert the body is really addressed to this person. */
  greeting: string
}

/**
 * One marked consultation, reduced to what these emails are allowed to say
 * about it.
 *
 * Both fields come off the same `session_results` row. `focusDomains` is
 * `focus_areas[].domain` in priority order — the marking engine's own answer to
 * "what would change this result" — and is the preferred source. `domains` is
 * the graded breakdown, used only when a row has no focus areas at all.
 */
export interface TrialMark {
  /** `session_results.verdict`: Pass | Bare Pass | Bare Fail | Fail. */
  verdict: string
  focusDomains?: readonly string[]
  domains?: readonly { domain: string; grade?: string | null }[]
}

/** The three SCA domains, lower-cased for prose. Keys are `session_results` domain keys. */
const DOMAIN_LABEL: Record<string, string> = {
  data_gathering: 'data gathering',
  clinical_management: 'clinical management',
  relating_to_others: 'relating to others',
  // The marking engine has used this name for the third domain in the past and
  // some older rows still carry it. Mapped rather than dropped, because an
  // unmapped domain silently removes the most useful sentence in the email.
  interpersonal_skills: 'relating to others',
}

/**
 * Tie-break order when two domains are equally weak: clinical management first
 * because it is weighted 1.5x and therefore the one most likely to be what
 * actually decided the verdict.
 */
const DOMAIN_PRIORITY: readonly string[] = [
  'clinical_management',
  'data_gathering',
  'relating_to_others',
]

/** Worst first. Only F and CF are ever described as "the thing to change". */
const GRADE_RANK: Record<string, number> = { CF: 0, F: 1, P: 2, CP: 3 }

/**
 * Verdict bands in prose, best band first — the order a list of them is read
 * out in. "Near miss" for Bare Fail is the product's own word for that band
 * (it is what the reveal screen calls it), and it is the honest one: a Bare
 * Fail is a consultation that came within half a point.
 */
const VERDICT_ORDER: readonly string[] = ['Pass', 'Bare Pass', 'Bare Fail', 'Fail']
const VERDICT_PHRASE: Record<string, { one: string; many: string }> = {
  Pass: { one: 'pass', many: 'passes' },
  'Bare Pass': { one: 'bare pass', many: 'bare passes' },
  'Bare Fail': { one: 'near miss', many: 'near misses' },
  Fail: { one: 'fail', many: 'fails' },
}

/** Counting words. Five stations is the whole offer, so this never needs to go far. */
const NUMBER_WORD: readonly string[] = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]

function numberWord(n: number): string {
  return NUMBER_WORD[n] ?? String(n)
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/**
 * Escape a value that came from a person into HTML.
 *
 * `paragraph()` interpolates verbatim — correct for the markup this file
 * builds, and unsafe for a name typed into a sign-up form. The only
 * user-controlled string that reaches these templates is the first name, and it
 * goes through here.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Titles we strip before greeting somebody by name.
 *
 * A large share of these addresses sign up as "Dr Smith", and "Hi Dr," is the
 * kind of small wrongness that tells a reader an email is automated. Stripping
 * the title and taking the next word gets "Hi Smith," at worst, which reads as
 * brusque rather than broken.
 */
const TITLES: ReadonlySet<string> = new Set([
  'dr',
  'dr.',
  'doctor',
  'mr',
  'mr.',
  'mrs',
  'mrs.',
  'ms',
  'ms.',
  'miss',
  'prof',
  'prof.',
  'professor',
])

/** "Jane" from "Dr Jane Smith"; null when there is nothing usable. */
export function firstNameFrom(raw?: string | null): string | null {
  const words = (raw ?? '')
    .replace(/[\s,]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  const name = words.find((word) => !TITLES.has(word.toLowerCase()))
  if (!name) return null
  // Case is normalised only when the whole word is one case — "JANE" and "jane"
  // are both form-filling artefacts, while "McDonald" and "O'Neill" are how
  // people actually write their names and must survive untouched.
  if (name === name.toUpperCase() || name === name.toLowerCase()) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  }
  return name
}

/** "Hi Jane," or "Hi there," — the same fallback {@link ./accountEmail} uses. */
export function greetingFor(raw?: string | null): string {
  return `Hi ${firstNameFrom(raw) ?? 'there'},`
}

/**
 * "one pass and two near misses" — the verdicts, counted, best band first.
 *
 * Counts rather than a list of five verdicts in the order they happened: the
 * pattern is the point, and "Bare Fail, Fail, Bare Fail" makes a reader do the
 * counting themselves.
 */
export function describeVerdicts(marks: readonly TrialMark[]): string {
  const counts = new Map<string, number>()
  for (const mark of marks) {
    const key = mark.verdict?.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (counts.size === 0) return ''

  const known = VERDICT_ORDER.filter((verdict) => counts.has(verdict))
  // An unrecognised band is still reported, after the known ones, using its own
  // wording. Dropping it would make the numbers in the sentence not add up.
  const unknown = [...counts.keys()].filter((verdict) => !VERDICT_ORDER.includes(verdict)).sort()

  const parts = [...known, ...unknown].map((verdict) => {
    const count = counts.get(verdict) ?? 0
    const phrase = VERDICT_PHRASE[verdict]
    const noun = phrase
      ? plural(count, phrase.one, phrase.many)
      : `${verdict.toLowerCase()}${count === 1 ? '' : 's'}`
    return `${numberWord(count)} ${noun}`
  })

  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** The domain the marking engine pointed at for one consultation, or null. */
function domainToFix(mark: TrialMark): string | null {
  for (const domain of mark.focusDomains ?? []) {
    if (domain && DOMAIN_LABEL[domain]) return domain
  }
  // Fallback: the weakest GRADED domain, and only when it actually failed.
  // A row whose three domains all passed has nothing anybody needs to fix, and
  // naming its lowest pass would be inventing a weakness.
  const graded = (mark.domains ?? [])
    .filter((entry) => entry?.domain && DOMAIN_LABEL[entry.domain])
    .map((entry) => ({ domain: entry.domain, rank: GRADE_RANK[entry.grade ?? ''] ?? 99 }))
    .filter((entry) => entry.rank <= GRADE_RANK.F)
  if (graded.length === 0) return null
  graded.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return DOMAIN_PRIORITY.indexOf(a.domain) - DOMAIN_PRIORITY.indexOf(b.domain)
  })
  return graded[0].domain
}

export interface DominantDomain {
  /** Domain key, e.g. `clinical_management`. */
  domain: string
  /** Prose label, e.g. "clinical management". */
  label: string
  /** How many of the marks pointed at it. */
  count: number
  /** How many marks were considered. */
  total: number
}

/**
 * The domain that came up most often across a set of marks, or null.
 *
 * Requires at least two marks pointing at the same domain: one station saying
 * "clinical management" is a case, two is a pattern, and only the second is
 * worth an email. Ties are broken by {@link DOMAIN_PRIORITY} so the answer is
 * stable rather than dependent on row order.
 */
export function dominantDomain(marks: readonly TrialMark[]): DominantDomain | null {
  const counts = new Map<string, number>()
  for (const mark of marks) {
    const domain = domainToFix(mark)
    if (domain) counts.set(domain, (counts.get(domain) ?? 0) + 1)
  }
  let best: { domain: string; count: number } | null = null
  for (const [domain, count] of counts) {
    if (
      !best ||
      count > best.count ||
      (count === best.count &&
        DOMAIN_PRIORITY.indexOf(domain) < DOMAIN_PRIORITY.indexOf(best.domain))
    ) {
      best = { domain, count }
    }
  }
  if (!best || best.count < 2) return null
  return {
    domain: best.domain,
    label: DOMAIN_LABEL[best.domain],
    count: best.count,
    total: marks.length,
  }
}

/**
 * "both times" / "all three times" / "in two of them".
 *
 * Never "in most of them": with five marks at most, the exact count is shorter
 * than the vague word and cannot be argued with.
 */
function timesPhrase(count: number, total: number): string {
  if (count >= total) return total === 2 ? 'both times' : `all ${numberWord(total)} times`
  return `in ${numberWord(count)} of them`
}

/**
 * One line about the pattern so far, or null when there is not enough to say.
 *
 * Null under two marks on purpose: after a single station the only honest
 * sentence is "you did one station", which the rest of the email already says.
 */
export function trialPatternLine(marks: readonly TrialMark[]): string | null {
  if (marks.length < 2) return null
  const verdicts = describeVerdicts(marks)
  if (!verdicts) return null
  const domain = dominantDomain(marks)
  const capitalised = verdicts.charAt(0).toUpperCase() + verdicts.slice(1)
  if (!domain) return `${capitalised} so far.`
  return `${capitalised} so far, and ${domain.label} came up ${timesPhrase(domain.count, domain.total)}.`
}

/** Their five days' work in one short paragraph. Deterministic; no judgement added. */
export function trialResultsParagraph(marks: readonly TrialMark[], allowance: number): string {
  if (marks.length === 0) {
    return 'You did not get to a marked consultation this time, so there is nothing scored to look back on.'
  }
  const ran = `You ran ${numberWord(marks.length)} of your ${numberWord(allowance)}: ${describeVerdicts(marks)}.`
  const domain = dominantDomain(marks)
  if (!domain) return ran
  return `${ran} ${domain.label.charAt(0).toUpperCase() + domain.label.slice(1)} came up as the thing to change ${timesPhrase(domain.count, domain.total)}.`
}

/**
 * "Friday 11 September", in London.
 *
 * The timezone is pinned rather than taken from the machine: this runs from
 * whatever laptop or region the send script is invoked on, and a date that
 * slips by one for readers in the UK is exactly the sort of error nobody
 * notices until a trainee says their stations ended a day early.
 */
export function formatEndDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export interface TrialDay3Input {
  /** As given at sign-up; titles stripped, first word used. */
  firstName?: string | null
  /** Stations still unspent. The subject line's N. */
  remaining: number
  /** `trial_grants.expires_at` — the real end of the window. */
  endsAt: Date
  /** Their marks so far, newest or oldest first — order is not used. */
  marks?: readonly TrialMark[]
  /** Absolute URL the button points at. Built by the caller, never escaped. */
  dashboardUrl: string
}

/**
 * Day 3 of 5: what is left, and when it ends.
 *
 * Deliberately the smallest useful email. It exists because the failure mode
 * this offer has is not "they did not like it" but "they meant to and the week
 * went" — so it says the number and the date and gets out of the way.
 */
export function buildTrialDay3Email(input: TrialDay3Input): RenderedEmail {
  const remaining = Math.max(0, Math.trunc(input.remaining))
  const marks = input.marks ?? []
  const greeting = greetingFor(input.firstName)
  const endsOn = formatEndDate(input.endsAt)
  const stations = `${numberWord(remaining)} ${plural(remaining, 'station', 'stations')}`

  const subject = `Two days and ${remaining} ${plural(remaining, 'station', 'stations')} left`
  const cta = 'Open your dashboard'

  const lines = [
    `You have ${stations} left, and your five days end on ${endsOn}.`,
    trialPatternLine(marks),
    'Any case in the bank counts, and you can run the same one twice.',
  ].filter((line): line is string => Boolean(line))

  const html = emailShell({
    title: subject,
    preheader: `${stations} still to run, until ${endsOn}.`,
    heading: 'Two days left',
    rows: [
      row(
        [paragraph(escapeHtml(greeting)), ...lines.map((line) => paragraph(escapeHtml(line)))].join(
          '\n                ',
        ),
        '20px 40px 8px 40px',
      ),
      row(
        `${button(input.dashboardUrl, cta)}
                <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
                ${fallbackLink(input.dashboardUrl)}`,
        '0 40px 28px 40px',
      ),
      row(signoff('See you in there,'), '0 40px 36px 40px'),
    ],
  })

  const text = [
    greeting,
    '',
    ...lines,
    '',
    `${cta}: ${input.dashboardUrl}`,
    '',
    'See you in there,',
    'The Fourteen Fisherman Team',
    `${BRAND.senderName} · ${BRAND.siteUrl}`,
  ].join('\n')

  return { subject, html, text, greeting }
}

export interface TrialDay5Input {
  firstName?: string | null
  /** Every genuinely-marked consultation of the five. */
  marks?: readonly TrialMark[]
  /** What the grant was worth, so the copy never hardcodes the five. */
  allowance?: number
  /** Absolute URL of the dashboard, where the two-plan wall now renders. */
  dashboardUrl: string
}

/**
 * Day 5: what they did, and what they keep.
 *
 * The second paragraph is the one that matters and it is the one people do not
 * expect: the account does not disappear. Reports, board and development
 * picture stay readable for ever; it is only the stations that stop. Said in
 * the email because somebody who thinks their results are about to be deleted
 * does not come back to check.
 */
export function buildTrialDay5Email(input: TrialDay5Input): RenderedEmail {
  const marks = input.marks ?? []
  const allowance = input.allowance ?? 5
  const greeting = greetingFor(input.firstName)

  const subject = 'Your five stations have ended'
  const cta = 'Open your dashboard'

  const lines = [
    trialResultsParagraph(marks, allowance),
    'Everything you did is still there — your reports, your board and your development picture. It is the stations that stop, not the account.',
    'If you want to keep going, the two plans that fit your exam date are on your dashboard.',
  ]

  const html = emailShell({
    title: subject,
    preheader: 'What you did, and what stays.',
    heading: 'Your five stations have ended',
    rows: [
      row(
        [paragraph(escapeHtml(greeting)), ...lines.map((line) => paragraph(escapeHtml(line)))].join(
          '\n                ',
        ),
        '20px 40px 8px 40px',
      ),
      row(
        `${button(input.dashboardUrl, cta)}
                <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>
                ${fallbackLink(input.dashboardUrl)}`,
        '0 40px 28px 40px',
      ),
      row(signoff('Thanks for practising with us,'), '0 40px 36px 40px'),
    ],
  })

  const text = [
    greeting,
    '',
    ...lines,
    '',
    `${cta}: ${input.dashboardUrl}`,
    '',
    'Thanks for practising with us,',
    'The Fourteen Fisherman Team',
    `${BRAND.senderName} · ${BRAND.siteUrl}`,
  ].join('\n')

  return { subject, html, text, greeting }
}

/** Which of the two emails this is. Also the Brevo tag and the `trial_email_sends.kind`. */
export type TrialEmailKind = 'day3' | 'day5'

/** Brevo tags, so a send can be found in their dashboard without guessing. */
export const TRIAL_EMAIL_TAG: Record<TrialEmailKind, string> = {
  day3: 'trial-day3',
  day5: 'trial-day5',
}

export interface SendTrialEmailArgs {
  kind: TrialEmailKind
  toEmail: string
  toName?: string | null
  email: RenderedEmail
}

export type SendTrialEmailResult =
  | { sent: true; messageId: string | null }
  | { sent: false; skipped: 'missing_BREVO_API_KEY' }
  | { sent: false; error: string }

/**
 * Hand a built email to Brevo transactional.
 *
 * Same shape as every other sender here: never throws, and skips cleanly with
 * no key so a dev machine does not need one. Returns the Brevo message id
 * because the send is recorded in `trial_email_sends` — without it a bounce
 * investigation has nothing to join on.
 *
 * ⚠️ This function SENDS TO A REAL PERSON. Its only caller is
 * scripts/trial-emails/due.ts, behind `--send`, `--yes` and `TRIAL_EMAIL_SEND=1`.
 * Do not wire it to a route, a webhook or a cron without Nabil's go-ahead.
 */
export async function sendTrialEmail({
  kind,
  toEmail,
  toName,
  email,
}: SendTrialEmailArgs): Promise<SendTrialEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[trial-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  try {
    const response = await new BrevoClient({ apiKey: brevoKey }).transactionalEmails.sendTransacEmail(
      {
        sender: { name: BRAND.senderName, email: BRAND.senderEmail },
        // A reply to "your stations have ended" is a person with a question
        // about their own results; it has to reach a human, not a bounce box.
        replyTo: { name: BRAND.senderName, email: BRAND.senderEmail },
        to: [{ email: toEmail, ...(toName ? { name: toName } : {}) }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
        tags: [TRIAL_EMAIL_TAG[kind]],
      },
    )
    return { sent: true, messageId: response?.messageId ?? null }
  } catch (error: unknown) {
    if (error instanceof BrevoError) {
      console.error('[trial-email] Brevo API error', {
        kind,
        email: toEmail,
        statusCode: error.statusCode,
        message: error.message,
      })
      return { sent: false, error: `${error.statusCode} ${error.message}` }
    }
    console.error('[trial-email] send failed', { kind, email: toEmail, error })
    return { sent: false, error: error instanceof Error ? error.message : String(error) }
  }
}

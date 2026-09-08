/**
 * Who is due a five-station-trial email today, and — only when told twice —
 * send it.
 *
 * ┌─ HOW NABIL RUNS THIS ─────────────────────────────────────────────────────┐
 * │                                                                           │
 * │  Once a day, from CaseForgeFrontend, against production:                  │
 * │                                                                           │
 * │    npx vite-node --config vitest.config.ts scripts/trial-emails/due.ts    │
 * │                                                                           │
 * │  That is a DRY RUN and is the default (--dry-run is accepted and means    │
 * │  the same thing) — it prints who is due what, with the subject line each  │
 * │  of them would get, and sends nothing. Read it.                           │
 * │                                                                           │
 * │  To actually send, all three of these are required, together:             │
 * │                                                                           │
 * │    TRIAL_EMAIL_SEND=1 npx vite-node --config vitest.config.ts \           │
 * │      scripts/trial-emails/due.ts --send --yes                             │
 * │                                                                           │
 * │  Add --verbose to either to list everyone who was skipped and why.        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * WHY BY HAND. There is no scheduler in production. Vercel Hobby has cron, and
 * this is a good candidate for one later (a route that calls the same rules in
 * scripts/trial-emails/dueRules.ts, once a day, at 09:00 London) — but a cron
 * that mails customers is a thing that can go wrong at 3am with nobody reading,
 * and the rule for this product is that no email reaches a real person without
 * Nabil's explicit go-ahead, every time. A daily dry run he reads before typing
 * --send is that go-ahead, made concrete.
 *
 * THE DAY-3 WINDOW IS 24 HOURS. Its subject counts the days left, which is true
 * on day 3 and false on day 4, so a day this is not run is a day whose cohort
 * gets no day-3 email at all (they still get day 5). Missing a nudge is cheap;
 * telling somebody they have two days when they have one is not. See
 * DAY3_WINDOW_DAYS.
 *
 * WHAT IT READS: trial_grants, stations (which five the trial opens),
 * clinical_sessions + session_results (which of the five they sat, and what was
 * genuinely marked, by the same rules as
 * lib/commerce/trialAccess.ts#countTrialUsage), trial_leads (first name),
 * preorders (to exclude buyers), trial_email_sends (to exclude anyone already
 * emailed). WHAT IT WRITES: one trial_email_sends row per successful send, and
 * nothing else, ever.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { SITE_URL } from '@/lib/seo/site'
import {
  buildTrialDay3Email,
  buildTrialDay5Email,
  sendTrialEmail,
  type RenderedEmail,
  type TrialEmailKind,
  type TrialMark,
} from '@/lib/email/trialEmails'
import {
  selectDueTrialEmails,
  type TrialEmailCandidate,
  type TrialEmailSkipReason,
} from './dueRules'
import { assertSendable } from './sendGuard'

// ── Env, the same way every script in this directory reads it ───────────────
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (match) process.env[match[1]] ??= match[2].trim()
}

const args = process.argv.slice(2)
const SEND = args.includes('--send')
const YES = args.includes('--yes')
const VERBOSE = args.includes('--verbose')
/** Accepted and does nothing: a dry run is what happens without `--send` anyway. */
const DRY_RUN = args.includes('--dry-run')

if (SEND && DRY_RUN) {
  console.error('--send and --dry-run contradict each other. Pick one.')
  process.exit(1)
}

/**
 * THREE INDEPENDENT LOCKS on sending, and they are independent on purpose.
 *
 * `--send` is intent, `--yes` is confirmation, and TRIAL_EMAIL_SEND=1 is an
 * environment that a shell history repeat or a copy-pasted command line does
 * not carry with it. Any one of them missing means dry run. The failure this
 * guards against is not a careless person; it is a correct command, run again
 * tomorrow, out of context.
 */
const ARMED = SEND && YES && process.env.TRIAL_EMAIL_SEND === '1'
if (SEND && !ARMED) {
  console.error(
    'Refusing to send. --send needs BOTH --yes and TRIAL_EMAIL_SEND=1 in the environment.',
  )
  process.exit(1)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  process.exit(1)
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DASHBOARD_URL = `${SITE_URL}/dashboard`
const NOW = new Date()

const lower = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

// ── Load ────────────────────────────────────────────────────────────────────

interface GrantRow {
  user_id: string
  email: string
  allowance: number
  window_days: number
  started_at: string | null
  expires_at: string | null
  created_at: string
}

async function loadGrants(): Promise<GrantRow[]> {
  const { data, error } = await supabase
    .from('trial_grants')
    .select('user_id, email, allowance, window_days, started_at, expires_at, created_at')
    // A grant whose window never opened can never be due anything, so it is
    // filtered in the query rather than carried through the whole pipeline.
    .not('started_at', 'is', null)
  if (error) {
    throw new Error(
      `trial_grants: ${error.message} — has supabase/migrations/20260906_trial_grants.sql been applied?`,
    )
  }
  return (data ?? []) as GrantRow[]
}

interface MarkRow {
  user_id: string
  station_id: string | null
  status: string | null
  started_at: string | null
  session_results:
    | SessionResultRow
    | SessionResultRow[]
    | null
}

interface SessionResultRow {
  weighted_score: number | string | null
  verdict: string | null
  focus_areas: unknown
  domains: unknown
  created_at: string | null
}

/**
 * The five cases a trial opens, in `free_trial_order`.
 *
 * MIRRORS lib/commerce/trialAccess.ts#loadFreeTrialStationIds. The emails count
 * cases tried against this list, so a script working from a different set would
 * tell somebody they had sat two of five while their dashboard said three — and
 * the dashboard is the one they believe.
 */
async function loadFreeStationIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('stations')
    .select('id, free_trial_order')
    .eq('is_free_trial', true)
    .order('free_trial_order', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })
  if (error) {
    throw new Error(
      `stations: ${error.message} — has supabase/migrations/20260906_trial_grants.sql been applied?`,
    )
  }
  return (data ?? []).map((row) => (row as { id: string }).id)
}

/**
 * Every session, per user, with its mark when it has one.
 *
 * Two numbers come out of this and they are counted by different rules, both
 * mirroring lib/commerce/trialAccess.ts:
 *   * CASES TRIED — distinct free-trial stations with a session in any status
 *     but `reading` (countTrialUsage). Opening a brief is not sitting a case.
 *   * MARKS — sessions carrying a `session_results` row with
 *     `weighted_score > 0`, for the day-5 summary. There can be more of these
 *     than there are cases: attempts are unlimited.
 * The score is compared in JS, not as a `.gt()` on the embed, because PostgREST
 * can hand a numeric back as a string and a server-side comparison would then
 * be lexicographic.
 */
async function loadMarks(userIds: string[]): Promise<Map<string, MarkRow[]>> {
  const byUser = new Map<string, MarkRow[]>()
  if (userIds.length === 0) return byUser

  const { data, error } = await supabase
    .from('clinical_sessions')
    .select(
      'user_id, station_id, status, started_at, session_results(weighted_score, verdict, focus_areas, domains, created_at)',
    )
    .in('user_id', userIds)
  if (error) throw new Error(`clinical_sessions: ${error.message}`)

  for (const row of (data ?? []) as MarkRow[]) {
    const list = byUser.get(row.user_id) ?? []
    list.push(row)
    byUser.set(row.user_id, list)
  }
  return byUser
}

/** The one result row on a session, whichever shape PostgREST returned it in. */
function resultOf(row: MarkRow): SessionResultRow | null {
  const results = Array.isArray(row.session_results)
    ? row.session_results
    : row.session_results
      ? [row.session_results]
      : []
  return results[0] ?? null
}

function focusDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (entry as { domain?: unknown })?.domain)
    .filter((domain): domain is string => typeof domain === 'string')
}

function gradedDomains(value: unknown): { domain: string; grade?: string | null }[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => entry as { domain?: unknown; grade?: unknown })
    .filter((entry) => typeof entry?.domain === 'string')
    .map((entry) => ({ domain: entry.domain as string, grade: (entry.grade as string) ?? null }))
}

async function loadFirstNames(emails: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (emails.length === 0) return names
  // trial_leads is where the sign-up door writes the name people typed. An
  // account with no lead row is greeted as "there", which the templates handle.
  const { data, error } = await supabase.from('trial_leads').select('email, first_name')
  if (error) throw new Error(`trial_leads: ${error.message}`)
  for (const row of (data ?? []) as { email: string | null; first_name: string | null }[]) {
    const key = lower(row.email)
    if (!key || !row.first_name) continue
    if (!names.has(key)) names.set(key, row.first_name)
  }
  return names
}

/**
 * Addresses that have bought.
 *
 * Deliberately ANY `preorders` row, not only a live one: somebody whose plan
 * lapsed is a former customer, and "your five stations have ended" is not the
 * email they should receive. `preorders.email` comes from Stripe and is not
 * normalised, so the comparison is done here in lower case.
 */
async function loadBuyerEmails(): Promise<Set<string>> {
  const { data, error } = await supabase.from('preorders').select('email')
  if (error) throw new Error(`preorders: ${error.message}`)
  const buyers = new Set<string>()
  for (const row of (data ?? []) as { email: string | null }[]) {
    const key = lower(row.email)
    if (key) buyers.add(key)
  }
  return buyers
}

async function loadAlreadySent(): Promise<Map<string, TrialEmailKind[]>> {
  const { data, error } = await supabase.from('trial_email_sends').select('user_id, kind')
  if (error) {
    throw new Error(
      `trial_email_sends: ${error.message} — has supabase/migrations/20260906_trial_email_sends.sql been applied?`,
    )
  }
  const sent = new Map<string, TrialEmailKind[]>()
  for (const row of (data ?? []) as { user_id: string; kind: TrialEmailKind }[]) {
    const list = sent.get(row.user_id) ?? []
    list.push(row.kind)
    sent.set(row.user_id, list)
  }
  return sent
}

// ── Run ─────────────────────────────────────────────────────────────────────

const grants = await loadGrants()
const userIds = grants.map((grant) => grant.user_id)
const [freeStationIds, marksByUser, firstNames, buyers, alreadySent] = await Promise.all([
  loadFreeStationIds(),
  loadMarks(userIds),
  loadFirstNames(grants.map((grant) => lower(grant.email))),
  loadBuyerEmails(),
  loadAlreadySent(),
])
const freeStations = new Set(freeStationIds)

const candidates: TrialEmailCandidate[] = grants.map((grant) => {
  const marks: TrialMark[] = []
  const tried = new Set<string>()

  for (const row of marksByUser.get(grant.user_id) ?? []) {
    // Cases tried: any of the five they actually sat down to. `reading` is
    // written when the BRIEF loads, so it is not sitting a case.
    if (row.station_id && freeStations.has(row.station_id) && row.status !== 'reading') {
      tried.add(row.station_id)
    }

    const result = resultOf(row)
    const score = Number(result?.weighted_score)
    if (!result || !Number.isFinite(score) || score <= 0) continue

    marks.push({
      verdict: result.verdict ?? '',
      focusDomains: focusDomains(result.focus_areas),
      domains: gradedDomains(result.domains),
    })
  }

  const email = lower(grant.email)
  return {
    userId: grant.user_id,
    email,
    firstName: firstNames.get(email) ?? null,
    // The flag is the authority; the grant column is the fallback while
    // nothing carries it — the same rule computeTrialAccess applies.
    casesTotal: freeStationIds.length || Number(grant.allowance) || 5,
    casesTried: tried.size,
    windowDays: Number(grant.window_days) || 5,
    startedAt: grant.started_at ? new Date(grant.started_at) : null,
    expiresAt: grant.expires_at ? new Date(grant.expires_at) : null,
    marks,
    hasPurchase: buyers.has(email),
    alreadySent: alreadySent.get(grant.user_id) ?? [],
  }
})

const { due, skipped } = selectDueTrialEmails(candidates, NOW)

function build(row: (typeof due)[number]): RenderedEmail {
  if (row.kind === 'day3') {
    return buildTrialDay3Email({
      firstName: row.candidate.firstName,
      daysLeft: row.daysLeft,
      casesTried: row.casesTried,
      casesTotal: row.casesTotal,
      endsAt: row.endsAt,
      marks: row.candidate.marks,
      dashboardUrl: DASHBOARD_URL,
    })
  }
  return buildTrialDay5Email({
    firstName: row.candidate.firstName,
    marks: row.candidate.marks,
    casesTried: row.casesTried,
    casesTotal: row.casesTotal,
    dashboardUrl: DASHBOARD_URL,
  })
}

console.log(`trial emails · ${NOW.toISOString()} · ${ARMED ? 'SENDING' : 'DRY RUN'}`)
console.log(
  `${grants.length} started grants · ${freeStationIds.length} free cases · ${due.length} due · ${skipped.length} skipped`,
)
console.log('')

const bySkipReason = new Map<TrialEmailSkipReason, number>()
for (const row of skipped) {
  bySkipReason.set(row.reason, (bySkipReason.get(row.reason) ?? 0) + 1)
}
for (const [reason, count] of [...bySkipReason].sort((a, b) => b[1] - a[1])) {
  console.log(`  skipped · ${reason.padEnd(20)} ${count}`)
}
if (VERBOSE) {
  for (const row of skipped) console.log(`    ${row.candidate.email} — ${row.reason}`)
}
console.log('')

if (due.length === 0) {
  console.log('Nobody is due an email today.')
  process.exit(0)
}

let sent = 0
let failed = 0

for (const row of due) {
  const email = build(row)
  const marked = row.candidate.marks.length
  console.log(`${row.kind}  ${row.candidate.email}`)
  console.log(`      subject: ${email.subject}`)
  console.log(
    `      ${marked} marked · ${row.casesTried}/${row.casesTotal} cases tried · ${row.daysLeft} days left · window ends ${row.endsAt.toISOString().slice(0, 10)}`,
  )

  if (!ARMED) continue

  try {
    assertSendable(email, row.candidate.email)
  } catch (error: unknown) {
    failed += 1
    console.error(`      REFUSED: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }

  const result = await sendTrialEmail({
    kind: row.kind,
    toEmail: row.candidate.email,
    toName: row.candidate.firstName,
    email,
  })

  if (!result.sent) {
    failed += 1
    console.error(`      FAILED: ${'skipped' in result ? result.skipped : result.error}`)
    continue
  }

  sent += 1
  // Recorded AFTER the send, so a crash between the two re-sends rather than
  // silently swallowing an email nobody received. The unique (user_id, kind)
  // index is what stops that becoming a duplicate: a second insert fails and is
  // reported here rather than quietly mailing the person again.
  const { error } = await supabase.from('trial_email_sends').insert({
    user_id: row.candidate.userId,
    kind: row.kind,
    message_id: result.messageId,
  })
  if (error) {
    console.error(`      ⚠️ SENT but not recorded (${error.message}) — record it by hand`)
  } else {
    console.log(`      sent · ${result.messageId ?? 'no message id'}`)
  }
}

console.log('')
if (ARMED) {
  console.log(`sent ${sent} · failed ${failed}`)
} else {
  console.log(`DRY RUN — nothing was sent. ${due.length} would be.`)
  console.log('To send: TRIAL_EMAIL_SEND=1 ... --send --yes')
}

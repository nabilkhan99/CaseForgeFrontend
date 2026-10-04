import { resolveExam, type ExamTiming } from './exam'
import { isNeverALead } from './exclusions'
import { decideNextAction, type Heat, type LeadStanding } from './followUp'
import { heatScore, NO_SIGNALS, type Signals } from './heat'
import { phoneView, type PhoneView } from './phone'
import { practiceStats, type ResultRow, type SessionRow } from './stats'
import { londonToday } from './time'
import type { CallFacts, CallOutcome, CallPoint, CallRecord, NextAction, NextKind, NextSource } from './types'

/**
 * Raw rows in, one view per lead out. Pure, so the whole list can be checked
 * against fixtures; the database reads live in load.ts.
 *
 * Mirrors the customer-lead-report skill: a lead is a `trial_leads` email that
 * never became a customer, merged across sign-ups, minus our own and test
 * accounts. Leads who bought after being called stay on the list, closed as
 * Bought, so the caller sees the call paid off.
 */

export interface TrialLeadRow {
  email: string | null
  first_name: string | null
  phone: string | null
  training_stage: string | null
  sca_sitting: string | null
  created_at: string
  session_id: string | null
}
export interface GrantRow {
  user_id: string
  email: string | null
  started_at: string | null
  expires_at: string | null
}
export interface OrderRow {
  email: string | null
  status: string
}
export interface UserRow {
  id: string
  email: string | null
}
export interface ProfileRow {
  id: string
  exam_date: string | null
  full_name: string | null
}
export interface CallRow {
  id: string
  lead_email: string
  logged_by: string
  created_at: string
  source: 'prompt' | 'quick'
  outcome: CallOutcome
  raw_notes: string | null
  points: CallPoint[]
  facts: Partial<CallFacts>
  next_label: string | null
  next_kind: NextKind | null
  next_due: string | null
  next_source: NextSource | null
  model: string | null
}
export interface FollowupRow {
  lead_email: string
  label: string
  kind: NextKind
  due_at: string | null
  source: NextSource
  status: 'open' | 'closed'
  closed_reason: string | null
  why: string
  display_name: string | null
  exam_note: string | null
  exam_date: string | null
  exam_month: string | null
  updated_at: string
  updated_by: string
}
export interface OverrideRow {
  email: string
  kind: 'exclude' | 'merge' | 'name'
  merge_into: string | null
  display_name: string | null
}

/** Browsing data from PostHog: which browsers carry an email, and each browser's signals. */
export interface BrowsingData {
  pidsByEmail: ReadonlyMap<string, readonly string[]>
  byBrowser: ReadonlyMap<string, Signals>
}

export interface LeadSources {
  now: Date
  trialLeads: readonly TrialLeadRow[]
  grants: readonly GrantRow[]
  orders: readonly OrderRow[]
  users: readonly UserRow[]
  profiles: readonly ProfileRow[]
  sessions: readonly SessionRow[]
  results: readonly ResultRow[]
  calls: readonly CallRow[]
  followups: readonly FollowupRow[]
  overrides: readonly OverrideRow[]
  /** Null when PostHog is not configured or did not answer. */
  browsing: BrowsingData | null
}

export interface CallView {
  id: string
  at: string
  by: string
  source: 'prompt' | 'quick'
  outcome: CallOutcome
  points: CallPoint[]
  facts: Partial<CallFacts>
  rawNotes: string | null
  next: { label: string; dueAt: string | null; source: NextSource | null } | null
  model: string | null
}

export interface LeadView {
  email: string
  aliases: string[]
  name: string
  /** False when the name is only the email's local part. */
  nameKnown: boolean
  phone: PhoneView | null
  stage: string
  kind: 'trial' | 'free'
  trial: { endsAt: string; running: boolean } | null
  joinedAt: string
  exam: ExamTiming
  consultations: number
  passes: number
  best: number | null
  signals: Signals | null
  heat: Heat
  score: number
  why: string[]
  lastActivity: string | null
  calls: CallView[]
  next: NextAction
  bought: boolean
  notCandidate: boolean
}

const CUSTOMER_STATUSES: ReadonlySet<string> = new Set(['paid', 'refunded', 'canceled'])
const NOT_CANDIDATE_STAGES: ReadonlySet<string> = new Set(['not_in_training', 'other'])

const lower = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase()

function groupBy<T>(rows: readonly T[], key: (row: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    if (!k) continue
    const list = map.get(k)
    if (list) list.push(row)
    else map.set(k, [row])
  }
  return map
}

function titleCase(name: string): string {
  return name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

function firstValue(rows: readonly TrialLeadRow[], key: keyof TrialLeadRow): string | null {
  for (const row of rows) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/** Every browser tied to any of these emails, each counted once, summed. */
export function mergeSignals(browsing: BrowsingData, emails: readonly string[]): Signals {
  const pids = new Set(emails.flatMap((email) => browsing.pidsByEmail.get(email) ?? []))
  const rows = [...pids].map((pid) => browsing.byBrowser.get(pid)).filter((s): s is Signals => Boolean(s))
  return rows.reduce<Signals>(
    (acc, s) => ({
      pricingViews: acc.pricingViews + s.pricingViews,
      billingToggles: acc.billingToggles + s.billingToggles,
      checkoutStarts: acc.checkoutStarts + s.checkoutStarts,
      paywallHits: acc.paywallHits + s.paywallHits,
      guideViews: acc.guideViews + s.guideViews,
      casebankViews: acc.casebankViews + s.casebankViews,
      studyBudget: acc.studyBudget + s.studyBudget,
      portfolioCases: acc.portfolioCases + s.portfolioCases,
      guestSessions: acc.guestSessions + s.guestSessions,
      activeDays: Math.max(acc.activeDays, s.activeDays),
      lastSeen: !acc.lastSeen || (s.lastSeen && s.lastSeen > acc.lastSeen) ? s.lastSeen : acc.lastSeen,
    }),
    NO_SIGNALS,
  )
}

function callView(row: CallRow): CallView {
  return {
    id: row.id,
    at: row.created_at,
    by: row.logged_by,
    source: row.source,
    outcome: row.outcome,
    points: Array.isArray(row.points) ? row.points : [],
    facts: row.facts ?? {},
    rawNotes: row.raw_notes,
    next: row.next_label ? { label: row.next_label, dueAt: row.next_due, source: row.next_source } : null,
    model: row.model,
  }
}

function fromFollowup(row: FollowupRow): NextAction {
  return {
    label: row.label,
    kind: row.kind,
    dueAt: row.due_at,
    source: row.source,
    status: row.status,
    closedReason: row.closed_reason,
    why: row.why,
  }
}

const BOUGHT: NextAction = { label: 'Bought', kind: 'none', dueAt: null, source: 'rules', status: 'closed', closedReason: 'Bought', why: 'Became a customer' }

/** What the follow-up rules need to know about a lead. */
export function standingOf(lead: Pick<LeadView, 'heat' | 'notCandidate' | 'exam' | 'trial'>): LeadStanding {
  return {
    heat: lead.heat,
    notCandidate: lead.notCandidate,
    examDate: lead.exam.date,
    examSat: lead.exam.cls === 'sat',
    trialEndsAt: lead.trial ? new Date(lead.trial.endsAt) : null,
  }
}

interface Indexes {
  excluded: ReadonlySet<string>
  mergeInto: ReadonlyMap<string, string>
  names: ReadonlyMap<string, string>
  customers: ReadonlySet<string>
  paid: ReadonlySet<string>
  usersByEmail: ReadonlyMap<string, UserRow>
  grantsByUser: ReadonlyMap<string, GrantRow>
  grantsByEmail: ReadonlyMap<string, GrantRow>
  profiles: ReadonlyMap<string, ProfileRow>
  sessionsByUser: ReadonlyMap<string, SessionRow[]>
  sessionsById: ReadonlyMap<string, SessionRow>
  results: ReadonlyMap<string, ResultRow>
  callsByEmail: ReadonlyMap<string, CallRow[]>
  followups: ReadonlyMap<string, FollowupRow>
}

function index(src: LeadSources): Indexes {
  const overrides = (kind: OverrideRow['kind']) => src.overrides.filter((o) => o.kind === kind)
  return {
    excluded: new Set(overrides('exclude').map((o) => lower(o.email))),
    mergeInto: new Map(overrides('merge').map((o) => [lower(o.email), lower(o.merge_into)])),
    names: new Map(overrides('name').map((o) => [lower(o.email), o.display_name ?? ''])),
    customers: new Set(src.orders.filter((o) => CUSTOMER_STATUSES.has(o.status)).map((o) => lower(o.email))),
    paid: new Set(src.orders.filter((o) => o.status === 'paid').map((o) => lower(o.email))),
    usersByEmail: new Map(src.users.filter((u) => u.email).map((u) => [lower(u.email), u])),
    grantsByUser: new Map(src.grants.map((g) => [g.user_id, g])),
    grantsByEmail: new Map(src.grants.filter((g) => g.email).map((g) => [lower(g.email), g])),
    profiles: new Map(src.profiles.map((p) => [p.id, p])),
    sessionsByUser: groupBy(src.sessions, (s) => s.user_id),
    sessionsById: new Map(src.sessions.map((s) => [s.id, s])),
    results: new Map(src.results.map((r) => [r.session_id, r])),
    callsByEmail: groupBy(src.calls, (c) => lower(c.lead_email)),
    followups: new Map(src.followups.map((f) => [lower(f.lead_email), f])),
  }
}

/** trial_leads rows grouped under the email they belong to, with any second sign-ups. */
function groupLeadRows(src: LeadSources, ix: Indexes): Map<string, { aliases: Set<string>; rows: TrialLeadRow[] }> {
  const groups = new Map<string, { aliases: Set<string>; rows: TrialLeadRow[] }>()
  const ordered = [...src.trialLeads].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const row of ordered) {
    const email = lower(row.email)
    if (!email || isNeverALead(email) || ix.excluded.has(email)) continue
    const primary = ix.mergeInto.get(email) ?? email
    if (ix.excluded.has(primary)) continue
    const group = groups.get(primary) ?? { aliases: new Set<string>(), rows: [] }
    group.rows.push(row)
    if (email !== primary) group.aliases.add(email)
    groups.set(primary, group)
  }
  return groups
}

function displayName(email: string, rows: readonly TrialLeadRow[], ix: Indexes, profile: ProfileRow | undefined): { name: string; known: boolean } {
  const formName = firstValue(rows, 'first_name')
  const profileName = profile?.full_name?.trim().split(/\s+/)[0]
  const name =
    ix.names.get(email) ||
    ix.followups.get(email)?.display_name ||
    (formName && formName.length > 1 ? titleCase(formName) : null) ||
    (profileName ? titleCase(profileName) : null)
  return name ? { name, known: true } : { name: email.split('@')[0], known: false }
}

function buildLead(email: string, group: { aliases: Set<string>; rows: TrialLeadRow[] }, src: LeadSources, ix: Indexes): LeadView | null {
  const allEmails = [email, ...group.aliases]
  const calls = allEmails.flatMap((e) => ix.callsByEmail.get(e) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const bought = ix.customers.has(email)
  // A customer is not a lead, unless we called them first: then the list shows the win.
  if (bought && !(calls.length > 0 && ix.paid.has(email))) return null

  const { rows } = group
  const user = ix.usersByEmail.get(email)
  const grant = (user && ix.grantsByUser.get(user.id)) || ix.grantsByEmail.get(email)
  const profile = user ? ix.profiles.get(user.id) : undefined
  const guestIds = rows.map((r) => r.session_id).filter((id): id is string => Boolean(id))
  const sessions = new Map<string, SessionRow>()
  for (const s of user ? ix.sessionsByUser.get(user.id) ?? [] : []) sessions.set(s.id, s)
  for (const id of guestIds) {
    const s = ix.sessionsById.get(id)
    if (s) sessions.set(s.id, s)
  }
  const stats = practiceStats([...sessions.values()], ix.results)
  const signals = src.browsing ? mergeSignals(src.browsing, allEmails) : null
  // Repeat guest mocks from one browser tie only one session to the email.
  const consultations = !user && signals && signals.guestSessions > stats.consultations ? signals.guestSessions : stats.consultations

  const followup = ix.followups.get(email)
  const today = londonToday(src.now)
  const exam = resolveExam(today, {
    callDate: followup?.exam_date ?? null,
    callMonth: followup?.exam_month ?? null,
    profileDate: profile?.exam_date ?? null,
    sitting: firstValue(rows, 'sca_sitting'),
  })
  const stage = firstValue(rows, 'training_stage') ?? ''
  const notCandidate = NOT_CANDIDATE_STAGES.has(stage)
  const lastTimes = [stats.last?.getTime(), signals?.lastSeen ? Date.parse(signals.lastSeen) : undefined, Date.parse(rows[0].created_at)]
  const lastMs = Math.max(...lastTimes.filter((t): t is number => typeof t === 'number' && Number.isFinite(t)))
  const lastActivity = Number.isFinite(lastMs) ? new Date(lastMs) : null
  const heat = heatScore({
    now: src.now,
    exam,
    consultations,
    passes: stats.passes,
    activeDays: stats.activeDays,
    signals: signals ?? NO_SIGNALS,
    lastActivity,
    notCandidate,
  })
  const trial = grant?.expires_at ? { endsAt: grant.expires_at, running: Date.parse(grant.expires_at) > src.now.getTime() } : null
  const { name, known } = displayName(email, rows, ix, profile)

  const base = { heat: heat.heat, notCandidate, exam, trial }
  const records: CallRecord[] = calls.map((c) => ({ outcome: c.outcome, at: c.created_at }))
  const next = bought
    ? BOUGHT
    : followup
      ? fromFollowup(followup)
      : decideNextAction({ now: src.now, standing: standingOf(base), calls: records, suggested: null })

  return {
    email,
    aliases: [...group.aliases].sort(),
    name,
    nameKnown: known,
    phone: phoneView(firstValue([...rows].reverse(), 'phone')),
    stage: stage.toUpperCase().replace('GPST', 'ST'),
    kind: grant ? 'trial' : 'free',
    trial,
    joinedAt: rows[0].created_at,
    exam,
    consultations,
    passes: stats.passes,
    best: stats.best,
    signals,
    heat: heat.heat,
    score: heat.score,
    why: heat.why,
    lastActivity: lastActivity ? lastActivity.toISOString() : null,
    calls: calls.map(callView),
    next,
    bought,
    notCandidate,
  }
}

export function assembleLeads(src: LeadSources): LeadView[] {
  const ix = index(src)
  return [...groupLeadRows(src, ix).entries()]
    .map(([email, group]) => buildLead(email, group, src, ix))
    .filter((lead): lead is LeadView => lead !== null)
}

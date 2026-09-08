import type { SupabaseClient } from '@supabase/supabase-js'
import { visibleStationStates } from '@/lib/stations/visibility'

/**
 * The free trial: FIVE FIXED CASES, UNLIMITED ATTEMPTS, FIVE DAYS.
 *
 * Decided 7 September 2026, replacing "five marked consultations". The offer is
 * no longer a budget of consultations to spend carefully — it is a named
 * handful of the bank, open for a working week, and a trainee may run each of
 * them as many times as they like. What ends the trial is the calendar and
 * nothing else.
 *
 * WHY THE CHANGE MATTERS TO THIS FILE. Under an allowance, the trial was a
 * COUNT and the gate had no opinion about which case somebody opened; now it is
 * an ALLOWLIST, and the count is only ever a progress line on a dashboard. Two
 * consequences run through everything below:
 *   * the chokepoints must check the station id, which they did not before;
 *   * nothing derived from marking can refuse a consultation any more, so the
 *     "was it genuinely marked" rule that used to decide the cap is gone from
 *     the enforcement path entirely (it survives only as a checkout analytics
 *     property — see {@link countTrialConsumption}).
 *
 * Deliberately a peer of {@link import('./entitlements').Entitlement}, for the
 * same reason {@link import('./cohortAccess').CohortAccess} is one: a grant has
 * no tier and no money behind it, so folding it into the `preorders` precedence
 * ladder would mean teaching every rule on that ladder about a row shape that
 * does not exist — and, worse, would put the trial inside the fold where a bug
 * could let an ENDED trial outrank a live purchase. `decideAccess` composes the
 * two instead, and consults the grant only when there is no purchase.
 * `computeEntitlement` never sees it.
 */

/**
 * How many cases a grant is worth when the bank has not said otherwise.
 *
 * The AUTHORITY is `stations.is_free_trial` — the five rows carrying the flag,
 * in `free_trial_order`. This is the fallback used for the "X of N" progress
 * line while nothing at all is flagged, and it is what `grantTrial` writes into
 * the row's `allowance` column. It no longer caps anything.
 */
export const TRIAL_ALLOWANCE = 5

/** Days the window runs from the first consultation, unless the row says otherwise. */
export const TRIAL_WINDOW_DAYS = 5

/**
 * How long a started consultation is treated as still running, for the
 * one-at-a-time rule below.
 *
 * Longer than any station (12 minutes at most) plus the marking that follows it
 * (~90 seconds), so a genuine consultation is never cut short by it — and short
 * enough that a browser that crashed mid-consultation frees the slot in a
 * quarter of an hour rather than stranding the trainee.
 */
export const TRIAL_OPEN_SESSION_MINUTES = 15

const DAY_MS = 86_400_000

/**
 * Session statuses that do NOT count as having tried a case.
 *
 * Only `reading`, which `create-session` writes when the station BRIEF is
 * opened. Opening a brief to read it is not an attempt, and counting it would
 * make the dashboard claim a trainee had tried a case they only glanced at.
 * Everything else — `live`, `processing`, `completed`, `abandoned`, `error`,
 * `unmarkable` — means a consultation was actually begun.
 */
const UNTRIED_STATUS = 'reading'

/** Which door a grant came through. Mirrors the CHECK on `trial_grants.source`. */
export type TrialSource = 'signup' | 'guest_reveal' | 'link' | 'cohort'

/** A `trial_grants` row, parsed. */
export interface TrialGrant {
  id: string
  userId: string
  email: string
  /**
   * The `allowance` column. Retained as the fallback for "how many cases is
   * this trial worth" while nothing is flagged; the flag is the authority.
   */
  allowance: number
  windowDays: number
  source: TrialSource
  /** Null until the first consultation. The clock is not running while it is. */
  startedAt: Date | null
  /** `startedAt + windowDays`, stamped in the same statement. */
  expiresAt: Date | null
  /** When the grant was made. */
  createdAt: Date
}

export type TrialState = 'trial' | 'trial_ended' | 'none'

/**
 * Why a trial stopped.
 *
 * ONE VALUE, and that is the whole point of the September rewrite: with
 * unlimited attempts there is no allowance to exhaust, so the only way a trial
 * ends is the five days running out. Kept as a union rather than dropped
 * because the wall, the emails and the `trial_wall_hit` event all carry it, and
 * a second reason (a revoked grant, say) is a plausible future.
 */
export type TrialEndReason = 'expiry'

/**
 * What a trial account has actually done with its five cases.
 *
 * DISPLAY ONLY. Nothing here can refuse a consultation — attempts are
 * unlimited — so unlike the allowance it replaced, an over-count is a wrong
 * number on a dashboard rather than a station somebody paid for and cannot sit.
 */
export interface TrialUsage {
  /** Distinct free-trial cases with at least one consultation begun. 0–5. */
  casesTried: number
  /** Consultations begun, per free-trial station id. Absent means none. */
  attemptsByStation: Record<string, number>
}

export const NO_USAGE: TrialUsage = Object.freeze({ casesTried: 0, attemptsByStation: {} })

export interface TrialAccess {
  state: TrialState
  /**
   * Cases TRIED of the five — not consultations, and no longer a spend.
   *
   * Kept under the old name because every consumer of this shape reads it, and
   * because "how far through the five are you" is still the question a
   * dashboard asks; only the unit changed. {@link TrialUsage.casesTried} is the
   * same number under a name that cannot be misread.
   */
  used: number
  /** Cases of the five not yet tried. Never negative. */
  remaining: number
  /**
   * How many cases the trial opens. The number of flagged stations when there
   * are any, and the grant's `allowance` column while there are not — so the
   * copy says "of five" rather than "of zero" in the window before anybody has
   * chosen them.
   */
  allowance: number
  windowDays: number
  startedAt: Date | null
  expiresAt: Date | null
  /**
   * THE FIVE, in `free_trial_order` — the whole of what this account may open.
   *
   * The gate itself, not a recommendation: {@link isStationOpenToTrial} is the
   * only thing standing between a trial account and two hundred cases of Azure
   * realtime minutes. Empty means the trial opens NOTHING, which is the
   * fail-closed reading and is deliberate — see {@link loadTrialAccess}.
   */
  freeStationIds: string[]
  /** Attempts so far on each of the five. Display only. */
  attemptsByStation: Record<string, number>
  reason?: TrialEndReason
}

/**
 * No grant at all. Frozen so a caller cannot poison every subsequent
 * no-trial user by mutating the shared object.
 */
export const NO_TRIAL: TrialAccess = Object.freeze({
  state: 'none',
  used: 0,
  remaining: 0,
  allowance: 0,
  windowDays: 0,
  startedAt: null,
  expiresAt: null,
  freeStationIds: Object.freeze([]) as unknown as string[],
  attemptsByStation: Object.freeze({}) as Record<string, number>,
})

/**
 * True when this station is one of the five.
 *
 * The one definition of "open to a trial account", shared by both server
 * chokepoints and both client surfaces that draw a lock, so a page can never
 * disagree with the endpoint about which cases exist for somebody.
 *
 * FALSE FOR AN EMPTY LIST, which is the fail-closed reading and the one that
 * matters: an empty list is what a missing flag, an unapplied migration or a
 * failed lookup all produce, and reading any of those as "everything is open"
 * would hand the whole bank to every trial account.
 */
export function isStationOpenToTrial(
  stationId: string,
  freeStationIds: readonly string[],
): boolean {
  return freeStationIds.includes(stationId)
}

/**
 * Where a grant stands right now.
 *
 * Pure, and takes the usage and the flagged stations rather than fetching
 * them, so the edge middleware and the node route handlers can share one
 * definition while doing their own IO.
 *
 * A grant whose window never opened does not expire, however old it is: the
 * five days run from the first consultation, so a link handed out on Friday
 * does not quietly burn through the weekend. And a grant whose window IS open
 * stays live until `expiresAt` whatever the trainee has done — there is no
 * longer any way to use a trial up early.
 */
export function computeTrialAccess(
  grant: TrialGrant | null,
  usage: TrialUsage,
  freeStationIds: readonly string[] = [],
  now: Date = new Date(),
): TrialAccess {
  if (!grant) return NO_TRIAL

  const stationIds = [...freeStationIds]
  // The flag is the authority; the column is what keeps the copy sane in the
  // window before anybody has set the flag on anything.
  const allowance = stationIds.length > 0 ? stationIds.length : grant.allowance
  const used = Math.min(Math.max(0, usage.casesTried), allowance)

  // Derived rather than trusted. The migration's CHECK makes a half-written
  // pair impossible, but reading a missing expiry as "never expires" would be
  // an unlimited free trial, so the fallback computes it rather than shrugging.
  const expiresAt =
    grant.expiresAt ??
    (grant.startedAt ? new Date(grant.startedAt.getTime() + grant.windowDays * DAY_MS) : null)

  const base = {
    used,
    remaining: Math.max(0, allowance - used),
    allowance,
    windowDays: grant.windowDays,
    startedAt: grant.startedAt,
    expiresAt,
    freeStationIds: stationIds,
    attemptsByStation: usage.attemptsByStation,
  }

  // The only way out. Attempts cannot exhaust anything any more, so the five
  // days are the whole of what ends a trial.
  if (expiresAt && now >= expiresAt) return { ...base, state: 'trial_ended', reason: 'expiry' }
  return { ...base, state: 'trial' }
}

/** What a server chokepoint answers when an ENDED trial asks for a consultation. */
export interface TrialRefusal {
  error: 'trial_expired'
  trial: true
  /** Cases tried of the five, so the client can render the wall without a second fetch. */
  used: number
  remaining: number
  reason: TrialEndReason
}

/** What a chokepoint answers when a LIVE trial asks for a case outside its five. */
export interface TrialStationRefusal {
  error: 'trial_station_locked'
  trial: true
  /** The five, so a client can offer one instead of a dead end. */
  freeStationIds: string[]
}

/**
 * The refusal body for a trial whose five days are up, or null when the trial
 * is not the reason access was refused.
 *
 * Null for `state: 'none'` as well as for a live trial: somebody with no grant
 * and no purchase is refused with the existing `no_active_plan`, which is what
 * the "see plans" prompts already key off.
 */
export function trialRefusal(trial: TrialAccess | null): TrialRefusal | null {
  if (!trial || trial.state !== 'trial_ended') return null
  return {
    error: 'trial_expired',
    trial: true,
    used: trial.used,
    remaining: trial.remaining,
    reason: 'expiry',
  }
}

/**
 * The refusal body for a live trial reaching for a case outside its five, or
 * null when there is nothing to refuse.
 *
 * Only ever fires for an account whose access rests on the grant ALONE — the
 * caller passes `trialOnly`, exactly as the cohort check does, so a trialist
 * who has since bought is never narrowed to five cases by a grant they are no
 * longer using.
 */
export function trialStationRefusal(
  trial: TrialAccess | null,
  stationId: string,
): TrialStationRefusal | null {
  if (!trial || trial.state !== 'trial') return null
  if (isStationOpenToTrial(stationId, trial.freeStationIds)) return null
  return { error: 'trial_station_locked', trial: true, freeStationIds: trial.freeStationIds }
}

/**
 * Postgres / PostgREST codes for "this relation is not there yet".
 *
 * `PGRST205` is PostgREST's own "table not in the schema cache"; `42P01` and
 * `42703` are Postgres's undefined_table and undefined_column.
 */
const MISSING_RELATION_CODES: ReadonlySet<string> = new Set(['PGRST205', '42P01', '42703'])

/**
 * True when the failure is simply that a relation or column has not been
 * created yet.
 *
 * This is a REAL, EXPECTED state, not a defensive flourish: migrations are
 * applied by hand after the merge (see the build plan's phase 3), so there is a
 * window in which every deployment is running this code against a database
 * without `trial_grants` or without `stations.free_trial_order`. Without this
 * branch that window produces one console.error per entitlement check — which
 * is every navigation into a consultation and every navbar poll of
 * /api/subscription — and drowns the log that would show a real problem.
 */
function isMissingRelation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && MISSING_RELATION_CODES.has(code)
}

/** The `trial_grants` shape PostgREST returns. */
interface TrialGrantRow {
  id: string
  user_id: string
  email: string
  allowance: number
  window_days: number
  source: string
  started_at: string | null
  expires_at: string | null
  created_at: string
}

const GRANT_COLUMNS =
  'id, user_id, email, allowance, window_days, source, started_at, expires_at, created_at'

function parseGrant(row: TrialGrantRow): TrialGrant {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    // Defaults rather than NaN if a column ever comes back null: a grant that
    // exists must be worth something, and zero would silently wall the user.
    allowance: Number(row.allowance) || TRIAL_ALLOWANCE,
    windowDays: Number(row.window_days) || TRIAL_WINDOW_DAYS,
    source: row.source as TrialSource,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    createdAt: new Date(row.created_at),
  }
}

/**
 * The signed-in user's grant, or null.
 *
 * FAILS CLOSED, like `loadCohortAccess` and unlike the purchase read beside it.
 * The asymmetry is deliberate: a broken `preorders` read locks out people who
 * have paid, so it fails open loudly; a broken `trial_grants` read only means a
 * trialist meets the paywall for a few minutes, and failing open would hand a
 * free trial to every signed-in account — which is real money in Azure realtime
 * minutes, not a cosmetic error.
 *
 * Takes the caller's client rather than making one, because its callers run in
 * different runtimes: the edge middleware's request-scoped client, and
 * `getServerEntitlement`'s cookie-scoped one. The "read own trial grant" policy
 * scopes both; the explicit `user_id` filter is belt-and-braces on top.
 */
export async function loadTrialGrant(
  supabase: SupabaseClient,
  userId: string,
): Promise<TrialGrant | null> {
  try {
    const { data, error } = await supabase
      .from('trial_grants')
      .select(GRANT_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    return data ? parseGrant(data as TrialGrantRow) : null
  } catch (error: unknown) {
    // Loud, EXCEPT while the table simply does not exist yet.
    if (!isMissingRelation(error)) {
      console.error('[trial] grant lookup failed — no trial access', error)
    }
    return null
  }
}

/**
 * The five cases a trial opens, in the order they should be offered.
 *
 * `stations.is_free_trial` ordered by `free_trial_order`. WHICH five is a
 * product decision made in the database, not in code — the flag is set by hand
 * once Ishaq has chosen the pairs — so nothing here may assume a count or an
 * id. Whatever carries the flag is the trial.
 *
 * THROWS rather than returning an empty list on failure, because the two
 * outcomes mean opposite things to the caller and only one of them is safe to
 * assume: an empty list is a legitimate answer ("nobody has flagged anything
 * yet") that locks the trial to nothing, and a thrown error must be able to
 * reach {@link loadTrialAccess}'s own fail-closed branch and be logged there
 * rather than silently becoming the same lock-out for a different reason.
 *
 * Nulls sort last so a flagged station nobody has ordered yet still appears —
 * after the ordered ones — rather than jumping the queue or vanishing.
 *
 * `visibleStationStates()` rather than a bare `is_active = true`, so this
 * agrees with `getStationIndex` — the query the library and the dashboard panel
 * build their lists from. Without it a flagged-but-staged station would be
 * openable at the chokepoints and invisible on every surface that offers cases,
 * which is a case a trainee could only reach by guessing a URL.
 */
export async function loadFreeTrialStationIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('stations')
    .select('id, free_trial_order')
    .eq('is_free_trial', true)
    .in('is_active', visibleStationStates())
    .order('free_trial_order', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => (row as { id: string }).id)
}

/** One `clinical_sessions` row, as the usage query returns it. */
interface TrialSessionRow {
  station_id: string | null
  status: string | null
}

/**
 * How far through the five this account is, and how many goes it has had at
 * each.
 *
 * DERIVED, NEVER A COUNTER, exactly as the old allowance count was — but with
 * two rules changed by the September decision:
 *
 *   * MARKING NO LONGER DECIDES. The old count required a `session_results`
 *     row with a positive score, because a station was "spent" only when it
 *     produced a mark. Nothing is spent now, so the honest question is "did
 *     they sit down to this case", which is a session in any status but
 *     `reading`. That also means the dashboard updates the moment somebody
 *     starts, rather than ninety seconds after they finish.
 *   * NO GRANT FLOOR. The old count ignored sessions that predated the grant,
 *     so an allowance could not be eaten by history. With nothing to eat, a
 *     guest consultation claimed into the account at sign-up is simply a case
 *     they have tried, and hiding it would under-report their own progress
 *     back to them.
 *
 * Scoped to the five station ids, so the row set is a handful however long
 * somebody has had the account.
 *
 * Throws on failure. The caller decides what an unknown count means; see
 * {@link loadTrialAccess}.
 */
export async function countTrialUsage(
  supabase: SupabaseClient,
  userId: string,
  freeStationIds: readonly string[],
): Promise<TrialUsage> {
  if (freeStationIds.length === 0) return { casesTried: 0, attemptsByStation: {} }

  const { data, error } = await supabase
    .from('clinical_sessions')
    .select('station_id, status')
    .eq('user_id', userId)
    .in('station_id', [...freeStationIds])
    .neq('status', UNTRIED_STATUS)
  if (error) throw error

  const attemptsByStation: Record<string, number> = {}
  for (const row of (data ?? []) as TrialSessionRow[]) {
    const stationId = row.station_id
    if (!stationId) continue
    attemptsByStation[stationId] = (attemptsByStation[stationId] ?? 0) + 1
  }
  return { casesTried: Object.keys(attemptsByStation).length, attemptsByStation }
}

/** One `clinical_sessions` row with its mark, as PostgREST returns the embed. */
interface TrialConsumptionRow {
  id: string
  session_results:
    | { weighted_score: number | string | null }
    | { weighted_score: number | string | null }[]
    | null
}

/**
 * How many consultations this account has had GENUINELY MARKED since the grant.
 *
 * NOT A CAP AND NOT A GATE — that is what it used to be, and it is now one
 * thing only: the `trial_stations_used` property on the buy-path events (see
 * app/api/checkout/route.ts), which answers "how much had they actually done
 * when they decided to pay". Nothing here can refuse a consultation.
 *
 * Kept on the old rule — a distinct session carrying a `session_results` row
 * with `weighted_score > 0`, started on or after the grant — precisely because
 * it is an analytics series: changing what it counts halfway through would make
 * the numbers before and after the change incomparable.
 *
 * Throws rather than returning a number on failure; the caller decides.
 */
export async function countTrialConsumption(
  supabase: SupabaseClient,
  userId: string,
  since: Date,
): Promise<number> {
  const { data, error } = await supabase
    .from('clinical_sessions')
    .select('id, session_results(weighted_score)')
    .eq('user_id', userId)
    .gte('started_at', since.toISOString())
  if (error) throw error

  // The score is filtered HERE rather than as a `.gt()` on the embed, matching
  // lib/supabase/queries/development.ts and passTracking.ts. Not a stylistic
  // choice: `weighted_score` is typed `number | string | null` throughout this
  // codebase because PostgREST can hand a numeric back as a string, and a
  // server-side `gt.0` on a string column is a lexicographic comparison.
  const spent = new Set<string>()
  for (const row of (data ?? []) as TrialConsumptionRow[]) {
    const results = Array.isArray(row.session_results)
      ? row.session_results
      : row.session_results
        ? [row.session_results]
        : []
    const scored = results.some((result) => {
      const score = Number(result?.weighted_score)
      return Number.isFinite(score) && score > 0
    })
    if (scored) spent.add(row.id)
  }
  return spent.size
}

/**
 * The whole trial picture for a user: the grant, the five, and how far through
 * them they are.
 *
 * Three round trips at most, and two of them only for people who actually have
 * a grant — the station and usage reads are skipped entirely when there is
 * none, which is everybody who has bought and everybody who has not been
 * offered a trial. That matters: this runs inside the entitlement path, which
 * is on every navigation into a consultation and every navbar poll of
 * `/api/subscription`.
 *
 * FAILS CLOSED TO AN EMPTY ALLOWLIST. If the flagged stations cannot be read,
 * the trial opens nothing rather than everything. The trainee sees an upsell on
 * every case until the read recovers, which is recoverable and loud; two
 * hundred cases of free Azure realtime minutes are neither.
 */
export async function loadTrialAccess(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<TrialAccess> {
  const grant = await loadTrialGrant(supabase, userId)
  if (!grant) return NO_TRIAL

  let freeStationIds: string[] = []
  try {
    freeStationIds = await loadFreeTrialStationIds(supabase)
  } catch (error: unknown) {
    // Quiet for the one failure that is an expected deploy state — the column
    // does not exist until the migration is applied — and loud for anything
    // else, because a trial that opens nothing is a support ticket.
    if (!isMissingRelation(error)) {
      console.error('[trial] free-station lookup failed — the trial opens nothing', error)
    }
    return computeTrialAccess(grant, NO_USAGE, [], now)
  }

  try {
    const usage = await countTrialUsage(supabase, userId, freeStationIds)
    return computeTrialAccess(grant, usage, freeStationIds, now)
  } catch (error: unknown) {
    // Unlike the allowlist above, an unknown usage count is COSMETIC: it is a
    // progress line, not a gate, so the trial stays open on its five cases and
    // the dashboard simply says nothing has been tried yet.
    console.error('[trial] usage count failed — reporting no cases tried', error)
    return computeTrialAccess(grant, NO_USAGE, freeStationIds, now)
  }
}

/**
 * Consultations this trialist already has running, other than `exceptSessionId`.
 *
 * WHY THIS SURVIVED THE REWRITE. It was built as a backstop for the allowance —
 * a mark lands ~90 seconds after a consultation, so five parallel mints could
 * all read the same low `used` and all be allowed — and the allowance is gone.
 * It stays because the reason underneath it did not change: a trial account is
 * free minutes on Azure's realtime API, and one person is one consultation at a
 * time. Without it, "unlimited attempts" is literally unlimited — a script
 * could hold fifty concurrent sessions on the same free station.
 *
 * `reading` is excluded on purpose. That status is written by `create-session`,
 * which the station BRIEF page calls — so counting it would mean a trainee who
 * opened three briefs to choose between them could not start any of them. Only
 * `live` and `processing` mean minutes are actually being spent or a mark is
 * pending.
 *
 * `exceptSessionId` keeps a reconnect working: the browser re-mints a key for
 * the SAME session after a dropped connection, and that must not be refused as
 * a second consultation.
 *
 * Returns 0 on failure rather than throwing — this is a cap on a rare abuse,
 * and failing it closed would refuse consultations to honest trainees over a
 * transient read.
 */
export async function countOpenTrialSessions(
  supabase: SupabaseClient,
  userId: string,
  exceptSessionId: string,
  now: Date = new Date(),
): Promise<number> {
  try {
    const since = new Date(now.getTime() - TRIAL_OPEN_SESSION_MINUTES * 60_000)
    const { data, error } = await supabase
      .from('clinical_sessions')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['live', 'processing'])
      .gte('started_at', since.toISOString())
      .neq('id', exceptSessionId)
    if (error) throw error
    return (data ?? []).length
  } catch (error: unknown) {
    console.error('[trial] open-session check failed — not enforcing one-at-a-time', error)
    return 0
  }
}

/**
 * Start the trial's five-day window on the first consultation, once.
 *
 * Shared by both server chokepoints rather than living in one of them.
 * `create-session` is where the first consultation normally begins, but
 * `realtime-token` is independently reachable — it inserts a session row of its
 * own when it does not find one — and a client that only ever called that
 * endpoint would spend Azure minutes against a grant whose clock never started,
 * which is a five-day window that never ends. Calling it from both is free
 * because the stamp is a compare-and-set.
 *
 * The grant is re-read with the SERVICE-ROLE client rather than reusing the one
 * the entitlement path already loaded, for two reasons: `trial_grants` has no
 * write policy at all, so the user's own client cannot update it; and the
 * `started_at` that read saw is a snapshot a concurrent request may already
 * have moved.
 *
 * Only for accounts running on the grant alone — somebody who has bought is not
 * spending a trial, and starting their clock would put a countdown on a
 * dashboard that has a plan on it.
 *
 * Never throws: a consultation must not fail to start because a clock could not
 * be written.
 */
export async function startTrialWindowFor(
  admin: SupabaseClient,
  trialOnly: boolean,
  userId: string,
): Promise<void> {
  if (!trialOnly) return
  try {
    const grant = await loadTrialGrant(admin, userId)
    if (grant && !grant.startedAt) await startTrialWindow(admin, grant)
  } catch (error: unknown) {
    console.error('[trial] could not start the window', error)
  }
}

export interface GrantTrialInput {
  userId: string
  email: string
  source: TrialSource
  /** Override the default, for a hand-made grant. Defaults to {@link TRIAL_ALLOWANCE}. */
  allowance?: number
  /** Override the five days. Defaults to {@link TRIAL_WINDOW_DAYS}. */
  windowDays?: number
}

/**
 * Give an account the trial, once.
 *
 * IDEMPOTENT ON `user_id`, and that is the whole contract: three doors call it
 * (sign-up, guest reveal, signed link) and the same person can arrive through
 * more than one of them — a lead who opens their link, then signs up. A second
 * call must be a no-op, not a second trial and certainly not a reset clock.
 * `on conflict do nothing` plus an unconditional read-back gives the caller the
 * grant that is actually in the table, new or pre-existing, so nothing
 * downstream has to care which happened.
 *
 * Needs a service-role client: `trial_grants` has no write policy at all (RLS
 * on, deny-all), so a user cannot mint themselves a grant or reset their own
 * window.
 */
export async function grantTrial(
  admin: SupabaseClient,
  input: GrantTrialInput,
): Promise<TrialGrant | null> {
  const email = input.email.trim().toLowerCase()
  try {
    const { error } = await admin.from('trial_grants').upsert(
      {
        user_id: input.userId,
        // Lower-cased before it reaches the CHECK constraint, not after it
        // fails. Same rule as `cohorts.trainer_email`.
        email,
        source: input.source,
        allowance: input.allowance ?? TRIAL_ALLOWANCE,
        window_days: input.windowDays ?? TRIAL_WINDOW_DAYS,
      },
      // `ignoreDuplicates` is `on conflict do nothing`: an existing grant keeps
      // its source, its allowance and — critically — its `started_at`.
      { onConflict: 'user_id', ignoreDuplicates: true },
    )
    if (error) throw error

    const { data, error: readError } = await admin
      .from('trial_grants')
      .select(GRANT_COLUMNS)
      .eq('user_id', input.userId)
      .maybeSingle()
    if (readError) throw readError
    return data ? parseGrant(data as TrialGrantRow) : null
  } catch (error: unknown) {
    console.error('[trial] grant failed', error)
    return null
  }
}

/**
 * Start the five-day clock, exactly once.
 *
 * ATOMIC BY CONSTRUCTION. This is one conditional UPDATE —
 * `set started_at = ?, expires_at = ? where user_id = ? and started_at is null`
 * — not a read followed by a write. Two concurrent `create-session` calls both
 * issue it; Postgres serialises them on the row lock, and the second
 * re-evaluates the predicate against the committed version, matches no rows,
 * and changes nothing. So a second call cannot extend the window, and the
 * trainee's five days always run from the first consultation they actually
 * started.
 *
 * `expires_at` is written here rather than computed on read so that editing
 * `window_days` later cannot move a window somebody was already told about.
 *
 * MORE LOAD-BEARING THAN IT WAS. Under the allowance the clock was one of two
 * ways a trial could end; it is now the only one, so a window that fails to
 * start is a trial that never ends. It is still not worth failing a
 * consultation over — see the catch — but it is why both chokepoints call it.
 *
 * Returns whether THIS call did the stamping. Never throws.
 */
export async function startTrialWindow(
  admin: SupabaseClient,
  grant: TrialGrant,
  now: Date = new Date(),
): Promise<boolean> {
  // Cheap early out for the overwhelmingly common case — every consultation
  // after the first — so the hot path does not issue a write that can only ever
  // match zero rows.
  if (grant.startedAt) return false

  const startedAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + grant.windowDays * DAY_MS).toISOString()

  try {
    const { data, error } = await admin
      .from('trial_grants')
      .update({ started_at: startedAt, expires_at: expiresAt })
      .eq('user_id', grant.userId)
      .is('started_at', null)
      .select('started_at')
    if (error) throw error
    return (data ?? []).length > 0
  } catch (error: unknown) {
    console.error('[trial] window stamp failed', error)
    return false
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The five-station free trial: five marked consultations, five days from the
 * first one, no card, in a real account.
 *
 * Deliberately a peer of {@link import('./entitlements').Entitlement}, for the
 * same reason {@link import('./cohortAccess').CohortAccess} is one: a grant has
 * no tier and no money behind it, so folding it into the `preorders` precedence
 * ladder would mean teaching every rule on that ladder about a row shape that
 * does not exist — and, worse, would put the trial inside the fold where a bug
 * could let a SPENT trial outrank a live purchase. `decideAccess` composes the
 * two instead, and consults the grant only when there is no purchase.
 * `computeEntitlement` never sees it.
 */

/** Stations a grant is worth, unless the row says otherwise. */
export const TRIAL_ALLOWANCE = 5

/** Days the window runs from the first consultation, unless the row says otherwise. */
export const TRIAL_WINDOW_DAYS = 5

const DAY_MS = 86_400_000

/** Which door a grant came through. Mirrors the CHECK on `trial_grants.source`. */
export type TrialSource = 'signup' | 'guest_reveal' | 'link' | 'cohort'

/** A `trial_grants` row, parsed. */
export interface TrialGrant {
  id: string
  userId: string
  email: string
  allowance: number
  windowDays: number
  source: TrialSource
  /** Null until the first consultation. The clock is not running while it is. */
  startedAt: Date | null
  /** `startedAt + windowDays`, stamped in the same statement. */
  expiresAt: Date | null
  /**
   * When the grant was made — and therefore the floor on what counts against
   * it. A lead's old anonymous free mock predates their grant and is history,
   * which is the product decision, not an accident of the query.
   */
  createdAt: Date
}

export type TrialState = 'trial' | 'trial_ended' | 'none'

/** Why a trial stopped. Decides which sentence the wall leads with. */
export type TrialEndReason = 'allowance' | 'expiry'

export interface TrialAccess {
  state: TrialState
  /** Genuinely-marked consultations counted against the grant. Never clamped — the truth. */
  used: number
  /** `allowance - used`, floored at zero. */
  remaining: number
  /** How many the grant was worth, so a caller can render "3 of 5 left". */
  allowance: number
  /**
   * How long the window runs once it opens. Carried so the dashboard strip can
   * say "5 stations · 5 days" before there is an `expiresAt` to read it off —
   * the alternative was hardcoding a 5 in the copy that a per-row override
   * would then contradict.
   */
  windowDays: number
  startedAt: Date | null
  expiresAt: Date | null
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
})

/**
 * Where a grant stands right now.
 *
 * Pure, and takes the count rather than fetching it, so the edge middleware and
 * the node route handlers can share one definition of "spent" while doing their
 * own IO. `markedSessionCount` is the derived consumption — see
 * {@link countTrialConsumption}.
 *
 * A grant whose window never opened does not expire, however old it is: the
 * five days run from the first consultation, so a link handed out on Friday
 * does not quietly burn through the weekend.
 */
export function computeTrialAccess(
  grant: TrialGrant | null,
  markedSessionCount: number,
  now: Date = new Date(),
): TrialAccess {
  if (!grant) return NO_TRIAL

  const used = Math.max(0, markedSessionCount)
  const remaining = Math.max(0, grant.allowance - used)

  // Derived rather than trusted. The migration's CHECK makes a half-written
  // pair impossible, but reading a missing expiry as "never expires" would be
  // an unlimited free trial, so the fallback computes it rather than shrugging.
  const expiresAt =
    grant.expiresAt ??
    (grant.startedAt ? new Date(grant.startedAt.getTime() + grant.windowDays * DAY_MS) : null)

  const base = {
    used,
    remaining,
    allowance: grant.allowance,
    windowDays: grant.windowDays,
    startedAt: grant.startedAt,
    expiresAt,
  }

  // Allowance is checked first on purpose. When both ran out, "you have used
  // your five stations" is the truthful and more useful sentence — and it is
  // the one the wall's copy is written for.
  if (remaining <= 0) return { ...base, state: 'trial_ended', reason: 'allowance' }
  if (expiresAt && now >= expiresAt) return { ...base, state: 'trial_ended', reason: 'expiry' }
  return { ...base, state: 'trial' }
}

/** What a server chokepoint answers when a spent trial asks for a consultation. */
export interface TrialRefusal {
  /** Distinct codes so the client can pick the right wall without guessing. */
  error: 'trial_allowance_used' | 'trial_expired'
  trial: true
  used: number
  remaining: number
  reason: TrialEndReason
}

/**
 * The refusal body for a trial that has ended, or null when the trial is not
 * the reason access was refused.
 *
 * Null for `state: 'none'` as well as for a live trial: somebody with no grant
 * and no purchase is refused with the existing `no_active_plan`, which is what
 * the "see plans" prompts already key off.
 */
export function trialRefusal(trial: TrialAccess | null): TrialRefusal | null {
  if (!trial || trial.state !== 'trial_ended') return null
  return {
    error: trial.reason === 'expiry' ? 'trial_expired' : 'trial_allowance_used',
    trial: true,
    used: trial.used,
    remaining: trial.remaining,
    reason: trial.reason ?? 'allowance',
  }
}

/**
 * Postgres / PostgREST codes for "this relation is not there yet".
 *
 * `PGRST205` is PostgREST's own "table not in the schema cache"; `42P01` and
 * `42703` are Postgres's undefined_table and undefined_column.
 */
const MISSING_RELATION_CODES: ReadonlySet<string> = new Set(['PGRST205', '42P01', '42703'])

/**
 * True when the failure is simply that `trial_grants` has not been created yet.
 *
 * This is a REAL, EXPECTED state, not a defensive flourish: the migration is
 * applied by hand after the merge (see the build plan's phase 3), so there is a
 * window in which every deployment is running this code against a database
 * without the table. Without this branch that window produces one console.error
 * per entitlement check — which is every navigation into a consultation and
 * every navbar poll of /api/subscription — and drowns the log that would show a
 * real problem. The outcome is identical either way (no grant, no trial); only
 * the noise differs.
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
 * free five-station grant to every signed-in account — which is real money in
 * Azure realtime minutes, not a cosmetic error.
 *
 * Takes the caller's client rather than making one, because its callers run in
 * different runtimes: the edge middleware's request-scoped client, and
 * `getServerEntitlement`'s cookie-scoped one. The "read own trial grant" policy
 * scopes both; the explicit `user_id` filter is belt-and-braces on top, exactly
 * as the purchase and cohort reads are.
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
    // Loud, EXCEPT while the table simply does not exist yet — a trialist
    // hitting the paywall reads as a billing bug and will be reported as one,
    // but "the migration has not been applied" is a known deploy state and
    // logging it on every gated navigation would bury the case that matters.
    if (!isMissingRelation(error)) {
      console.error('[trial] grant lookup failed — no trial access', error)
    }
    return null
  }
}

/**
 * How many of the five have actually been spent.
 *
 * DERIVED, NEVER A COUNTER. Distinct `clinical_sessions` for the user that
 * carry a `session_results` row with `weighted_score > 0` and that started on
 * or after the grant — the same "genuinely scored" rule
 * `lib/supabase/queries/passTracking.ts` applies everywhere else. Three things
 * fall out for free: a session too short to mark writes no result row and so
 * consumes nothing; a lead's old anonymous mock predates the grant and does not
 * count; and there is no counter to drift or reconcile.
 *
 * Throws rather than returning a number on failure, because "how many have they
 * used" has no safe default — a zero would be an unlimited trial. The caller
 * decides, and {@link loadTrialAccess} decides to fail closed.
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
  // server-side `gt.0` on a string column is a lexicographic comparison that
  // would quietly miscount somebody's stations. `Number(...)` is the one
  // definition of "genuinely scored" the rest of the product already uses.
  //
  // The row set this scans is bounded by "sessions since the grant" — single
  // digits for a five-station trial — so nothing is being paid for the safety.
  const spent = new Set<string>()
  for (const row of (data ?? []) as TrialConsumptionRow[]) {
    // A to-one embed in practice, but tolerated as an array too: which shape
    // PostgREST returns depends on the FK's uniqueness, and a schema change
    // there must not silently stop counting.
    const results = Array.isArray(row.session_results)
      ? row.session_results
      : row.session_results
        ? [row.session_results]
        : []
    const scored = results.some((result) => {
      const score = Number(result?.weighted_score)
      return Number.isFinite(score) && score > 0
    })
    // Distinct sessions, not rows: two result rows for one consultation must
    // never spend two stations.
    if (scored) spent.add(row.id)
  }
  return spent.size
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
 * The whole trial picture for a user: the grant, and what is left of it.
 *
 * Two round trips at most, and only for people who actually have a grant — the
 * count is skipped entirely when there is none, which is everybody who has
 * bought and everybody who has not been offered a trial. That matters: this
 * runs inside the entitlement path, which is on every navigation into a
 * consultation and every navbar poll of `/api/subscription`.
 */
export async function loadTrialAccess(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<TrialAccess> {
  const grant = await loadTrialGrant(supabase, userId)
  if (!grant) return NO_TRIAL

  try {
    const used = await countTrialConsumption(supabase, userId, grant.createdAt)
    return computeTrialAccess(grant, used, now)
  } catch (error: unknown) {
    // Fail closed, for the same reason the grant read does: an unknown count
    // must not become "nothing spent yet". The trialist sees the wall until the
    // read recovers, which is recoverable; unlimited free realtime minutes are
    // not.
    console.error('[trial] consumption count failed — treating the trial as spent', error)
    return {
      ...computeTrialAccess(grant, grant.allowance, now),
      state: 'trial_ended',
      reason: 'allowance',
    }
  }
}

export interface GrantTrialInput {
  userId: string
  email: string
  source: TrialSource
  /** Override the five, for a hand-made grant. Defaults to {@link TRIAL_ALLOWANCE}. */
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
 * call must be a no-op, not a second five stations and certainly not a reset
 * clock. `on conflict do nothing` plus an unconditional read-back gives the
 * caller the grant that is actually in the table, new or pre-existing, so
 * nothing downstream has to care which happened.
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
 * Returns whether THIS call did the stamping. Never throws: a consultation must
 * not fail to start because a clock could not be written.
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
    // Swallowed on purpose. The worst case is a trial whose clock never starts,
    // which is still capped at five stations by the derived count — a far
    // cheaper failure than refusing a consultation somebody is sitting down to.
    console.error('[trial] window stamp failed', error)
    return false
  }
}

import { describe, expect, it, vi } from 'vitest'
import {
  NO_TRIAL,
  TRIAL_ALLOWANCE,
  TRIAL_OPEN_SESSION_MINUTES,
  TRIAL_WINDOW_DAYS,
  computeTrialAccess,
  countOpenTrialSessions,
  countTrialConsumption,
  grantTrial,
  loadTrialAccess,
  loadTrialGrant,
  startTrialWindow,
  startTrialWindowFor,
  trialRefusal,
  type TrialGrant,
} from './trialAccess'
import { decideAccess, type AccessContext, type EntitlementRow } from './entitlements'

const NOW = new Date('2026-09-10T12:00:00Z')
const DAY = 86_400_000

function grant(over: Partial<TrialGrant> = {}): TrialGrant {
  return {
    id: 'grant-1',
    userId: 'user-1',
    email: 'gp@example.com',
    allowance: TRIAL_ALLOWANCE,
    windowDays: TRIAL_WINDOW_DAYS,
    source: 'signup',
    startedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-09-08T09:00:00Z'),
    ...over,
  }
}

/** A grant whose window opened `daysAgo` days before NOW. */
function started(daysAgo: number, over: Partial<TrialGrant> = {}): TrialGrant {
  const startedAt = new Date(NOW.getTime() - daysAgo * DAY)
  return grant({
    startedAt,
    expiresAt: new Date(startedAt.getTime() + TRIAL_WINDOW_DAYS * DAY),
    ...over,
  })
}

describe('computeTrialAccess', () => {
  it('reports no trial at all when there is no grant', () => {
    expect(computeTrialAccess(null, 0, NOW)).toEqual(NO_TRIAL)
  })

  it('is live and unstarted before the first consultation', () => {
    const access = computeTrialAccess(grant(), 0, NOW)
    expect(access.state).toBe('trial')
    expect(access.used).toBe(0)
    expect(access.remaining).toBe(5)
    expect(access.startedAt).toBeNull()
    expect(access.expiresAt).toBeNull()
    expect(access.reason).toBeUndefined()
  })

  it('does not expire a grant whose window never opened, however old', () => {
    // The five days run from the first consultation. Somebody handed a link in
    // September and opening it in December still gets five stations.
    const ancient = grant({ createdAt: new Date('2026-01-01T00:00:00Z') })
    expect(computeTrialAccess(ancient, 0, NOW).state).toBe('trial')
  })

  it('counts marked consultations against the allowance', () => {
    const access = computeTrialAccess(started(1), 2, NOW)
    expect(access.state).toBe('trial')
    expect(access.used).toBe(2)
    expect(access.remaining).toBe(3)
  })

  it('ends the trial when the allowance is spent', () => {
    const access = computeTrialAccess(started(1), 5, NOW)
    expect(access.state).toBe('trial_ended')
    expect(access.remaining).toBe(0)
    expect(access.reason).toBe('allowance')
  })

  it('clamps remaining at zero if more sessions were marked than granted', () => {
    // Two consultations finishing at once can both be marked; the count is
    // derived, so it can legitimately overshoot. It must not go negative and
    // read as "-1 left".
    const access = computeTrialAccess(started(1), 7, NOW)
    expect(access.used).toBe(7)
    expect(access.remaining).toBe(0)
    expect(access.state).toBe('trial_ended')
  })

  it('ends the trial when the window has passed, with stations left', () => {
    const access = computeTrialAccess(started(6), 2, NOW)
    expect(access.state).toBe('trial_ended')
    expect(access.remaining).toBe(3)
    expect(access.reason).toBe('expiry')
  })

  it('is still live on the last day of the window', () => {
    // Expiry is an instant, not a date: a trial started at noon on day 0 runs
    // until noon on day 5, and the four-and-a-bit-days-in case must not lose
    // its afternoon.
    expect(computeTrialAccess(started(4.5), 1, NOW).state).toBe('trial')
  })

  it('blames the allowance when both the stations and the days ran out', () => {
    // Deliberate: "you have used your five stations" is the truthful and more
    // useful sentence, and it is the one the wall's copy is written for.
    const access = computeTrialAccess(started(9), 5, NOW)
    expect(access.state).toBe('trial_ended')
    expect(access.reason).toBe('allowance')
  })

  it('derives the expiry from started_at when the stored one is missing', () => {
    // The migration's CHECK makes this pair impossible, but the code must not
    // read "no expiry" as "never expires" if a row ever arrives half-written.
    const startedAt = new Date(NOW.getTime() - 6 * DAY)
    const access = computeTrialAccess(grant({ startedAt, expiresAt: null }), 1, NOW)
    expect(access.state).toBe('trial_ended')
    expect(access.reason).toBe('expiry')
    expect(access.expiresAt?.toISOString()).toBe(new Date(startedAt.getTime() + 5 * DAY).toISOString())
  })

  it('honours a non-default allowance and window on the row', () => {
    const custom = grant({
      allowance: 2,
      windowDays: 30,
      startedAt: new Date(NOW.getTime() - 10 * DAY),
      expiresAt: new Date(NOW.getTime() + 20 * DAY),
    })
    expect(computeTrialAccess(custom, 1, NOW).remaining).toBe(1)
    expect(computeTrialAccess(custom, 2, NOW).state).toBe('trial_ended')
  })
})

describe('trialRefusal', () => {
  it('says nothing when the trial is live', () => {
    expect(trialRefusal(computeTrialAccess(grant(), 0, NOW))).toBeNull()
  })

  it('says nothing when there is no trial — the caller answers no_active_plan', () => {
    expect(trialRefusal(NO_TRIAL)).toBeNull()
  })

  it('distinguishes a spent allowance from an expired window', () => {
    expect(trialRefusal(computeTrialAccess(started(1), 5, NOW))?.error).toBe('trial_allowance_used')
    expect(trialRefusal(computeTrialAccess(started(6), 1, NOW))?.error).toBe('trial_expired')
  })

  it('carries the counts, so the client can render the wall without a second fetch', () => {
    const refusal = trialRefusal(computeTrialAccess(started(1), 5, NOW))
    expect(refusal).toMatchObject({ trial: true, used: 5, remaining: 0, reason: 'allowance' })
  })
})

describe('decideAccess with a trial', () => {
  /** The decision minus its `trial` field, for comparing two ways of saying "no grant". */
  const sansTrial = (d: ReturnType<typeof decideAccess>) => ({ ...d, trial: null })

  const ctx = (over: Partial<AccessContext> = {}): AccessContext => ({
    email: 'gp@example.com',
    admins: new Set<string>(),
    now: NOW,
    ...over,
  })

  const paid: EntitlementRow = {
    plan: 'self_study',
    status: 'paid',
    created_at: '2026-09-05T10:00:00Z',
  }

  it('lets a live grant through when there is no purchase', () => {
    const d = decideAccess([], ctx({ trial: computeTrialAccess(grant(), 0, NOW) }))
    expect(d.allowed).toBe(true)
    expect(d.trialOnly).toBe(true)
    expect(d.entitlement.state).toBe('none')
  })

  it('locks a spent trial out, exactly as a lapsed plan is locked out', () => {
    const d = decideAccess([], ctx({ trial: computeTrialAccess(started(1), 5, NOW) }))
    expect(d.allowed).toBe(false)
    expect(d.trialOnly).toBe(false)
    expect(d.trial?.state).toBe('trial_ended')
  })

  it('lets an active purchase outrank a spent trial', () => {
    // The property the peer shape exists to guarantee: the grant is not in the
    // fold, so no state it can reach subtracts from a purchase.
    const d = decideAccess([paid], ctx({ trial: computeTrialAccess(started(9), 5, NOW) }))
    expect(d.allowed).toBe(true)
    expect(d.entitlement.state).toBe('active')
    expect(d.trialOnly).toBe(false)
  })

  it('does not let a live trial change what an active purchase says', () => {
    const withTrial = decideAccess([paid], ctx({ trial: computeTrialAccess(grant(), 0, NOW) }))
    const without = decideAccess([paid], ctx())
    expect(withTrial.entitlement).toEqual(without.entitlement)
    expect(withTrial.trialOnly).toBe(false)
  })

  it('behaves exactly as before for a user with no grant', () => {
    // NO_TRIAL and an absent field are the same answer, so the `trial` field
    // itself is the one thing that legitimately differs between the two.
    expect(sansTrial(decideAccess([], ctx({ trial: NO_TRIAL })))).toEqual(
      sansTrial(decideAccess([], ctx())),
    )
  })

  it('never fires trialOnly and cohortOnly together — the trial wins while it is live', () => {
    const cohort = { id: 'c1', stationIds: [], trainerEmail: 'tpd@nhs.net' }
    const d = decideAccess([], ctx({ cohort, trial: computeTrialAccess(grant(), 0, NOW) }))
    expect(d.trialOnly).toBe(true)
    expect(d.cohortOnly).toBe(false)
    expect(d.allowed).toBe(true)
  })

  it('falls back to the cohort allowlist once the trial is spent', () => {
    const cohort = { id: 'c1', stationIds: ['s1'], trainerEmail: 'tpd@nhs.net' }
    const d = decideAccess([], ctx({ cohort, trial: computeTrialAccess(started(1), 5, NOW) }))
    expect(d.trialOnly).toBe(false)
    expect(d.cohortOnly).toBe(true)
    expect(d.allowed).toBe(true)
  })

  it('leaves the existing cohort pilot untouched when no grant exists', () => {
    const cohort = { id: 'c1', stationIds: ['s1'], trainerEmail: 'tpd@nhs.net' }
    const withNoTrial = sansTrial(decideAccess([], ctx({ cohort, trial: NO_TRIAL })))
    expect(withNoTrial).toEqual(sansTrial(decideAccess([], ctx({ cohort }))))
    expect(withNoTrial).toMatchObject({ allowed: true, cohortOnly: true, trialOnly: false })
  })

  it('does not let a trial narrow an admin bypass', () => {
    const d = decideAccess(
      [],
      ctx({ admins: new Set(['gp@example.com']), trial: computeTrialAccess(started(9), 5, NOW) }),
    )
    expect(d.allowed).toBe(true)
    expect(d.trialOnly).toBe(false)
  })
})

describe('grantTrial', () => {
  /**
   * The insert path is `upsert(..., ignoreDuplicates)` followed by an
   * unconditional read-back, so the caller always receives the grant that is
   * actually in the table — the new one, or the one that was already there.
   */
  function stubClient(existing: Record<string, unknown> | null) {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const maybeSingle = vi.fn().mockResolvedValue({
      data: existing ?? {
        id: 'grant-1',
        user_id: 'user-1',
        email: 'gp@example.com',
        allowance: 5,
        window_days: 5,
        source: 'signup',
        started_at: null,
        expires_at: null,
        created_at: '2026-09-08T09:00:00Z',
      },
      error: null,
    })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ upsert, select }))
    return { client: { from } as never, upsert, select, eq }
  }

  it('writes the grant and returns it', async () => {
    const { client, upsert } = stubClient(null)
    const result = await grantTrial(client, {
      userId: 'user-1',
      email: 'GP@Example.com',
      source: 'signup',
    })
    expect(result?.allowance).toBe(5)
    // Lower-cased before it reaches the CHECK constraint, not after it fails.
    expect(upsert.mock.calls[0][0]).toMatchObject({ email: 'gp@example.com', source: 'signup' })
    expect(upsert.mock.calls[0][1]).toMatchObject({ onConflict: 'user_id', ignoreDuplicates: true })
  })

  it('is idempotent: a second call returns the first grant, unmodified', async () => {
    const first = {
      id: 'grant-1',
      user_id: 'user-1',
      email: 'gp@example.com',
      allowance: 5,
      window_days: 5,
      source: 'guest_reveal',
      // Already half-spent: a second door must not reset the clock.
      started_at: '2026-09-09T09:00:00Z',
      expires_at: '2026-09-14T09:00:00Z',
      created_at: '2026-09-08T09:00:00Z',
    }
    const { client } = stubClient(first)
    const result = await grantTrial(client, {
      userId: 'user-1',
      email: 'gp@example.com',
      source: 'link',
    })
    expect(result?.source).toBe('guest_reveal')
    expect(result?.startedAt?.toISOString()).toBe('2026-09-09T09:00:00.000Z')
  })

  it('returns null rather than throwing when the write fails', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'nope' } })
    const from = vi.fn(() => ({ upsert }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(
      await grantTrial({ from } as never, {
        userId: 'user-1',
        email: 'gp@example.com',
        source: 'signup',
      }),
    ).toBeNull()
    spy.mockRestore()
  })
})

describe('startTrialWindow', () => {
  /**
   * Atomicity is the point: the stamp is a single conditional UPDATE
   * (`... where user_id = ? and started_at is null`). Two concurrent
   * create-sessions both issue it; Postgres serialises them on the row lock and
   * the second re-checks the predicate against the committed version, matches
   * nothing, and returns no rows. There is no read-then-write to lose.
   */
  interface Stamp {
    started_at: string
    expires_at: string
  }

  function stubUpdate(rows: Record<string, unknown>[]) {
    const select = vi.fn().mockResolvedValue({ data: rows, error: null })
    const is = vi.fn(() => ({ select }))
    const eq = vi.fn(() => ({ is }))
    const writes: Stamp[] = []
    const update = vi.fn((written: Stamp) => {
      writes.push(written)
      return { eq }
    })
    const from = vi.fn(() => ({ update }))
    return { client: { from } as never, update, writes, eq, is, select }
  }

  it('stamps started_at and expires_at together, five days apart', async () => {
    const { client, writes, is } = stubUpdate([{ started_at: NOW.toISOString() }])
    const stamped = await startTrialWindow(client, grant(), NOW)
    expect(stamped).toBe(true)
    expect(writes[0].started_at).toBe(NOW.toISOString())
    expect(writes[0].expires_at).toBe(new Date(NOW.getTime() + 5 * DAY).toISOString())
    // The compare-and-set predicate. Without it the second concurrent call
    // would overwrite the first's stamp and hand out five fresh days.
    expect(is).toHaveBeenCalledWith('started_at', null)
  })

  it('reports the loser of a race, and does not extend the window', async () => {
    const { client } = stubUpdate([])
    expect(await startTrialWindow(client, grant(), NOW)).toBe(false)
  })

  it('does not re-stamp a grant whose window is already open', async () => {
    const { client, update } = stubUpdate([])
    expect(await startTrialWindow(client, started(2), NOW)).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('swallows a failed stamp — a consultation must not die over a clock', async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } })
    const is = vi.fn(() => ({ select }))
    const eq = vi.fn(() => ({ is }))
    const update = vi.fn(() => ({ eq }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await startTrialWindow({ from: () => ({ update }) } as never, grant(), NOW)).toBe(false)
    spy.mockRestore()
  })
})

describe('countTrialConsumption', () => {
  /**
   * The rule the whole cap rests on: a station is spent when a consultation was
   * GENUINELY marked, which means a `session_results` row with a positive
   * weighted score — the same test lib/supabase/queries/passTracking.ts applies.
   * Everything the trial needs falls out of it: a session too short to mark
   * writes no result row and costs nothing, and an old anonymous mock predates
   * the grant and is filtered out by the query.
   */
  function stubSessions(rows: unknown[]) {
    const gte = vi.fn().mockResolvedValue({ data: rows, error: null })
    const eq = vi.fn(() => ({ gte }))
    const select = vi.fn(() => ({ eq }))
    return { client: { from: vi.fn(() => ({ select })) } as never, eq, gte }
  }

  const SINCE = new Date('2026-09-08T09:00:00Z')

  it('counts only consultations that were genuinely marked', async () => {
    const { client } = stubSessions([
      { id: 's1', session_results: { weighted_score: 6.5 } },
      // Never marked at all — a closed tab, or the unmarkable guard refusing a
      // 20-second session. Costs nothing, which is the product decision.
      { id: 's2', session_results: null },
      // Marked, but a zero-score artefact: the marking engine scoring an empty
      // transcript. Carries a verdict, and is not a consultation.
      { id: 's3', session_results: { weighted_score: 0 } },
      { id: 's4', session_results: { weighted_score: 3 } },
    ])
    expect(await countTrialConsumption(client, 'user-1', SINCE)).toBe(2)
  })

  it('reads a score PostgREST handed back as a string', async () => {
    // `weighted_score` is typed `number | string | null` across this codebase
    // for exactly this reason. A lexicographic comparison would be wrong here.
    const { client } = stubSessions([{ id: 's1', session_results: { weighted_score: '6.5' } }])
    expect(await countTrialConsumption(client, 'user-1', SINCE)).toBe(1)
  })

  it('spends one station for a session carrying two result rows', async () => {
    const { client } = stubSessions([
      { id: 's1', session_results: [{ weighted_score: 6.5 }, { weighted_score: 7 }] },
    ])
    expect(await countTrialConsumption(client, 'user-1', SINCE)).toBe(1)
  })

  it('asks only for sessions on or after the grant', async () => {
    // How a lead's old anonymous free mock stays history: it is never fetched.
    const { client, gte } = stubSessions([])
    await countTrialConsumption(client, 'user-1', SINCE)
    expect(gte).toHaveBeenCalledWith('started_at', SINCE.toISOString())
  })

  it('throws rather than guessing when the read fails', async () => {
    // "How many have they used" has no safe default — a zero would be an
    // unlimited trial. loadTrialAccess is what decides, and it fails closed.
    const gte = vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } })
    const eq = vi.fn(() => ({ gte }))
    const select = vi.fn(() => ({ eq }))
    await expect(
      countTrialConsumption({ from: () => ({ select }) } as never, 'user-1', SINCE),
    ).rejects.toBeTruthy()
  })
})

describe('loadTrialAccess', () => {
  it('walls the trialist when the count cannot be read', async () => {
    // Fails CLOSED. The trialist meets the wall until the read recovers, which
    // is recoverable; unlimited free Azure realtime minutes are not.
    const grantRow = {
      id: 'grant-1',
      user_id: 'user-1',
      email: 'gp@example.com',
      allowance: 5,
      window_days: 5,
      source: 'signup',
      started_at: null,
      expires_at: null,
      created_at: '2026-09-08T09:00:00Z',
    }
    const client = {
      from: (table: string) =>
        table === 'trial_grants'
          ? {
              select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: grantRow, error: null }) }) }),
            }
          : {
              select: () => ({
                eq: () => ({ gte: async () => ({ data: null, error: { message: 'down' } }) }),
              }),
            },
    } as never
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const access = await loadTrialAccess(client, 'user-1', NOW)

    expect(access.state).toBe('trial_ended')
    expect(access.remaining).toBe(0)
    spy.mockRestore()
  })

  it('reports no trial, and never runs the count, for somebody without a grant', async () => {
    const count = vi.fn()
    const client = {
      from: (table: string) =>
        table === 'trial_grants'
          ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
          : { select: count },
    } as never

    expect(await loadTrialAccess(client, 'user-1', NOW)).toEqual(NO_TRIAL)
    // The cost argument for putting this on the entitlement hot path: everybody
    // who has bought pays one indexed lookup and nothing more.
    expect(count).not.toHaveBeenCalled()
  })
})

describe('before the migration is applied', () => {
  /**
   * The migration is applied by hand after the merge, so there is a real window
   * in which this code runs against a database with no `trial_grants` table.
   * Everything must behave exactly as it did before the feature existed — and
   * quietly, because this path runs on every gated navigation and every navbar
   * poll, and one console.error per request would bury the failures that matter.
   */
  function stubMissingTable(code: string) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { code, message: 'nope' } })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    return { from: vi.fn(() => ({ select })) } as never
  }

  it.each(['PGRST205', '42P01'])('reports no trial, silently, for %s', async (code) => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await loadTrialGrant(stubMissingTable(code), 'user-1')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('still shouts about a failure that is not a missing table', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await loadTrialGrant(stubMissingTable('57014'), 'user-1')).toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('countOpenTrialSessions', () => {
  /**
   * The gap a derived count cannot see. Marking lands ~90 seconds after a
   * consultation that runs up to 12 minutes, so for a quarter of an hour a
   * started consultation contributes nothing to `used` — and N parallel mints
   * would all read the same low number and all be allowed. This is the check
   * that makes the cap hold in parallel as well as in sequence.
   */
  function stubOpen(rows: unknown[]) {
    const neq = vi.fn().mockResolvedValue({ data: rows, error: null })
    const cutoffs: string[] = []
    const gte = vi.fn((_column: string, value: string) => {
      cutoffs.push(value)
      return { neq }
    })
    const inFilter = vi.fn(() => ({ gte }))
    const eq = vi.fn(() => ({ in: inFilter }))
    const select = vi.fn(() => ({ eq }))
    return { client: { from: vi.fn(() => ({ select })) } as never, eq, inFilter, gte, neq, cutoffs }
  }

  it('counts only consultations that are actually running', async () => {
    const { client, inFilter } = stubOpen([{ id: 'other' }])
    expect(await countOpenTrialSessions(client, 'user-1', 'sess-1', NOW)).toBe(1)
    // `reading` is excluded on purpose: it is written when the station BRIEF is
    // opened, so counting it would stop a trainee who looked at three briefs
    // from starting any of them.
    expect(inFilter).toHaveBeenCalledWith('status', ['live', 'processing'])
  })

  it('excludes this session, so a reconnect is not a second consultation', async () => {
    const { client, neq } = stubOpen([])
    await countOpenTrialSessions(client, 'user-1', 'sess-1', NOW)
    expect(neq).toHaveBeenCalledWith('id', 'sess-1')
  })

  it('forgets a session that has been open too long to still be running', async () => {
    // A browser that crashed mid-consultation leaves a `live` row for ever.
    // Without the recency window that row would lock the trainee out of the
    // rest of their trial.
    const { client, cutoffs } = stubOpen([])
    await countOpenTrialSessions(client, 'user-1', 'sess-1', NOW)
    const since = new Date(cutoffs[0])
    expect((NOW.getTime() - since.getTime()) / 60_000).toBe(TRIAL_OPEN_SESSION_MINUTES)
    // Comfortably longer than a 12-minute station plus ~90s of marking.
    expect(TRIAL_OPEN_SESSION_MINUTES).toBeGreaterThan(13)
  })

  it('does not refuse an honest trainee when the check itself breaks', async () => {
    // Fails OPEN, unlike the allowance. This is a cap on a rare abuse, not the
    // allowance itself — which still holds — so a transient read must not stop
    // somebody sitting down to practise.
    const neq = vi.fn().mockResolvedValue({ data: null, error: { message: 'down' } })
    const gte = vi.fn(() => ({ neq }))
    const inFilter = vi.fn(() => ({ gte }))
    const eq = vi.fn(() => ({ in: inFilter }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(
      await countOpenTrialSessions({ from: () => ({ select: () => ({ eq }) }) } as never, 'u', 's', NOW),
    ).toBe(0)
    spy.mockRestore()
  })
})

describe('startTrialWindowFor', () => {
  function stubGrant(row: Record<string, unknown> | null) {
    const update = vi.fn(() => ({
      eq: () => ({ is: () => ({ select: async () => ({ data: [{}], error: null }) }) }),
    }))
    const select = vi.fn(() => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }))
    return { client: { from: vi.fn(() => ({ select, update })) } as never, update, select }
  }

  const UNSTARTED = {
    id: 'grant-1',
    user_id: 'user-1',
    email: 'gp@example.com',
    allowance: 5,
    window_days: 5,
    source: 'signup',
    started_at: null,
    expires_at: null,
    created_at: '2026-09-08T09:00:00Z',
  }

  it('stamps an unstarted grant', async () => {
    const { client, update } = stubGrant(UNSTARTED)
    await startTrialWindowFor(client, true, 'user-1')
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('does nothing at all for somebody who is not on a trial', async () => {
    // Not just "does not stamp": it must not even read. This runs on every
    // consultation start, for every customer.
    const { client, select, update } = stubGrant(UNSTARTED)
    await startTrialWindowFor(client, false, 'user-1')
    expect(select).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('leaves an already-open window alone', async () => {
    const { client, update } = stubGrant({ ...UNSTARTED, started_at: '2026-09-09T09:00:00Z', expires_at: '2026-09-14T09:00:00Z' })
    await startTrialWindowFor(client, true, 'user-1')
    expect(update).not.toHaveBeenCalled()
  })

  it('never throws — a consultation must not die over a clock', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      startTrialWindowFor({ from: () => { throw new Error('boom') } } as never, true, 'user-1'),
    ).resolves.toBeUndefined()
    spy.mockRestore()
  })
})

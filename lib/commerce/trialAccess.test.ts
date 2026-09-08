import { describe, expect, it, vi } from 'vitest'
import {
  NO_TRIAL,
  NO_USAGE,
  TRIAL_ALLOWANCE,
  TRIAL_OPEN_SESSION_MINUTES,
  TRIAL_WINDOW_DAYS,
  computeTrialAccess,
  countOpenTrialSessions,
  countTrialUsage,
  grantTrial,
  isStationOpenToTrial,
  loadFreeTrialStationIds,
  loadTrialAccess,
  loadTrialGrant,
  startTrialWindow,
  startTrialWindowFor,
  trialRefusal,
  trialStationRefusal,
  type TrialGrant,
  type TrialUsage,
} from './trialAccess'
import { decideAccess, type AccessContext, type EntitlementRow } from './entitlements'

/**
 * The trial, as it stands after 7 September 2026: FIVE FIXED CASES, UNLIMITED
 * ATTEMPTS, FIVE DAYS.
 *
 * The three properties every test below is really about:
 *   * a flagged case is open, and stays open however many times it is run;
 *   * an unflagged case is refused, including when the flagged list is empty
 *     (fail closed — an empty list is what a missing migration and a broken
 *     read both produce, and reading it as "everything" would give away the
 *     bank);
 *   * a purchase outranks the grant, in both directions and in every state.
 */

const NOW = new Date('2026-09-10T12:00:00Z')
const DAY = 86_400_000

/** The five, in `free_trial_order`. */
const FIVE = ['st-1', 'st-2', 'st-3', 'st-4', 'st-5']

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

/** Usage built from "this many goes at each of these cases". */
function usage(attempts: Record<string, number>): TrialUsage {
  return { casesTried: Object.keys(attempts).length, attemptsByStation: attempts }
}

describe('isStationOpenToTrial', () => {
  it('opens a flagged case', () => {
    expect(isStationOpenToTrial('st-3', FIVE)).toBe(true)
  })

  it('refuses one that is not flagged', () => {
    expect(isStationOpenToTrial('st-99', FIVE)).toBe(false)
  })

  it('refuses everything when nothing is flagged', () => {
    // FAIL CLOSED. An empty list is what an unapplied migration, an unset flag
    // and a failed lookup all produce; reading any of them as "no limit" would
    // hand two hundred cases of Azure realtime minutes to every trial account.
    expect(isStationOpenToTrial('st-1', [])).toBe(false)
  })
})

describe('computeTrialAccess', () => {
  it('reports no trial at all when there is no grant', () => {
    expect(computeTrialAccess(null, NO_USAGE, FIVE, NOW)).toEqual(NO_TRIAL)
  })

  it('is live and unstarted before the first consultation', () => {
    const access = computeTrialAccess(grant(), NO_USAGE, FIVE, NOW)
    expect(access.state).toBe('trial')
    expect(access.used).toBe(0)
    expect(access.remaining).toBe(5)
    expect(access.freeStationIds).toEqual(FIVE)
    expect(access.startedAt).toBeNull()
    expect(access.expiresAt).toBeNull()
    expect(access.reason).toBeUndefined()
  })

  it('does not expire a grant whose window never opened, however old', () => {
    // The five days run from the first consultation. Somebody handed a link in
    // September and opening it in December still gets five days.
    const ancient = grant({ createdAt: new Date('2026-01-01T00:00:00Z') })
    expect(computeTrialAccess(ancient, NO_USAGE, FIVE, NOW).state).toBe('trial')
  })

  it('counts CASES tried, not consultations', () => {
    // The heart of the new offer. Nine consultations across two cases is two
    // of the five tried — a trainee who runs one case eight times has not used
    // up anything, and the dashboard must not tell them they have.
    const access = computeTrialAccess(grant(), usage({ 'st-1': 8, 'st-2': 1 }), FIVE, NOW)
    expect(access.used).toBe(2)
    expect(access.remaining).toBe(3)
    expect(access.attemptsByStation).toEqual({ 'st-1': 8, 'st-2': 1 })
  })

  it('stays live with every case tried — there is nothing to exhaust', () => {
    // The behaviour that changed. Under the allowance this was `trial_ended`.
    const access = computeTrialAccess(
      started(1),
      usage({ 'st-1': 3, 'st-2': 2, 'st-3': 1, 'st-4': 1, 'st-5': 4 }),
      FIVE,
      NOW,
    )
    expect(access.state).toBe('trial')
    expect(access.used).toBe(5)
    expect(access.remaining).toBe(0)
    expect(access.reason).toBeUndefined()
  })

  it('ends the trial when the window has passed', () => {
    const access = computeTrialAccess(started(6), usage({ 'st-1': 2 }), FIVE, NOW)
    expect(access.state).toBe('trial_ended')
    expect(access.reason).toBe('expiry')
  })

  it('is still live on the last day of the window', () => {
    // Expiry is an instant, not a date: a trial started at noon on day 0 runs
    // until noon on day 5, and the four-and-a-bit-days-in case must not lose
    // its afternoon.
    expect(computeTrialAccess(started(4.5), NO_USAGE, FIVE, NOW).state).toBe('trial')
  })

  it('derives the expiry from started_at when the stored one is missing', () => {
    // The migration's CHECK makes this pair impossible, but the code must not
    // read "no expiry" as "never expires" if a row ever arrives half-written.
    const startedAt = new Date(NOW.getTime() - 6 * DAY)
    const access = computeTrialAccess(
      grant({ startedAt, expiresAt: null }),
      NO_USAGE,
      FIVE,
      NOW,
    )
    expect(access.state).toBe('trial_ended')
    expect(access.reason).toBe('expiry')
    expect(access.expiresAt?.toISOString()).toBe(
      new Date(startedAt.getTime() + 5 * DAY).toISOString(),
    )
  })

  it('takes the case count from the FLAG, not from the grant column', () => {
    // Whichever rows carry `is_free_trial` is the trial. A bank with three
    // flagged says "of 3" rather than promising a five that does not exist.
    const access = computeTrialAccess(grant(), usage({ 'st-1': 1 }), ['st-1', 'st-2', 'st-3'], NOW)
    expect(access.allowance).toBe(3)
    expect(access.remaining).toBe(2)
  })

  it('falls back to the grant column while nothing is flagged at all', () => {
    // The window between the deploy and Ishaq setting the flags. "0 of 0 cases
    // tried" is a worse thing to render than the number the grant was written
    // with — and the ACCESS is still closed, which is what matters.
    const access = computeTrialAccess(grant(), NO_USAGE, [], NOW)
    expect(access.allowance).toBe(5)
    expect(access.freeStationIds).toEqual([])
    expect(isStationOpenToTrial('st-1', access.freeStationIds)).toBe(false)
  })

  it('clamps cases tried to the number of cases there are', () => {
    // Cannot happen from countTrialUsage (it only counts the flagged five), but
    // a "6 of 5 cases tried" would be the dashboard visibly lying.
    const access = computeTrialAccess(grant(), { ...usage({ a: 1 }), casesTried: 9 }, FIVE, NOW)
    expect(access.used).toBe(5)
    expect(access.remaining).toBe(0)
  })

  it('honours a non-default window on the row', () => {
    // A hand-made grant with a longer window: ten days in, twenty still to run.
    const startedAt = new Date(NOW.getTime() - 10 * DAY)
    const custom = grant({
      windowDays: 30,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + 30 * DAY),
    })
    const access = computeTrialAccess(custom, NO_USAGE, FIVE, NOW)
    expect(access.state).toBe('trial')
    expect(access.windowDays).toBe(30)
  })
})

describe('trialRefusal', () => {
  it('says nothing when the trial is live', () => {
    expect(trialRefusal(computeTrialAccess(grant(), NO_USAGE, FIVE, NOW))).toBeNull()
  })

  it('says nothing when there is no trial — the caller answers no_active_plan', () => {
    expect(trialRefusal(NO_TRIAL)).toBeNull()
  })

  it('names expiry, the only way a trial ends now', () => {
    const refusal = trialRefusal(computeTrialAccess(started(6), usage({ 'st-1': 1 }), FIVE, NOW))
    expect(refusal).toMatchObject({
      error: 'trial_expired',
      trial: true,
      used: 1,
      remaining: 4,
      reason: 'expiry',
    })
  })
})

describe('trialStationRefusal', () => {
  const live = computeTrialAccess(grant(), NO_USAGE, FIVE, NOW)

  it('lets one of the five through', () => {
    expect(trialStationRefusal(live, 'st-2')).toBeNull()
  })

  it('refuses a case outside the five, and offers the five instead', () => {
    expect(trialStationRefusal(live, 'st-99')).toEqual({
      error: 'trial_station_locked',
      trial: true,
      freeStationIds: FIVE,
    })
  })

  it('refuses every case when nothing is flagged', () => {
    const nothingFlagged = computeTrialAccess(grant(), NO_USAGE, [], NOW)
    expect(trialStationRefusal(nothingFlagged, 'st-1')?.error).toBe('trial_station_locked')
  })

  it('says nothing for an ENDED trial — expiry is the refusal, not the station', () => {
    // Order matters at the chokepoints: somebody whose days are up must be sent
    // to the wall, not told this particular case is not one of their five.
    const ended = computeTrialAccess(started(6), NO_USAGE, FIVE, NOW)
    expect(trialStationRefusal(ended, 'st-99')).toBeNull()
  })

  it('says nothing when there is no trial at all', () => {
    expect(trialStationRefusal(NO_TRIAL, 'st-99')).toBeNull()
    expect(trialStationRefusal(null, 'st-99')).toBeNull()
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
    const d = decideAccess([], ctx({ trial: computeTrialAccess(grant(), NO_USAGE, FIVE, NOW) }))
    expect(d.allowed).toBe(true)
    expect(d.trialOnly).toBe(true)
    expect(d.entitlement.state).toBe('none')
  })

  it('keeps a live grant through however many attempts have been run', () => {
    const heavy = computeTrialAccess(
      started(1),
      usage({ 'st-1': 12, 'st-2': 9, 'st-3': 3, 'st-4': 1, 'st-5': 6 }),
      FIVE,
      NOW,
    )
    expect(decideAccess([], ctx({ trial: heavy })).allowed).toBe(true)
  })

  it('locks an expired trial out, exactly as a lapsed plan is locked out', () => {
    const d = decideAccess([], ctx({ trial: computeTrialAccess(started(6), NO_USAGE, FIVE, NOW) }))
    expect(d.allowed).toBe(false)
    expect(d.trialOnly).toBe(false)
    expect(d.trial?.state).toBe('trial_ended')
  })

  it('lets an active purchase outrank an expired trial', () => {
    // The property the peer shape exists to guarantee: the grant is not in the
    // fold, so no state it can reach subtracts from a purchase.
    const d = decideAccess([paid], ctx({ trial: computeTrialAccess(started(9), NO_USAGE, FIVE, NOW) }))
    expect(d.allowed).toBe(true)
    expect(d.entitlement.state).toBe('active')
    expect(d.trialOnly).toBe(false)
  })

  it('does not let a live trial change what an active purchase says', () => {
    const withTrial = decideAccess(
      [paid],
      ctx({ trial: computeTrialAccess(grant(), NO_USAGE, FIVE, NOW) }),
    )
    const without = decideAccess([paid], ctx())
    expect(withTrial.entitlement).toEqual(without.entitlement)
    // And crucially `trialOnly` is false, which is what stops the chokepoints
    // narrowing a paying customer to five cases.
    expect(withTrial.trialOnly).toBe(false)
  })

  it('behaves exactly as before for a user with no grant', () => {
    expect(sansTrial(decideAccess([], ctx({ trial: NO_TRIAL })))).toEqual(
      sansTrial(decideAccess([], ctx())),
    )
  })

  it('never fires trialOnly and cohortOnly together — the trial wins while it is live', () => {
    const cohort = { id: 'c1', stationIds: [], trainerEmail: 'tpd@nhs.net' }
    const d = decideAccess(
      [],
      ctx({ cohort, trial: computeTrialAccess(grant(), NO_USAGE, FIVE, NOW) }),
    )
    expect(d.trialOnly).toBe(true)
    expect(d.cohortOnly).toBe(false)
    expect(d.allowed).toBe(true)
  })

  it('falls back to the cohort allowlist once the trial expires', () => {
    const cohort = { id: 'c1', stationIds: ['s1'], trainerEmail: 'tpd@nhs.net' }
    const d = decideAccess(
      [],
      ctx({ cohort, trial: computeTrialAccess(started(6), NO_USAGE, FIVE, NOW) }),
    )
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
      ctx({
        admins: new Set(['gp@example.com']),
        trial: computeTrialAccess(grant(), NO_USAGE, FIVE, NOW),
      }),
    )
    expect(d.allowed).toBe(true)
    expect(d.trialOnly).toBe(false)
  })
})

describe('loadFreeTrialStationIds', () => {
  function stubStations(rows: unknown[], error: unknown = null) {
    const calls: { column: string; options: unknown }[] = []
    const chain: Record<string, unknown> = {}
    const order = vi.fn((column: string, options: unknown) => {
      calls.push({ column, options })
      return { ...chain, then: undefined }
    })
    // A thenable chain: `.order()` twice, then awaited.
    const second = { then: (fn: (v: unknown) => unknown) => fn({ data: rows, error }) }
    const first = { order: vi.fn(() => second) }
    const eq = vi.fn(() => ({ order: vi.fn(() => first) }))
    const select = vi.fn(() => ({ eq }))
    void order
    return { client: { from: vi.fn(() => ({ select })) } as never, eq, select }
  }

  it('returns the flagged stations, in order', async () => {
    const { client, eq } = stubStations([{ id: 'st-2' }, { id: 'st-1' }])
    expect(await loadFreeTrialStationIds(client)).toEqual(['st-2', 'st-1'])
    // The flag is the set. Nothing else selects the trial's cases.
    expect(eq).toHaveBeenCalledWith('is_free_trial', true)
  })

  it('throws rather than reporting an empty set when the read fails', async () => {
    // The two outcomes mean opposite things: an empty list is a real answer
    // that locks the trial to nothing, and a failure has to be able to reach
    // loadTrialAccess's own logging rather than being disguised as one.
    const { client } = stubStations([], { code: '42703', message: 'no column' })
    await expect(loadFreeTrialStationIds(client)).rejects.toBeTruthy()
  })
})

describe('countTrialUsage', () => {
  function stubSessions(rows: unknown[]) {
    const neq = vi.fn().mockResolvedValue({ data: rows, error: null })
    const inFilter = vi.fn(() => ({ neq }))
    const eq = vi.fn(() => ({ in: inFilter }))
    const select = vi.fn(() => ({ eq }))
    return { client: { from: vi.fn(() => ({ select })) } as never, eq, inFilter, neq, select }
  }

  it('counts distinct cases and attempts per case', async () => {
    const { client } = stubSessions([
      { station_id: 'st-1', status: 'completed' },
      { station_id: 'st-1', status: 'completed' },
      { station_id: 'st-3', status: 'abandoned' },
    ])
    expect(await countTrialUsage(client, 'user-1', FIVE)).toEqual({
      casesTried: 2,
      attemptsByStation: { 'st-1': 2, 'st-3': 1 },
    })
  })

  it('ignores a brief that was only opened', async () => {
    // `reading` is written by create-session when the BRIEF page loads.
    // Counting it would tell a trainee they had tried a case they glanced at.
    const { client, neq } = stubSessions([])
    await countTrialUsage(client, 'user-1', FIVE)
    expect(neq).toHaveBeenCalledWith('status', 'reading')
  })

  it('asks only about the five', async () => {
    const { client, inFilter } = stubSessions([])
    await countTrialUsage(client, 'user-1', FIVE)
    expect(inFilter).toHaveBeenCalledWith('station_id', FIVE)
  })

  it('does not query at all when nothing is flagged', async () => {
    const { client, select } = stubSessions([])
    expect(await countTrialUsage(client, 'user-1', [])).toEqual(NO_USAGE)
    expect(select).not.toHaveBeenCalled()
  })

  it('counts a session with no station id as nothing', async () => {
    const { client } = stubSessions([{ station_id: null, status: 'completed' }])
    expect((await countTrialUsage(client, 'user-1', FIVE)).casesTried).toBe(0)
  })

  it('throws rather than guessing when the read fails', async () => {
    const neq = vi.fn().mockResolvedValue({ data: null, error: { message: 'nope' } })
    const inFilter = vi.fn(() => ({ neq }))
    const eq = vi.fn(() => ({ in: inFilter }))
    await expect(
      countTrialUsage({ from: () => ({ select: () => ({ eq }) }) } as never, 'user-1', FIVE),
    ).rejects.toBeTruthy()
  })
})

/**
 * A Supabase client stub covering the three tables loadTrialAccess touches.
 * `stationsError` and `sessionsError` are how the fail-closed branches are
 * reached without a real database.
 */
function stubTrialClient(opts: {
  grantRow?: Record<string, unknown> | null
  stations?: { id: string }[]
  stationsError?: unknown
  sessions?: { station_id: string; status: string }[]
  sessionsError?: unknown
  onSessions?: () => void
}) {
  const grantRow =
    opts.grantRow === undefined
      ? {
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
      : opts.grantRow

  return {
    from: (table: string) => {
      if (table === 'trial_grants') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: grantRow, error: null }) }),
          }),
        }
      }
      if (table === 'stations') {
        const answer = { data: opts.stations ?? [], error: opts.stationsError ?? null }
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ order: () => ({ then: (fn: (v: unknown) => unknown) => fn(answer) }) }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              neq: async () => {
                opts.onSessions?.()
                return { data: opts.sessions ?? [], error: opts.sessionsError ?? null }
              },
            }),
          }),
        }),
      }
    },
  } as never
}

describe('loadTrialAccess', () => {
  it('assembles the grant, the five and the usage', async () => {
    const access = await loadTrialAccess(
      stubTrialClient({
        stations: FIVE.map((id) => ({ id })),
        sessions: [
          { station_id: 'st-1', status: 'completed' },
          { station_id: 'st-1', status: 'completed' },
        ],
      }),
      'user-1',
      NOW,
    )
    expect(access.state).toBe('trial')
    expect(access.freeStationIds).toEqual(FIVE)
    expect(access.used).toBe(1)
    expect(access.attemptsByStation).toEqual({ 'st-1': 2 })
  })

  it('opens NOTHING when the flagged stations cannot be read', async () => {
    // Fails CLOSED. A trialist meeting an upsell on every case is recoverable
    // and loud; two hundred cases of free Azure realtime minutes are neither.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const access = await loadTrialAccess(
      stubTrialClient({ stationsError: { message: 'down' } }),
      'user-1',
      NOW,
    )
    expect(access.state).toBe('trial')
    expect(access.freeStationIds).toEqual([])
    expect(isStationOpenToTrial('st-1', access.freeStationIds)).toBe(false)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('keeps the five open when only the PROGRESS count fails', async () => {
    // The other side of the same coin: usage is a line of copy, not a gate, so
    // failing it closed would refuse practice over a cosmetic read.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const access = await loadTrialAccess(
      stubTrialClient({
        stations: FIVE.map((id) => ({ id })),
        sessionsError: { message: 'down' },
      }),
      'user-1',
      NOW,
    )
    expect(access.state).toBe('trial')
    expect(access.freeStationIds).toEqual(FIVE)
    expect(access.used).toBe(0)
    spy.mockRestore()
  })

  it('reports no trial, and reads nothing else, for somebody without a grant', async () => {
    const onSessions = vi.fn()
    const access = await loadTrialAccess(
      stubTrialClient({ grantRow: null, onSessions }),
      'user-1',
      NOW,
    )
    // The cost argument for putting this on the entitlement hot path: everybody
    // who has bought pays one indexed lookup and nothing more.
    expect(access).toEqual(NO_TRIAL)
    expect(onSessions).not.toHaveBeenCalled()
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
      // Already running: a second door must not reset the clock.
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
   * Atomicity is the point, and it is more load-bearing than it was: expiry is
   * now the ONLY way a trial ends, so a window that fails to start is a trial
   * that never does. The stamp is a single conditional UPDATE
   * (`... where user_id = ? and started_at is null`). Two concurrent
   * create-sessions both issue it; Postgres serialises them on the row lock and
   * the second re-checks the predicate against the committed version, matches
   * nothing, and returns no rows.
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

describe('countOpenTrialSessions', () => {
  /**
   * The only quantity limit left on a trial, and the reason "unlimited
   * attempts" is not literally unlimited: one person sits one consultation at a
   * time. Without it a client could fire fifty mints at the same free station
   * in parallel and spend fifty lots of Azure realtime minutes.
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
    const { client, cutoffs } = stubOpen([])
    await countOpenTrialSessions(client, 'user-1', 'sess-1', NOW)
    const since = new Date(cutoffs[0])
    expect((NOW.getTime() - since.getTime()) / 60_000).toBe(TRIAL_OPEN_SESSION_MINUTES)
    // Comfortably longer than a 12-minute station plus ~90s of marking.
    expect(TRIAL_OPEN_SESSION_MINUTES).toBeGreaterThan(13)
  })

  it('does not refuse an honest trainee when the check itself breaks', async () => {
    const neq = vi.fn().mockResolvedValue({ data: null, error: { message: 'down' } })
    const gte = vi.fn(() => ({ neq }))
    const inFilter = vi.fn(() => ({ gte }))
    const eq = vi.fn(() => ({ in: inFilter }))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(
      await countOpenTrialSessions(
        { from: () => ({ select: () => ({ eq }) }) } as never,
        'u',
        's',
        NOW,
      ),
    ).toBe(0)
    spy.mockRestore()
  })
})

describe('startTrialWindowFor', () => {
  function stubGrant(row: Record<string, unknown> | null) {
    const update = vi.fn(() => ({
      eq: () => ({ is: () => ({ select: async () => ({ data: [{}], error: null }) }) }),
    }))
    const select = vi.fn(() => ({
      eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
    }))
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
    const { client, update } = stubGrant({
      ...UNSTARTED,
      started_at: '2026-09-09T09:00:00Z',
      expires_at: '2026-09-14T09:00:00Z',
    })
    await startTrialWindowFor(client, true, 'user-1')
    expect(update).not.toHaveBeenCalled()
  })

  it('never throws — a consultation must not die over a clock', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      startTrialWindowFor(
        {
          from: () => {
            throw new Error('boom')
          },
        } as never,
        true,
        'user-1',
      ),
    ).resolves.toBeUndefined()
    spy.mockRestore()
  })
})

describe('before the migration is applied', () => {
  /**
   * Migrations are applied by hand after the merge, so there is a real window
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

  it('says nothing about a missing free_trial_order column, and opens nothing', async () => {
    // The pre-migration state for the STATIONS half. Same rule: quiet, and
    // closed.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const access = await loadTrialAccess(
      stubTrialClient({ stationsError: { code: '42703', message: 'no column' } }),
      'user-1',
      NOW,
    )
    expect(access.freeStationIds).toEqual([])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

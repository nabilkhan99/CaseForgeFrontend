import { describe, expect, it, vi } from 'vitest'
import {
  NO_TRIAL,
  TRIAL_ALLOWANCE,
  TRIAL_WINDOW_DAYS,
  computeTrialAccess,
  grantTrial,
  startTrialWindow,
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
    const { trial: _a, ...withNoTrial } = decideAccess([], ctx({ trial: NO_TRIAL }))
    const { trial: _b, ...withoutTheField } = decideAccess([], ctx())
    expect(withNoTrial).toEqual(withoutTheField)
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
    const { trial: _a, ...withNoTrial } = decideAccess([], ctx({ cohort, trial: NO_TRIAL }))
    const { trial: _b, ...withoutTheField } = decideAccess([], ctx({ cohort }))
    expect(withNoTrial).toEqual(withoutTheField)
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
  function stubUpdate(rows: Record<string, unknown>[]) {
    const select = vi.fn().mockResolvedValue({ data: rows, error: null })
    const is = vi.fn(() => ({ select }))
    const eq = vi.fn(() => ({ is }))
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    return { client: { from } as never, update, eq, is, select }
  }

  it('stamps started_at and expires_at together, five days apart', async () => {
    const { client, update, is } = stubUpdate([{ started_at: NOW.toISOString() }])
    const stamped = await startTrialWindow(client, grant(), NOW)
    expect(stamped).toBe(true)
    const written = update.mock.calls[0][0] as { started_at: string; expires_at: string }
    expect(written.started_at).toBe(NOW.toISOString())
    expect(written.expires_at).toBe(new Date(NOW.getTime() + 5 * DAY).toISOString())
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

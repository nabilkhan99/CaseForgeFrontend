import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The claim is the only thing standing between "two call sites ask for a mark"
 * and "the same consultation is marked twice at full price". It is pinned here
 * rather than left to the query because every rule in it is load-bearing: the
 * conditional UPDATE is what makes the race safe across Vercel instances, the
 * ten-minute TTL is what stops a crashed run wedging the session forever, and
 * never awaiting the Azure call is what keeps the route inside the Hobby plan's
 * 60-second ceiling.
 */

const { MARKING_CLAIM_STALE_MINUTES, triggerMarking } = await import('./triggerMarking')

interface ClaimAttempt {
  /** The value written to marking_started_at — a timestamp, or null to release. */
  wrote: unknown
  /** The `or(...)` filter, present only on a claim and absent on a release. */
  filter?: string
  id?: string
}

/**
 * Stand-in for the service-role client, with just enough of a fake table that
 * the claim is arbitrated by the store rather than asserted on: a live claim is
 * filtered out here exactly as Postgres would filter it.
 */
function makeAdmin(options: {
  /** Existing session_results row, if any. */
  result?: { session_id: string } | null
  /** Current value of clinical_sessions.marking_started_at. */
  markingStartedAt?: string | null
  claimError?: unknown
} = {}) {
  const attempts: ClaimAttempt[] = []
  let markingStartedAt = options.markingStartedAt ?? null

  const from = (table: string) => {
    if (table === 'session_results') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: options.result ?? null, error: null }),
          }),
        }),
      }
    }

    // clinical_sessions
    return {
      update: (values: Record<string, unknown>) => {
        const attempt: ClaimAttempt = { wrote: values.marking_started_at }
        const builder = {
          eq: (_column: string, value: string) => {
            attempt.id = value
            return builder
          },
          or: (filter: string) => {
            attempt.filter = filter
            return builder
          },
          select: () => builder,
          maybeSingle: async () => {
            attempts.push(attempt)
            if (options.claimError) return { data: null, error: options.claimError }
            // The claim wins only against a null or stale marking_started_at.
            const cutoff = /marking_started_at\.lt\.([^,)]+)/.exec(attempt.filter ?? '')?.[1]
            const stale =
              markingStartedAt !== null &&
              cutoff !== undefined &&
              markingStartedAt < cutoff
            if (markingStartedAt !== null && !stale) return { data: null, error: null }
            markingStartedAt = attempt.wrote as string | null
            return { data: { id: attempt.id }, error: null }
          },
          // A release is awaited straight off the builder, with no .select().
          then: (resolve: (r: unknown) => unknown) => {
            attempts.push(attempt)
            markingStartedAt = attempt.wrote as string | null
            return Promise.resolve({ data: null, error: null }).then(resolve)
          },
        }
        return builder
      },
    }
  }

  return {
    client: { from } as never,
    attempts,
    get markingStartedAt() {
      return markingStartedAt
    },
  }
}

/** Collects the scheduled task instead of running it, as `after()` would. */
function makeSchedule() {
  const tasks: Array<() => Promise<void>> = []
  return {
    schedule: (task: () => Promise<void>) => {
      tasks.push(task)
    },
    tasks,
    /** Run what `after()` would have run once the response was sent. */
    flush: async () => {
      for (const task of tasks) await task()
    },
  }
}

const NOW = Date.parse('2026-09-06T12:00:00.000Z')

function call(
  admin: ReturnType<typeof makeAdmin>,
  schedule: ReturnType<typeof makeSchedule>,
  fetchImpl: typeof fetch,
) {
  return triggerMarking({
    admin: admin.client,
    sessionId: 'session-1',
    schedule: schedule.schedule,
    fetchImpl,
    now: () => NOW,
    markingUrl: 'https://caseforge2025a.azurewebsites.net/',
    markingSecret: 'shh',
  })
}

function okFetch() {
  return vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('triggerMarking', () => {
  it('takes a free claim and fires the Azure run', async () => {
    const admin = makeAdmin({ markingStartedAt: null })
    const schedule = makeSchedule()
    const fetchImpl = okFetch()

    expect(await call(admin, schedule, fetchImpl)).toEqual({ triggered: true })

    // The claim is a conditional UPDATE, not a read-then-write: the condition
    // travels with the write, which is the whole of what makes it atomic.
    expect(admin.attempts).toHaveLength(1)
    expect(admin.attempts[0].id).toBe('session-1')
    expect(admin.attempts[0].wrote).toBe(new Date(NOW).toISOString())
    expect(admin.attempts[0].filter).toBe(
      `marking_started_at.is.null,marking_started_at.lt.${new Date(
        NOW - MARKING_CLAIM_STALE_MINUTES * 60000,
      ).toISOString()}`,
    )

    // Hobby plan: the ~65-90s Azure call is scheduled, never awaited. If this
    // ever became a bare await, save-transcript would hit the 60s ceiling.
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(schedule.tasks).toHaveLength(1)

    await schedule.flush()
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://caseforge2025a.azurewebsites.net/api/mark-consultation',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-marking-secret': 'shh' }),
        body: JSON.stringify({ sessionId: 'session-1' }),
      }),
    )
  })

  it('skips while another run holds a live claim', async () => {
    // Two minutes old: save-transcript fired, and the report's first poll has
    // just arrived. Exactly the race this exists for.
    const admin = makeAdmin({
      markingStartedAt: new Date(NOW - 2 * 60000).toISOString(),
    })
    const schedule = makeSchedule()
    const fetchImpl = okFetch()

    expect(await call(admin, schedule, fetchImpl)).toEqual({
      triggered: false,
      reason: 'claim_held',
    })
    expect(schedule.tasks).toHaveLength(0)
    await schedule.flush()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('retakes a stale claim so a dead run self-heals', async () => {
    // Older than the TTL: whatever took this claim is never coming back.
    const admin = makeAdmin({
      markingStartedAt: new Date(
        NOW - (MARKING_CLAIM_STALE_MINUTES + 1) * 60000,
      ).toISOString(),
    })
    const schedule = makeSchedule()
    const fetchImpl = okFetch()

    expect(await call(admin, schedule, fetchImpl)).toEqual({ triggered: true })
    expect(admin.markingStartedAt).toBe(new Date(NOW).toISOString())
    await schedule.flush()
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('does not re-mark a session that already has a result', async () => {
    // The claim is never even attempted — a second mark is money, not a no-op.
    const admin = makeAdmin({ result: { session_id: 'session-1' } })
    const schedule = makeSchedule()
    const fetchImpl = okFetch()

    expect(await call(admin, schedule, fetchImpl)).toEqual({
      triggered: false,
      reason: 'already_marked',
    })
    expect(admin.attempts).toHaveLength(0)
    expect(schedule.tasks).toHaveLength(0)
  })

  it('gives the claim back when Azure rejects the run', async () => {
    const admin = makeAdmin({ markingStartedAt: null })
    const schedule = makeSchedule()
    const fetchImpl = vi.fn(
      async () => new Response('nope', { status: 500 }),
    ) as unknown as typeof fetch

    await call(admin, schedule, fetchImpl)
    await schedule.flush()

    // Released rather than left to expire, so the report's next trigger poll
    // retries in seconds instead of waiting out the ten-minute TTL.
    expect(admin.markingStartedAt).toBeNull()
  })

  it('gives the claim back when the call throws', async () => {
    const admin = makeAdmin({ markingStartedAt: null })
    const schedule = makeSchedule()
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    await call(admin, schedule, fetchImpl)
    await schedule.flush()

    expect(admin.markingStartedAt).toBeNull()
  })

  it('takes no claim when the marking endpoint is unconfigured', async () => {
    const admin = makeAdmin({ markingStartedAt: null })
    const schedule = makeSchedule()

    const result = await triggerMarking({
      admin: admin.client,
      sessionId: 'session-1',
      schedule: schedule.schedule,
      fetchImpl: okFetch(),
      now: () => NOW,
      markingUrl: '',
      markingSecret: '',
    })

    expect(result).toEqual({ triggered: false, reason: 'not_configured' })
    // Claiming without being able to fire would strand the session for ten
    // minutes behind a run that was never started.
    expect(admin.attempts).toHaveLength(0)
  })

  it('reports a failed claim instead of firing blind', async () => {
    const admin = makeAdmin({ claimError: { message: 'deadlock' } })
    const schedule = makeSchedule()
    const fetchImpl = okFetch()

    expect(await call(admin, schedule, fetchImpl)).toEqual({
      triggered: false,
      reason: 'claim_error',
    })
    expect(schedule.tasks).toHaveLength(0)
  })
})

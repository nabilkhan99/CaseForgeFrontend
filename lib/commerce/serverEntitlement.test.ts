import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * How many round trips `getServerEntitlement` costs, and for whom.
 *
 * It sits in front of every consultation start and every navbar poll of
 * /api/subscription, and the servers are an ocean away from the database (~80
 * ms a round trip). So what is pinned here is the query plan rather than the
 * access rules (those live in entitlements/trialAccess tests):
 *   * purchases, cohort and trial grant go out in ONE batch;
 *   * the trial's five cases and its progress are read only when a live grant
 *     is what grants access — never for somebody who has paid.
 */

const mocks = vi.hoisted(() => ({
  client: null as unknown,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => mocks.client,
}))

const { getServerEntitlement } = await import('./serverEntitlement')

const DAY = 86_400_000
const USER = { id: 'user-1', email: 'gp@example.com' }
const FIVE = ['st-1', 'st-2', 'st-3', 'st-4', 'st-5']

type Answer = { data: unknown; error: unknown }

/** A PostgREST-shaped chain: every filter returns the chain, and it settles to `answer`. */
function chain(answer: () => Promise<Answer>) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'ilike', 'in', 'neq', 'gte', 'order', 'limit', 'is']) {
    builder[method] = () => builder
  }
  builder.maybeSingle = () => answer()
  builder.single = () => answer()
  builder.then = (resolve: (value: Answer) => unknown, reject: (reason: unknown) => unknown) =>
    answer().then(resolve, reject)
  return builder
}

interface Stub {
  purchases?: unknown[]
  purchasesError?: unknown
  /** Resolve the purchase read by hand, to observe what went out alongside it. */
  holdPurchases?: Promise<void>
  grant?: Record<string, unknown> | null
  user?: typeof USER | null
}

function grantRow(over: Record<string, unknown> = {}) {
  const startedAt = new Date(Date.now() - DAY)
  return {
    id: 'grant-1',
    user_id: USER.id,
    email: USER.email,
    allowance: 5,
    window_days: 5,
    source: 'signup',
    started_at: startedAt.toISOString(),
    expires_at: new Date(startedAt.getTime() + 5 * DAY).toISOString(),
    created_at: new Date(Date.now() - 2 * DAY).toISOString(),
    ...over,
  }
}

/** A paid, in-window purchase. */
const PAID = {
  plan: 'self_study',
  status: 'paid',
  created_at: new Date(Date.now() - DAY).toISOString(),
}

/** Installs a client that records every table it is asked for, in order. */
function install(stub: Stub) {
  const tables: string[] = []
  mocks.client = {
    auth: {
      getUser: async () => ({ data: { user: stub.user === undefined ? USER : stub.user } }),
    },
    from: (table: string) => {
      tables.push(table)
      switch (table) {
        case 'preorders':
          return chain(async () => {
            await stub.holdPurchases
            return { data: stub.purchases ?? [], error: stub.purchasesError ?? null }
          })
        case 'cohort_members':
          return chain(async () => ({ data: null, error: null }))
        case 'trial_grants':
          return chain(async () => ({ data: stub.grant ?? null, error: null }))
        case 'stations':
          return chain(async () => ({ data: FIVE.map((id) => ({ id })), error: null }))
        case 'clinical_sessions':
          return chain(async () => ({
            data: [
              { station_id: 'st-1', status: 'completed' },
              { station_id: 'st-1', status: 'completed' },
            ],
            error: null,
          }))
        default:
          throw new Error(`unexpected table ${table}`)
      }
    },
  }
  return tables
}

const TRIAL_DETAIL_TABLES = ['stations', 'clinical_sessions']

beforeEach(() => {
  delete process.env.ADMIN_EMAILS
})

describe('a paying user', () => {
  it('costs one batch of three and never reads the trial detail', async () => {
    const tables = install({ purchases: [PAID] })
    const result = await getServerEntitlement()
    expect(result.allowed).toBe(true)
    expect(result.entitlement.state).toBe('active')
    expect([...tables].sort()).toEqual(['cohort_members', 'preorders', 'trial_grants'])
  })

  it('never reads the trial detail even while holding a LIVE grant', async () => {
    // A trialist who bought keeps the grant row for good. Their purchase is
    // what grants access, so the five and the progress are nobody's business.
    const tables = install({ purchases: [PAID], grant: grantRow() })
    const result = await getServerEntitlement()
    expect(result.trialOnly).toBe(false)
    expect(result.allowed).toBe(true)
    for (const table of TRIAL_DETAIL_TABLES) expect(tables).not.toContain(table)
  })

  it('issues the grant and cohort reads alongside the purchases, not after them', async () => {
    let release: () => void = () => {}
    const holdPurchases = new Promise<void>((resolve) => {
      release = resolve
    })
    const tables = install({ purchases: [PAID], grant: grantRow(), holdPurchases })

    const pending = getServerEntitlement()
    // Let the batch go out while the purchase read is still unanswered.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect([...tables].sort()).toEqual(['cohort_members', 'preorders', 'trial_grants'])

    release()
    await pending
  })
})

describe('a trial account', () => {
  it('reads the five and the progress when a live grant is what grants access', async () => {
    const tables = install({ grant: grantRow() })
    const result = await getServerEntitlement()
    expect(result.trialOnly).toBe(true)
    expect(result.allowed).toBe(true)
    expect(result.trial?.freeStationIds).toEqual(FIVE)
    expect(result.trial?.attemptsByStation).toEqual({ 'st-1': 2 })
    expect(tables.slice(3)).toEqual(TRIAL_DETAIL_TABLES)
  })

  it('does not read the detail for an ENDED trial — it is an expired plan', async () => {
    const startedAt = new Date(Date.now() - 6 * DAY)
    const tables = install({
      grant: grantRow({
        started_at: startedAt.toISOString(),
        expires_at: new Date(startedAt.getTime() + 5 * DAY).toISOString(),
      }),
    })
    const result = await getServerEntitlement()
    expect(result.allowed).toBe(false)
    expect(result.trialOnly).toBe(false)
    expect(result.trial?.state).toBe('trial_ended')
    for (const table of TRIAL_DETAIL_TABLES) expect(tables).not.toContain(table)
  })

  it('does not read the detail for an admin holding a grant', async () => {
    process.env.ADMIN_EMAILS = USER.email
    const tables = install({ grant: grantRow() })
    const result = await getServerEntitlement()
    expect(result.bypass).toBe(true)
    expect(result.trialOnly).toBe(false)
    for (const table of TRIAL_DETAIL_TABLES) expect(tables).not.toContain(table)
  })
})

describe('when the purchase read breaks', () => {
  it('fails open without claiming the trial or reading its detail', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tables = install({ purchasesError: { message: 'down' }, grant: grantRow() })
    const result = await getServerEntitlement()
    expect(result.failedOpen).toBe(true)
    expect(result.allowed).toBe(true)
    expect(result.trialOnly).toBe(false)
    expect(result.trial?.state).toBe('trial')
    expect(result.cohortOnly).toBe(false)
    for (const table of TRIAL_DETAIL_TABLES) expect(tables).not.toContain(table)
    spy.mockRestore()
  })
})

describe('no session', () => {
  it('reads nothing', async () => {
    const tables = install({ user: null })
    const result = await getServerEntitlement()
    expect(result.user).toBeNull()
    expect(result.allowed).toBe(false)
    expect(tables).toEqual([])
  })
})

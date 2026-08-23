import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Attaching a guest free-mock to the account that later bought.
 *
 * Every rule here is a rule about somebody else's consultation, which is why
 * they are pinned rather than left to the query: an unverified lead is an
 * unproven claim, an already-owned session is never reassigned, and the
 * matching has to be case-insensitive or the claim silently never fires for
 * anyone whose lead was stored with a capital letter.
 */

vi.mock('server-only', () => ({}))

const { claimTrialSessionsForUser } = await import('./claimTrialSessions')

interface LeadQuery {
  /** The pattern handed to `.ilike('email', …)`. */
  pattern?: string
  /** True when the query demanded a non-null `email_verified_at`. */
  requiredVerified: boolean
}

interface SessionUpdate {
  values: Record<string, unknown>
  ids: string[]
  /** True when the write carried the `user_id is null` guard. */
  guarded: boolean
}

/**
 * Stand-in for the service-role client. `sessions` is a tiny fake table so the
 * `user_id is null` guard is enforced by the store rather than asserted on —
 * an already-owned row is filtered out here exactly as Postgres would.
 */
function makeStore(options: {
  leads?: Array<{ session_id: string | null; email_verified_at: string | null }>
  sessions?: Record<string, { user_id: string | null }>
  leadError?: unknown
  claimError?: unknown
}) {
  const leadQueries: LeadQuery[] = []
  const updates: SessionUpdate[] = []
  const sessions = { ...(options.sessions ?? {}) }

  function leadBuilder() {
    const query: LeadQuery = { requiredVerified: false }
    const builder = {
      ilike: (_column: string, pattern: string) => {
        query.pattern = pattern
        return builder
      },
      not: (column: string, operator: string, value: unknown) => {
        if (column === 'email_verified_at' && operator === 'is' && value === null) {
          query.requiredVerified = true
        }
        return builder
      },
      then: (resolve: (r: unknown) => unknown) => {
        leadQueries.push(query)
        if (options.leadError) return Promise.resolve({ data: null, error: options.leadError }).then(resolve)
        const rows = (options.leads ?? [])
          .filter((lead) => (query.requiredVerified ? lead.email_verified_at !== null : true))
          .map((lead) => ({ session_id: lead.session_id }))
        return Promise.resolve({ data: rows, error: null }).then(resolve)
      },
    }
    return builder
  }

  function updateBuilder(values: Record<string, unknown>) {
    const update: SessionUpdate = { values, ids: [], guarded: false }
    const builder = {
      in: (_column: string, ids: string[]) => {
        update.ids = ids
        return builder
      },
      is: () => {
        update.guarded = true
        return {
          select: async () => {
            updates.push(update)
            if (options.claimError) return { data: null, error: options.claimError }
            const hit = update.ids.filter((id) => sessions[id] && sessions[id].user_id === null)
            for (const id of hit) sessions[id] = { user_id: values.user_id as string }
            return { data: hit.map((id) => ({ id })), error: null }
          },
        }
      },
    }
    return builder
  }

  const store = {
    from: (table: string) =>
      table === 'trial_leads'
        ? { select: leadBuilder }
        : { update: updateBuilder },
  }

  return {
    store: store as unknown as Parameters<typeof claimTrialSessionsForUser>[0],
    leadQueries,
    updates,
    sessions,
  }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('claimTrialSessionsForUser', () => {
  it('claims the guest session behind a verified lead', async () => {
    const { store, updates, sessions } = makeStore({
      leads: [{ session_id: 's1', email_verified_at: '2026-08-01T00:00:00Z' }],
      sessions: { s1: { user_id: null } },
    })

    const claimed = await claimTrialSessionsForUser(store, 'user-1', 'jane@nhs.net')

    expect(claimed).toBe(1)
    expect(updates[0].values).toEqual({ user_id: 'user-1' })
    expect(sessions.s1.user_id).toBe('user-1')
  })

  it('matches the lead case-insensitively', async () => {
    // trial_leads is unique on lower(email) and RLS/entitlements match the same
    // way. A case-sensitive filter here would mean a lead stored as
    // `Jane@NHS.net` never gets claimed by the account `jane@nhs.net`.
    const { store, leadQueries } = makeStore({
      leads: [{ session_id: 's1', email_verified_at: '2026-08-01T00:00:00Z' }],
      sessions: { s1: { user_id: null } },
    })

    const claimed = await claimTrialSessionsForUser(store, 'user-1', '  Jane@NHS.net ')

    expect(claimed).toBe(1)
    // Normalised and handed to ilike, not eq.
    expect(leadQueries[0].pattern).toBe('jane@nhs.net')
  })

  it('escapes ilike wildcards so the match stays an equality test', async () => {
    // `_` is common in real addresses; unescaped it is a single-char wildcard,
    // so `sarah_jones@nhs.net` would also match `sarahxjones@nhs.net`.
    const { store, leadQueries } = makeStore({ leads: [] })

    await claimTrialSessionsForUser(store, 'user-1', 'sarah_jones@nhs.net')

    expect(leadQueries[0].pattern).toBe('sarah\\_jones@nhs.net')
  })

  it('ignores leads that never verified their email', async () => {
    // Anyone can type any address into the gate; only the code they typed back
    // proves the address is theirs.
    const { store, leadQueries, updates } = makeStore({
      leads: [{ session_id: 's1', email_verified_at: null }],
      sessions: { s1: { user_id: null } },
    })

    const claimed = await claimTrialSessionsForUser(store, 'user-1', 'jane@nhs.net')

    expect(claimed).toBe(0)
    expect(leadQueries[0].requiredVerified).toBe(true)
    expect(updates).toEqual([])
  })

  it('never reassigns a session that already has an owner', async () => {
    const { store, updates, sessions } = makeStore({
      leads: [{ session_id: 's1', email_verified_at: '2026-08-01T00:00:00Z' }],
      sessions: { s1: { user_id: 'someone-else' } },
    })

    const claimed = await claimTrialSessionsForUser(store, 'user-1', 'jane@nhs.net')

    expect(claimed).toBe(0)
    expect(updates[0].guarded).toBe(true)
    expect(sessions.s1.user_id).toBe('someone-else')
  })

  it('is idempotent — a second run claims nothing', async () => {
    const { store, sessions } = makeStore({
      leads: [{ session_id: 's1', email_verified_at: '2026-08-01T00:00:00Z' }],
      sessions: { s1: { user_id: null } },
    })

    expect(await claimTrialSessionsForUser(store, 'user-1', 'jane@nhs.net')).toBe(1)
    expect(await claimTrialSessionsForUser(store, 'user-1', 'jane@nhs.net')).toBe(0)
    expect(sessions.s1.user_id).toBe('user-1')
  })

  it('claims every verified lead for the address at once', async () => {
    const { store } = makeStore({
      leads: [
        { session_id: 's1', email_verified_at: '2026-08-01T00:00:00Z' },
        { session_id: 's2', email_verified_at: '2026-08-02T00:00:00Z' },
      ],
      sessions: { s1: { user_id: null }, s2: { user_id: null } },
    })

    expect(await claimTrialSessionsForUser(store, 'user-1', 'jane@nhs.net')).toBe(2)
  })

  it('does nothing without a user id or an email', async () => {
    const { store, leadQueries } = makeStore({ leads: [] })

    expect(await claimTrialSessionsForUser(store, '', 'jane@nhs.net')).toBe(0)
    expect(await claimTrialSessionsForUser(store, 'user-1', null)).toBe(0)
    expect(await claimTrialSessionsForUser(store, 'user-1', '   ')).toBe(0)
    expect(leadQueries).toEqual([])
  })

  it('writes nothing when the lead lookup fails', async () => {
    const { store, updates } = makeStore({ leadError: { message: 'boom' } })

    expect(await claimTrialSessionsForUser(store, 'user-1', 'jane@nhs.net')).toBe(0)
    expect(updates).toEqual([])
  })

  it('reports zero when the claim itself fails', async () => {
    const { store } = makeStore({
      leads: [{ session_id: 's1', email_verified_at: '2026-08-01T00:00:00Z' }],
      sessions: { s1: { user_id: null } },
      claimError: { message: 'boom' },
    })

    expect(await claimTrialSessionsForUser(store, 'user-1', 'jane@nhs.net')).toBe(0)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The "you never set a password" gate.
 *
 * A provisioned account is signed in by the emailed link BEFORE the password
 * form is submitted, so closing that tab used to leave someone browsing the
 * product — sitting consultations, even — with no password at all, and locked
 * out for good once the session died, because the link is single-use.
 *
 * What is pinned here is the shape of the gate rather than the happy path: it
 * must not loop, it must not answer the app's own fetches with a redirect, and
 * it must be invisible to every account that predates the flag.
 *
 * Only `auth.getUser` is mocked. NextRequest/NextResponse are the real ones, so
 * a redirect that Next would not actually emit cannot pass here.
 */

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}))

const { updateSession } = await import('./middleware')

/** A signed-in user carrying whatever metadata the test is about. */
function signedIn(metadata: Record<string, unknown>) {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'u1', email: 'student@nhs.net', user_metadata: metadata } },
  })
}

async function go(path: string) {
  const response = await updateSession(
    new NextRequest(new URL(path, 'https://www.fourteenfisherman.com')),
  )
  const location = response.headers.get('location')
  return {
    status: response.status,
    // Path only: the interesting question is always "where", never "on which host".
    to: location ? new URL(location).pathname : null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  signedIn({ password_pending: true })
})

describe('a signed-in account that never set a password', () => {
  it('is sent to the set-password page from anywhere in the product', async () => {
    expect(await go('/dashboard')).toEqual({ status: 307, to: '/auth/set-password' })
    expect((await go('/')).to).toBe('/auth/set-password')
    expect((await go('/pricing')).to).toBe('/auth/set-password')
  })

  it('drops the query, which belongs to the page it was sent away from', async () => {
    const response = await updateSession(
      new NextRequest(new URL('/dashboard?tab=library', 'https://www.fourteenfisherman.com')),
    )

    expect(new URL(response.headers.get('location')!).search).toBe('')
  })

  it('does not redirect the destination, so there is no loop', async () => {
    // The rule that bounces signed-in users off /auth pages already exempts the
    // two password routes, so the destination is genuinely reachable — this is
    // the pair of exemptions that has to agree for the gate to terminate.
    expect((await go('/auth/set-password')).to).toBeNull()
    expect((await go('/auth/set-password?token_hash=abc&email=a%40b.com')).to).toBeNull()
  })

  it('leaves /api alone, so the app keeps getting JSON', async () => {
    // The feedback page polls a route for up to five minutes. Answering that
    // poll with a 307 to an HTML page would break marking for anyone gated.
    expect((await go('/api/generate-feedback')).to).toBeNull()
    expect((await go('/api/clinical-master/save-transcript')).to).toBeNull()
  })

  it('reaches the set-password page in a bounded number of hops from an auth page', async () => {
    // /auth/sign-in is exempt from the gate but not from the authed-users-leave
    // rule, so it lands on /dashboard, which the gate then sends onward. Two
    // hops, terminating — not a cycle.
    expect((await go('/auth/sign-in')).to).toBe('/dashboard')
    expect((await go('/dashboard')).to).toBe('/auth/set-password')
  })
})

describe('everyone else', () => {
  it('ignores an account whose metadata has no such flag', async () => {
    // Every account that existed before this shipped. Absence means "not
    // gated", which is why no backfill runs in code.
    signedIn({ full_name: 'Jane Doe' })

    expect((await go('/dashboard')).to).toBeNull()
  })

  it('ignores an account that has finished setting its password', async () => {
    signedIn({ full_name: 'Jane Doe', password_pending: false })

    expect((await go('/dashboard')).to).toBeNull()
  })

  it('reads the flag strictly, so a stray truthy value is not a gate', async () => {
    signedIn({ password_pending: 'true' })

    expect((await go('/dashboard')).to).toBeNull()
  })

  it('still sends a signed-OUT visitor to sign-in, not to set-password', async () => {
    // Sign-out clears the cookies client-side before navigating, so this is
    // also the state the gate sees immediately after someone signs out.
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    expect((await go('/dashboard')).to).toBe('/auth/sign-in')
  })
})

describe('navigating into a consultation', () => {
  /**
   * The subscription gate, and what it costs. This runs on every page under
   * /clinical-master, an ocean away from the database, so the query plan is
   * pinned: purchases, cohort and the trial GRANT, together — and never the
   * trial's stations or its usage, which no navigation needs.
   *
   * An ENDED trial is an expired plan here like any other: it takes the same
   * redirect as an account with no plan, not a trial-shaped one.
   */
  const DAY = 86_400_000

  type Answer = { data: unknown; error: unknown }

  function chain(answer: Answer) {
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'ilike', 'in', 'neq', 'gte', 'order', 'limit', 'is']) {
      builder[method] = () => builder
    }
    builder.maybeSingle = async () => answer
    builder.then = (resolve: (value: Answer) => unknown) => Promise.resolve(answer).then(resolve)
    return builder
  }

  function grantRow(daysSinceStart: number) {
    const startedAt = new Date(Date.now() - daysSinceStart * DAY)
    return {
      id: 'grant-1',
      user_id: 'u1',
      email: 'student@nhs.net',
      allowance: 5,
      window_days: 5,
      source: 'signup',
      started_at: startedAt.toISOString(),
      expires_at: new Date(startedAt.getTime() + 5 * DAY).toISOString(),
      created_at: new Date(startedAt.getTime() - DAY).toISOString(),
    }
  }

  function database(opts: { purchases?: unknown[]; grant?: unknown }) {
    const tables: string[] = []
    mocks.from.mockImplementation((table: string) => {
      tables.push(table)
      if (table === 'preorders') return chain({ data: opts.purchases ?? [], error: null })
      if (table === 'cohort_members') return chain({ data: null, error: null })
      if (table === 'trial_grants') return chain({ data: opts.grant ?? null, error: null })
      // Anything else — stations, clinical_sessions — is a read this path
      // must never make. Answer it so a regression shows up in `tables`, not
      // as a thrown error swallowed by the fail-open catch.
      return chain({ data: [], error: null })
    })
    return tables
  }

  async function navigate(path: string) {
    const response = await updateSession(
      new NextRequest(new URL(path, 'https://www.fourteenfisherman.com')),
    )
    const location = response.headers.get('location')
    return {
      to: location ? new URL(location).pathname : null,
      search: location ? new URL(location).search : null,
      failedOpen: response.headers.get('x-entitlement-fail-open'),
    }
  }

  beforeEach(() => {
    signedIn({ full_name: 'Jane Doe' })
    delete process.env.ADMIN_EMAILS
  })

  it('lets a paying user through on purchases, cohort and grant alone', async () => {
    const tables = database({
      purchases: [
        { plan: 'self_study', status: 'paid', created_at: new Date(Date.now() - DAY).toISOString() },
      ],
      grant: grantRow(1),
    })

    const result = await navigate('/clinical-master/station/st-1')

    expect(result).toEqual({ to: null, search: null, failedOpen: null })
    expect([...tables].sort()).toEqual(['cohort_members', 'preorders', 'trial_grants'])
  })

  it('lets a live trial through without reading its stations or usage', async () => {
    const tables = database({ grant: grantRow(1) })

    const result = await navigate('/clinical-master/station/st-99')

    expect(result).toEqual({ to: null, search: null, failedOpen: null })
    expect([...tables].sort()).toEqual(['cohort_members', 'preorders', 'trial_grants'])
  })

  it('sends an ended trial where it sends anybody with no plan', async () => {
    const tables = database({ grant: grantRow(6) })
    const ended = await navigate('/clinical-master/station/st-1')

    database({})
    const never = await navigate('/clinical-master/station/st-1')

    expect(ended).toEqual({ to: '/pricing', search: '?upgrade=true', failedOpen: null })
    expect(ended).toEqual(never)
    expect([...tables].sort()).toEqual(['cohort_members', 'preorders', 'trial_grants'])
  })

  it('does not gate the feedback pages at all', async () => {
    const tables = database({ grant: grantRow(6) })
    expect((await navigate('/clinical-master/feedback/sess-1')).to).toBeNull()
    expect(tables).toEqual([])
  })
})

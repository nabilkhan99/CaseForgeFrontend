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
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mocks.getUser },
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

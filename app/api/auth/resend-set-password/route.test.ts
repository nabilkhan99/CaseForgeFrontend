import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The self-service "email me a fresh link" route.
 *
 * Two properties are load-bearing and neither is visible from the happy path:
 * the response body is IDENTICAL on every outcome (it is an unauthenticated
 * endpoint over customer addresses), and the send is throttled (each send
 * rotates the recovery token, so an unthrottled loop doesn't just spam the
 * victim, it denies them account setup entirely).
 *
 * The limiter is module state, so every test uses its own email and its own
 * client IP unless it is deliberately testing the shared budget.
 */

const mocks = vi.hoisted(() => ({
  sendSetPasswordLink: vi.fn(),
  update: vi.fn(),
  /** `preorders` — the paid-purchase check. */
  lookup: vi.fn(),
  /** `profiles` — email → auth user id, the first hop of the cohort check. */
  profileLookup: vi.fn(),
  /** `cohort_members` — the second hop. */
  memberLookup: vi.fn(),
  /** Every pattern handed to `.ilike('email', …)` on `profiles`. */
  profilePatterns: [] as string[],
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/auth/provisioning', () => ({
  sendSetPasswordLink: mocks.sendSetPasswordLink,
}))

/**
 * Table-aware, because eligibility now reads three of them: a purchase, or
 * failing that a `profiles` row and the `cohort_members` row behind it.
 */
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => {
        const builder = {
          eq: () => builder,
          ilike: (_column: string, pattern: string) => {
            mocks.profilePatterns.push(pattern)
            return builder
          },
          limit: () => builder,
          maybeSingle: async () => {
            if (table === 'profiles') return mocks.profileLookup()
            if (table === 'cohort_members') return mocks.memberLookup()
            return mocks.lookup()
          },
        }
        return builder
      },
      update: (values: Record<string, unknown>) => {
        mocks.update(values)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

const { POST } = await import('./route')

const GENERIC_OK = {
  ok: true,
  message: "If that address has a purchase with us, an email is on its way.",
}

/**
 * One request. Every call needs its OWN email and IP unless the test is about
 * the shared budget — the limiter's Maps live for the whole file, so a reused
 * address is a spent address.
 */
async function post(email: unknown, ip: string) {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/auth/resend-set-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
      body: JSON.stringify({ email }),
    }),
  )
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.lookup.mockResolvedValue({ data: { id: 'p1', full_name: 'Jane Doe' }, error: null })
  // Default: not a cohort member. The purchase path must never depend on these.
  mocks.profileLookup.mockResolvedValue({ data: null, error: null })
  mocks.memberLookup.mockResolvedValue({ data: null, error: null })
  mocks.sendSetPasswordLink.mockResolvedValue({ sent: true })
  mocks.profilePatterns.length = 0
})

describe('the response never distinguishes a customer from a stranger', () => {
  it('answers a paid buyer with the generic body', async () => {
    const { status, body } = await post('buyer1@x.com', '1.1.1.1')

    expect(status).toBe(200)
    expect(body).toEqual(GENERIC_OK)
  })

  it('answers an unknown address with exactly the same body', async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null })

    const { status, body } = await post('nobody@x.com', '1.1.1.2')

    expect(status).toBe(200)
    expect(body).toEqual(GENERIC_OK)
    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
  })

  it('answers a lookup failure the same way instead of a 500', async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { status, body } = await post('buyer3@x.com', '1.1.1.3')

    expect(status).toBe(200)
    expect(body).toEqual(GENERIC_OK)
  })

  it('answers a send failure the same way', async () => {
    // The dominant real cause of a failed send here is "paid buyer whose auth
    // account was never created" — a 500 on that is a sharper oracle than the
    // timing one, so the send is detached and its outcome never reaches the
    // caller.
    mocks.sendSetPasswordLink.mockResolvedValue({ sent: false, error: 'brevo_error' })

    const { status, body } = await post('buyer4@x.com', '1.1.1.4')

    expect(status).toBe(200)
    expect(body).toEqual(GENERIC_OK)
    await vi.waitFor(() => expect(mocks.sendSetPasswordLink).toHaveBeenCalled())
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('returns before the send resolves, so response time is not an oracle', async () => {
    let release: (() => void) | undefined
    mocks.sendSetPasswordLink.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ sent: true })
      }),
    )

    const { body } = await post('slow@x.com', '1.1.1.5')

    expect(body).toEqual(GENERIC_OK)
    release?.()
  })

  it('still rejects a malformed request, which says nothing about any address', async () => {
    expect((await post('not-an-email', '1.1.1.6')).status).toBe(400)
    expect((await post(undefined, '1.1.1.7')).status).toBe(400)
  })
})

describe('who is owed a link', () => {
  /**
   * A trainer-cohort seat is a real account with NO purchase behind it, and
   * its password was set from a hand-provisioned link. Before this, every
   * cohort student was told "an email is on its way" and none ever arrived —
   * with no other self-serve path, a dead link meant emailing the founder.
   */

  /** No purchase; the address resolves to an auth user in a cohort. */
  const asCohortMember = () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null })
    mocks.profileLookup.mockResolvedValue({ data: { id: 'user-1' }, error: null })
    mocks.memberLookup.mockResolvedValue({ data: { user_id: 'user-1' }, error: null })
  }

  it('sends to a cohort member who has no purchase', async () => {
    asCohortMember()

    const { status, body } = await post('student@nhs.net', '5.5.5.1')

    expect(status).toBe(200)
    expect(body).toEqual(GENERIC_OK)
    await vi.waitFor(() => expect(mocks.sendSetPasswordLink).toHaveBeenCalledTimes(1))
    expect(mocks.sendSetPasswordLink).toHaveBeenCalledWith({
      email: 'student@nhs.net',
      // No purchase row, so no name to carry: the mail addresses them plainly
      // rather than inventing one.
      fullName: null,
    })
  })

  it('stamps nothing for a cohort member — the stamp lives on a purchase row', async () => {
    asCohortMember()

    await post('student2@nhs.net', '5.5.5.2')

    await vi.waitFor(() => expect(mocks.sendSetPasswordLink).toHaveBeenCalled())
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('matches the address case-insensitively, wildcards escaped', async () => {
    // Cohort rows are seeded by hand, so `Sarah_J@Nhs.net` is a real shape —
    // and `_` is an ilike wildcard, which would otherwise match strangers.
    asCohortMember()

    await post('  Sarah_J@Nhs.net ', '5.5.5.3')

    expect(mocks.profilePatterns).toEqual(['sarah\\_j@nhs.net'])
  })

  it('never runs the cohort lookups when there is a purchase', async () => {
    // The paying customer's path is one indexed read, exactly as it was.
    await post('buyer-first@x.com', '5.5.5.4')

    expect(mocks.profileLookup).not.toHaveBeenCalled()
    expect(mocks.memberLookup).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(mocks.sendSetPasswordLink).toHaveBeenCalledTimes(1))
  })

  it('sends nothing to an account that is in no cohort', async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null })
    mocks.profileLookup.mockResolvedValue({ data: { id: 'user-2' }, error: null })

    const { body } = await post('random@nhs.net', '5.5.5.5')

    expect(body).toEqual(GENERIC_OK)
    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
  })

  it('fails closed on a profile lookup error', async () => {
    // Fail-open here is an unauthenticated mailer that mints a recovery token
    // for any address at all, every time the database hiccups.
    mocks.lookup.mockResolvedValue({ data: null, error: null })
    mocks.profileLookup.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { status, body } = await post('err1@nhs.net', '5.5.5.6')

    expect(status).toBe(200)
    expect(body).toEqual(GENERIC_OK)
    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
  })

  it('fails closed on a cohort lookup error', async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null })
    mocks.profileLookup.mockResolvedValue({ data: { id: 'user-3' }, error: null })
    mocks.memberLookup.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { status, body } = await post('err2@nhs.net', '5.5.5.7')

    expect(status).toBe(200)
    expect(body).toEqual(GENERIC_OK)
    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
  })

  it('charges a cohort member against the same budget as everyone else', async () => {
    asCohortMember()

    const first = await post('cohort-cooldown@nhs.net', '5.5.5.8')
    const second = await post('cohort-cooldown@nhs.net', '5.5.5.9')

    await vi.waitFor(() => expect(mocks.sendSetPasswordLink).toHaveBeenCalledTimes(1))
    expect(second.body).toEqual(first.body)
  })
})

describe('stamping the send', () => {
  it('records set_password_sent_at once the link is out', async () => {
    // The Stripe webhook decides who is still owed a link off this stamp. Left
    // unstamped, a retry days later mails a SECOND link and rotates the
    // recovery token out from under the one the buyer just used.
    await post('stamped@x.com', '1.1.1.8')

    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
    expect(mocks.update).toHaveBeenCalledWith({ set_password_sent_at: expect.any(String) })
  })
})

describe('throttling', () => {
  it('sends once per address per window, and hides that it stopped', async () => {
    const first = await post('cooldown@x.com', '2.2.2.1')
    const second = await post('cooldown@x.com', '2.2.2.2')

    await vi.waitFor(() => expect(mocks.sendSetPasswordLink).toHaveBeenCalledTimes(1))
    // A different IP does not buy a second send: the address is the budget.
    expect(second.status).toBe(200)
    expect(second.body).toEqual(first.body)
  })

  it('caps how many addresses one client can probe', async () => {
    const ip = '3.3.3.3'
    for (let i = 0; i < 5; i += 1) await post(`probe${i}@x.com`, ip)
    expect(mocks.sendSetPasswordLink).toHaveBeenCalledTimes(5)

    const blocked = await post('probe5@x.com', ip)

    expect(blocked.body).toEqual(GENERIC_OK)
    expect(mocks.sendSetPasswordLink).toHaveBeenCalledTimes(5)
  })

  it('charges an unknown address against the budget too', async () => {
    // Otherwise the cooldown itself becomes the oracle: only real customers
    // would ever be throttled, so "not throttled" would mean "no account".
    mocks.lookup.mockResolvedValue({ data: null, error: null })
    const ip = '4.4.4.4'
    for (let i = 0; i < 5; i += 1) await post(`ghost${i}@x.com`, ip)
    mocks.lookup.mockResolvedValue({ data: { id: 'p1', full_name: null }, error: null })

    await post('real@x.com', ip)

    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
  })
})

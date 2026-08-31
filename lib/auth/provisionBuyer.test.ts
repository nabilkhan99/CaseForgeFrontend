import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The provisioning state machine, which decides whether a paid buyer gets an
 * account, an email, both or neither — and records the answer so a retry can
 * tell what is still owed.
 *
 * It is pinned here because every way it can go wrong is silent: it never
 * throws, never fails the webhook, and the customer's only symptom is an
 * account they can't sign into. The interesting cases are the ones with two
 * Stripe deliveries in flight at once.
 */

const mocks = vi.hoisted(() => ({
  provisionAccountForPurchase: vi.fn(),
  mintSetPasswordLink: vi.fn(),
  claimTrialSessionsForUser: vi.fn(),
  /** The receipt email, injected by the webhook. */
  deliver: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('./provisioning', () => ({
  provisionAccountForPurchase: mocks.provisionAccountForPurchase,
  mintSetPasswordLink: mocks.mintSetPasswordLink,
}))

vi.mock('./claimTrialSessions', () => ({
  claimTrialSessionsForUser: mocks.claimTrialSessionsForUser,
}))

const { provisionBuyerAccount } = await import('./provisionBuyer')

type Result = { data?: unknown; error?: unknown }

interface Write {
  values: Record<string, unknown>
  /** True when the write carried the `set_password_sent_at is null` guard. */
  guarded: boolean
}

/**
 * Minimal stand-in for the Supabase query builder, recording every write.
 *
 * `guardedUpdate` takes a queue so a test can make the first compare-and-swap
 * win and the second one find zero rows — the two-deliveries-at-once case.
 */
function makeStore(responses: {
  read?: Result
  guardedUpdate?: Result[]
  plainUpdate?: Result
}) {
  const writes: Write[] = []
  const guarded = [...(responses.guardedUpdate ?? [])]

  function updateBuilder(values: Record<string, unknown>) {
    const write: Write = { values, guarded: false }
    const builder = {
      eq: () => builder,
      is: () => {
        write.guarded = true
        // supabase-js builders are thenable, so a guarded write may be awaited
        // with or without a trailing `.select()`. Both land here.
        const settle = async () => {
          writes.push(write)
          return guarded.shift() ?? { data: [{ id: 'p1' }], error: null }
        }
        return { select: settle, then: (resolve: (r: Result) => unknown) => settle().then(resolve) }
      },
      // Awaiting the builder without `.is()` is the un-guarded release write.
      then: (resolve: (r: Result) => unknown) => {
        writes.push(write)
        return Promise.resolve(responses.plainUpdate ?? { error: null }).then(resolve)
      },
    }
    return builder
  }

  function selectBuilder() {
    const builder = {
      eq: () => builder,
      maybeSingle: async () => responses.read ?? { data: null, error: null },
    }
    return builder
  }

  const store = {
    from: () => ({ select: selectBuilder, update: updateBuilder }),
  }

  return { store: store as unknown as Parameters<typeof provisionBuyerAccount>[0], writes }
}

const ARGS = {
  preorderId: 'p1',
  email: 'buyer@x.com',
  name: 'Jane Doe',
  sessionId: 'cs_1',
  deliver: mocks.deliver,
}

const SETUP_URL = 'https://www.fourteenfisherman.com/auth/set-password?token_hash=tok&email=b%40x.com'

const PAID = { status: 'paid', provisioned_at: null, set_password_sent_at: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  mocks.provisionAccountForPurchase.mockResolvedValue({
    created: true,
    alreadyExisted: false,
    userId: 'user-1',
  })
  mocks.mintSetPasswordLink.mockResolvedValue({ url: SETUP_URL })
  mocks.deliver.mockResolvedValue({ sent: true })
  mocks.claimTrialSessionsForUser.mockResolvedValue(1)
})

describe('provisionBuyerAccount — first attempt (no stamps yet)', () => {
  it('claims the send FIRST, then creates the account, stamps it and delivers', async () => {
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    // The claim comes before createUser, not after it. See the concurrency
    // test at the bottom of this describe for why that ordering is the fix.
    expect(writes.map((w) => Object.keys(w.values)[0])).toEqual([
      'set_password_sent_at',
      'provisioned_at',
    ])
    expect(writes[0].guarded).toBe(true)
    expect(mocks.provisionAccountForPurchase).toHaveBeenCalledWith({
      email: 'buyer@x.com',
      fullName: 'Jane Doe',
    })
    expect(mocks.deliver).toHaveBeenCalledWith({ setupUrl: SETUP_URL })
  })

  it('does nothing at all when a concurrent delivery already owns the send', async () => {
    // Minting is what INVALIDATES the previous link, and createUser decides
    // what the mail says — so a delivery that lost the claim must not reach
    // either.
    const { store } = makeStore({
      read: { data: PAID, error: null },
      guardedUpdate: [{ data: [], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).not.toHaveBeenCalled()
    expect(mocks.mintSetPasswordLink).not.toHaveBeenCalled()
    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('hands the send claim back when the receipt email fails', async () => {
    // The recoverable case the stamps exist for: the account is real, the mail
    // never arrived, and the next retry must resend rather than start over.
    mocks.deliver.mockResolvedValue({ sent: false, error: 'brevo_error' })
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(writes.map((w) => Object.keys(w.values)[0])).toEqual([
      'set_password_sent_at',
      'provisioned_at',
      'set_password_sent_at',
    ])
    // Released unguarded: we hold the claim, so there is nothing to race with.
    expect(writes[2]).toEqual({ values: { set_password_sent_at: null }, guarded: false })
  })

  it('hands the claim back when the account could not be created at all', async () => {
    mocks.provisionAccountForPurchase.mockResolvedValue({
      created: false,
      alreadyExisted: false,
      userId: null,
      error: 'fetch failed',
    })
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.deliver).not.toHaveBeenCalled()
    // Claimed, then released — nothing was sent, so the retry must find it owed.
    expect(writes.map((w) => Object.keys(w.values)[0])).toEqual([
      'set_password_sent_at',
      'set_password_sent_at',
    ])
    expect(writes[1].values).toEqual({ set_password_sent_at: null })
  })

  it('hands the claim back when MINTING throws, not just when the send does', async () => {
    // The mint sits between the claim and the send. An escaping throw there
    // would leave the stamp written for a mail that never went, and no later
    // retry would revisit the buyer.
    mocks.mintSetPasswordLink.mockRejectedValue(new Error('gotrue exploded'))
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(writes[writes.length - 1]).toEqual({
      values: { set_password_sent_at: null },
      guarded: false,
    })
  })

  it('sends a repeat buyer their receipt, with no set-password link', async () => {
    // An account that already exists keeps its password, so minting one would
    // be a password-reset mail nobody asked for. The RECEIPT is still owed —
    // they paid — so it goes with a sign-in button instead.
    mocks.provisionAccountForPurchase.mockResolvedValue({
      created: false,
      alreadyExisted: true,
      userId: 'user-1',
      error: 'account_already_exists',
    })
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.mintSetPasswordLink).not.toHaveBeenCalled()
    expect(mocks.deliver).toHaveBeenCalledWith({ setupUrl: null })
    expect(writes.map((w) => Object.keys(w.values)[0])).toEqual([
      'set_password_sent_at',
      'provisioned_at',
    ])
  })

  it('delivers the receipt even when the link could not be minted', async () => {
    // GoTrue having a bad minute must not cost a buyer their proof of payment.
    mocks.mintSetPasswordLink.mockResolvedValue({ url: null, error: 'link boom' })
    const { store } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.deliver).toHaveBeenCalledWith({ setupUrl: null })
  })

  it('never tells a brand-new buyer they already have an account', async () => {
    // The race this ordering exists to kill. Two concurrent deliveries of a NEW
    // purchase both used to reach createUser: one got `created`, the other
    // `alreadyExisted`, and whichever won the send was a separate coin flip. If
    // the `alreadyExisted` one won, the buyer was told to "just sign in" to an
    // account that had no password — with the stamp set for good.
    //
    // Only the claim winner now reaches createUser, so the loser cannot send
    // the wrong mail. Here the loser is the one whose createUser would have
    // said `alreadyExisted`.
    mocks.provisionAccountForPurchase
      .mockResolvedValueOnce({ created: true, alreadyExisted: false, userId: 'user-1' })
      .mockResolvedValueOnce({
        created: false,
        alreadyExisted: true,
        userId: 'user-1',
        error: 'account_already_exists',
      })

    const winner = makeStore({ read: { data: PAID, error: null } })
    const loser = makeStore({
      read: { data: PAID, error: null },
      guardedUpdate: [{ data: [], error: null }],
    })

    await Promise.all([
      provisionBuyerAccount(winner.store, ARGS),
      provisionBuyerAccount(loser.store, ARGS),
    ])

    // One mail, and it carries a real setup link.
    expect(mocks.deliver).toHaveBeenCalledTimes(1)
    expect(mocks.deliver).toHaveBeenCalledWith({ setupUrl: SETUP_URL })
  })
})

describe('provisionBuyerAccount — attaching the buyer\'s free mock', () => {
  /**
   * The free station is anonymous, so the consultation that convinced somebody
   * to buy belongs to nobody until an account exists. The moment it does is the
   * one moment we can prove they are the same person — same address on the
   * purchase, the verified trial lead and the auth user.
   */

  it('claims the guest sessions for a newly created account', async () => {
    const { store } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.claimTrialSessionsForUser).toHaveBeenCalledWith(store, 'user-1', 'buyer@x.com')
  })

  it('claims them for a repeat buyer whose account already existed', async () => {
    // The likeliest free-station sitter of all, and the path that returns no
    // new user — so it has to look the id up rather than skip.
    mocks.provisionAccountForPurchase.mockResolvedValue({
      created: false,
      alreadyExisted: true,
      userId: 'user-1',
      error: 'account_already_exists',
    })
    const { store } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.claimTrialSessionsForUser).toHaveBeenCalledWith(store, 'user-1', 'buyer@x.com')
  })

  it('claims nothing when provisioning could not produce a user id', async () => {
    mocks.provisionAccountForPurchase.mockResolvedValue({
      created: false,
      alreadyExisted: false,
      userId: null,
      error: 'fetch failed',
    })
    const { store } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.claimTrialSessionsForUser).not.toHaveBeenCalled()
  })

  it('still stamps the row when the claim throws', async () => {
    // The account and the set-password email are what this function owes the
    // buyer. Reattaching an old consultation is a bonus and must never cost
    // them either one.
    mocks.claimTrialSessionsForUser.mockRejectedValue(new Error('boom'))
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.deliver).toHaveBeenCalledTimes(1)
    expect(writes.map((w) => Object.keys(w.values)[0])).toEqual([
      'set_password_sent_at',
      'provisioned_at',
    ])
  })
})

describe('provisionBuyerAccount — the account exists, only the email is owed', () => {
  const OWED = { status: 'paid', provisioned_at: '2026-08-20T10:00:00Z', set_password_sent_at: null }

  it('claims the send BEFORE making it, then sends', async () => {
    const { store, writes } = makeStore({
      read: { data: OWED, error: null },
      guardedUpdate: [{ data: [{ id: 'p1' }], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).not.toHaveBeenCalled()
    expect(mocks.deliver).toHaveBeenCalledTimes(1)
    // One write, and it is the claim — guarded, and only the send stamp.
    expect(writes).toHaveLength(1)
    expect(writes[0]).toEqual({ values: { set_password_sent_at: expect.any(String) }, guarded: true })
  })

  it('sends nothing when a concurrent delivery already claimed the send', async () => {
    // Two Stripe deliveries in this branch at once. Nothing downstream dedupes
    // them (unlike createUser on the first-attempt branch), so without the
    // compare-and-swap both would email and the second generateLink would kill
    // the first link — the buyer opens the mail that arrived first and is told
    // it has expired.
    const { store } = makeStore({
      read: { data: OWED, error: null },
      guardedUpdate: [{ data: [], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.deliver).not.toHaveBeenCalled()
  })

  it('hands the claim back when the send then fails, so a retry can pick it up', async () => {
    mocks.deliver.mockResolvedValue({ sent: false, error: 'brevo_error' })
    const { store, writes } = makeStore({
      read: { data: OWED, error: null },
      guardedUpdate: [{ data: [{ id: 'p1' }], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(writes).toHaveLength(2)
    expect(writes[1].values).toEqual({ set_password_sent_at: null })
    // Released unguarded: we hold the claim, so there is nothing to race with.
    expect(writes[1].guarded).toBe(false)
  })

  it('hands the claim back when the send THROWS, not just when it returns false', async () => {
    // A throw would otherwise skip the release and leave the row reading
    // "already emailed" for a mail that never went — the stranded buyer this
    // whole compare-and-swap exists to prevent.
    mocks.deliver.mockRejectedValue(new Error('brevo exploded'))
    const { store, writes } = makeStore({
      read: { data: OWED, error: null },
      guardedUpdate: [{ data: [{ id: 'p1' }], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(writes).toHaveLength(2)
    expect(writes[1]).toEqual({ values: { set_password_sent_at: null }, guarded: false })
  })

  it('sends nothing when the claim write itself errors', async () => {
    const { store } = makeStore({
      read: { data: OWED, error: null },
      guardedUpdate: [{ data: null, error: { message: 'boom' } }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.deliver).not.toHaveBeenCalled()
  })
})

describe('provisionBuyerAccount — the cases where it must do nothing', () => {
  it('does nothing once the link has already been sent', async () => {
    const { store, writes } = makeStore({
      read: {
        data: { status: 'paid', provisioned_at: '2026-08-20T10:00:00Z', set_password_sent_at: '2026-08-20T10:01:00Z' },
        error: null,
      },
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).not.toHaveBeenCalled()
    expect(mocks.deliver).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('does not provision a refunded purchase', async () => {
    // Stripe replays the original checkout event after the buyer has refunded —
    // or an operator replays it from the dashboard. Neither may mint an account
    // and mail a set-password link to someone with no purchase.
    const { store, writes } = makeStore({
      read: { data: { ...PAID, status: 'refunded' }, error: null },
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('does not provision a canceled subscription row', async () => {
    const { store } = makeStore({ read: { data: { ...PAID, status: 'canceled' }, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).not.toHaveBeenCalled()
  })

  it('does not provision against a row that has vanished', async () => {
    const { store } = makeStore({ read: { data: null, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).not.toHaveBeenCalled()
  })

  it('degrades to no provisioning when the state read fails', async () => {
    // The stamps land in a later migration than the rest of the table, so a
    // deploy that runs ahead of it must skip provisioning, not double-send.
    const { store, writes } = makeStore({
      read: { data: null, error: { message: 'column "provisioned_at" does not exist' } },
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).not.toHaveBeenCalled()
    expect(mocks.deliver).not.toHaveBeenCalled()
    expect(writes).toEqual([])
  })

  it('never throws out into the webhook when provisioning blows up', async () => {
    // A provisioning failure must not fail the webhook, or Stripe re-processes
    // a pre-order that was recorded perfectly well.
    mocks.provisionAccountForPurchase.mockRejectedValue(new Error('GoTrue down'))
    const { store } = makeStore({ read: { data: PAID, error: null } })

    await expect(provisionBuyerAccount(store, ARGS)).resolves.toBeUndefined()
  })
})

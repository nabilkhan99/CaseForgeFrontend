import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  sendSetPasswordLink: vi.fn(),
  claimTrialSessionsForUser: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('./provisioning', () => ({
  provisionAccountForPurchase: mocks.provisionAccountForPurchase,
  sendSetPasswordLink: mocks.sendSetPasswordLink,
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
        return {
          select: async () => {
            writes.push(write)
            return guarded.shift() ?? { data: [{ id: 'p1' }], error: null }
          },
        }
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

const ARGS = { preorderId: 'p1', email: 'buyer@x.com', name: 'Jane Doe', sessionId: 'cs_1' }

/**
 * A purchase made after the course opened, which is the case that gets a link.
 * The suite runs on a fixed clock (see beforeEach) because "has access opened"
 * is a real date comparison — without pinning it, every send-path test here
 * would pass or fail depending on the day it was run.
 */
const PAID = {
  status: 'paid',
  plan: 'self_study',
  created_at: '2026-09-05T09:00:00Z',
  provisioned_at: null,
  set_password_sent_at: null,
}

/** The same purchase, made before launch: an account, but no link yet. */
const PAID_PRE_LAUNCH = { ...PAID, created_at: '2026-08-23T09:58:00Z' }

const AFTER_LAUNCH = new Date('2026-09-20T10:00:00Z')
const BEFORE_LAUNCH = new Date('2026-08-23T10:00:00Z')

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(AFTER_LAUNCH)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  mocks.provisionAccountForPurchase.mockResolvedValue({
    created: true,
    alreadyExisted: false,
    emailSent: true,
    userId: 'user-1',
  })
  mocks.sendSetPasswordLink.mockResolvedValue({ sent: true })
  mocks.claimTrialSessionsForUser.mockResolvedValue(1)
})

describe('provisionBuyerAccount — first attempt (no stamps yet)', () => {
  it('creates the account, sends the link and stamps both, under the guard', async () => {
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).toHaveBeenCalledWith({
      email: 'buyer@x.com',
      fullName: 'Jane Doe',
    })
    expect(writes).toHaveLength(1)
    expect(writes[0].guarded).toBe(true)
    expect(Object.keys(writes[0].values).sort()).toEqual(['provisioned_at', 'set_password_sent_at'])
  })

  it('stamps provisioned_at but not the send when the email fails', async () => {
    // The recoverable case the stamps exist for: the account is real, the link
    // never arrived, and the next retry must resend rather than start over.
    mocks.provisionAccountForPurchase.mockResolvedValue({
      created: true,
      alreadyExisted: false,
      emailSent: false,
      userId: 'user-1',
      error: 'brevo_error',
    })
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(writes[0].values).toHaveProperty('provisioned_at')
    expect(writes[0].values).not.toHaveProperty('set_password_sent_at')
  })

  it('stamps a repeat buyer terminal without emailing them', async () => {
    // An account that already exists keeps its password and is owed no link.
    // Both stamps go down so `set_password_sent_at is null` keeps meaning
    // "still owes an email" — leaving it null sent every later retry down the
    // resend branch and mailed them a link they never asked for.
    mocks.provisionAccountForPurchase.mockResolvedValue({
      created: false,
      alreadyExisted: true,
      emailSent: false,
      userId: 'user-1',
      error: 'account_already_exists',
    })
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
    expect(Object.keys(writes[0].values).sort()).toEqual(['provisioned_at', 'set_password_sent_at'])
  })

  it('writes nothing when the account could not be created at all', async () => {
    mocks.provisionAccountForPurchase.mockResolvedValue({
      created: false,
      alreadyExisted: false,
      emailSent: false,
      userId: null,
      error: 'fetch failed',
    })
    const { store, writes } = makeStore({ read: { data: PAID, error: null } })

    await provisionBuyerAccount(store, ARGS)

    expect(writes).toEqual([])
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
      emailSent: false,
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
      emailSent: false,
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

    expect(writes).toHaveLength(1)
    expect(Object.keys(writes[0].values).sort()).toEqual(['provisioned_at', 'set_password_sent_at'])
  })
})

describe('provisionBuyerAccount — the account exists, only the email is owed', () => {
  const OWED = { ...PAID, provisioned_at: '2026-09-06T10:00:00Z' }

  it('claims the send BEFORE making it, then sends', async () => {
    const { store, writes } = makeStore({
      read: { data: OWED, error: null },
      guardedUpdate: [{ data: [{ id: 'p1' }], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).not.toHaveBeenCalled()
    expect(mocks.sendSetPasswordLink).toHaveBeenCalledTimes(1)
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

    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
  })

  it('hands the claim back when the send then fails, so a retry can pick it up', async () => {
    mocks.sendSetPasswordLink.mockResolvedValue({ sent: false, error: 'brevo_error' })
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

  it('sends nothing when the claim write itself errors', async () => {
    const { store } = makeStore({
      read: { data: OWED, error: null },
      guardedUpdate: [{ data: null, error: { message: 'boom' } }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
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
    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
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
    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
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

describe('provisionBuyerAccount — the access window has not opened yet', () => {
  /**
   * The case that reached a real customer. She bought on 23 August, was
   * emailed "set a password and you can start practising", and clicked it four
   * times against a page that does not exist on production, three weeks before
   * the course opened.
   */
  it('creates the account but sends nothing, and leaves the send stamp null', async () => {
    vi.setSystemTime(BEFORE_LAUNCH)
    const { store, writes } = makeStore({
      read: { data: PAID_PRE_LAUNCH, error: null },
      guardedUpdate: [{ data: [{ id: 'p1' }], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.provisionAccountForPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ sendLink: false }),
    )
    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
    // Exactly one write, and it must not claim the send: that null is how
    // launch day knows this buyer is still owed a login.
    expect(writes).toHaveLength(1)
    expect(writes[0].values).toEqual({ provisioned_at: expect.any(String) })
    expect(writes[0].values).not.toHaveProperty('set_password_sent_at')
  })

  it('does not resend to a pre-launch buyer whose account already exists', async () => {
    vi.setSystemTime(BEFORE_LAUNCH)
    const { store, writes } = makeStore({
      read: {
        data: { ...PAID_PRE_LAUNCH, provisioned_at: '2026-08-23T10:00:00Z' },
        error: null,
      },
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
    // The account is already there, so the stamp write is a no-op guarded on
    // `provisioned_at is null` and nothing else is owed.
    expect(writes.every(write => !('set_password_sent_at' in write.values))).toBe(true)
  })

  it('sends once the window has opened, on the same purchase', async () => {
    vi.setSystemTime(AFTER_LAUNCH)
    const { store } = makeStore({
      read: { data: PAID_PRE_LAUNCH, error: null },
      guardedUpdate: [{ data: [{ id: 'p1' }], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    // A first delivery sends through provisionAccountForPurchase; the bare
    // sendSetPasswordLink is the resend path for an account that already exists.
    expect(mocks.provisionAccountForPurchase).toHaveBeenCalledWith(
      expect.not.objectContaining({ sendLink: false }),
    )
  })

  it('sends nothing for a plan it does not recognise, rather than assuming open', async () => {
    vi.setSystemTime(AFTER_LAUNCH)
    const { store } = makeStore({
      read: { data: { ...PAID, plan: 'mystery_tier' }, error: null },
      guardedUpdate: [{ data: [{ id: 'p1' }], error: null }],
    })

    await provisionBuyerAccount(store, ARGS)

    expect(mocks.sendSetPasswordLink).not.toHaveBeenCalled()
    expect(mocks.provisionAccountForPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ sendLink: false }),
    )
  })
})

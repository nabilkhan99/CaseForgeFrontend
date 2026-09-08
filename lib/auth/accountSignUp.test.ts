import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The four GoTrue calls behind "create your free account".
 *
 * Three of them have a failure mode nothing in the product would report:
 *
 *  1. an account created WITH the `password_pending` stamp would send somebody
 *     to /auth/set-password moments after choosing a password, and the only
 *     evidence would be a confused support message;
 *  2. overwriting a password that already exists turns a sign-up form into an
 *     unauthenticated password reset for any mailbox somebody can read;
 *  3. a magic-link token that escaped into a response body would be a bearer
 *     credential for the account, and it would look exactly like working code.
 *
 * So all three are pinned here rather than left to review.
 */

const mocks = vi.hoisted(() => ({
  profile: null as { id: string } | null,
  profileError: null as unknown,
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        ilike: () => ({
          maybeSingle: async () => ({ data: mocks.profile, error: mocks.profileError }),
        }),
      }),
    }),
    auth: {
      admin: {
        getUserById: (...args: unknown[]) => mocks.getUserById(...args),
        createUser: (...args: unknown[]) => mocks.createUser(...args),
        updateUserById: (...args: unknown[]) => mocks.updateUserById(...args),
        generateLink: (...args: unknown[]) => mocks.generateLink(...args),
      },
    },
  }),
}))

/** The route-handler client: the one whose verifyOtp writes the cookies. */
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { verifyOtp: (...args: unknown[]) => mocks.verifyOtp(...args) },
  }),
}))

const { findAccountByEmail, provisionAccountWithPassword, signInWithMagicLink } = await import(
  './accountSignUp'
)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.profile = null
  mocks.profileError = null
  mocks.getUserById.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null })
  mocks.createUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  mocks.updateUserById.mockResolvedValue({ data: {}, error: null })
  mocks.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: 'hash-1' } },
    error: null,
  })
  mocks.verifyOtp.mockResolvedValue({ data: {}, error: null })
})

describe('findAccountByEmail', () => {
  it('says nothing when the address has no account', async () => {
    expect(await findAccountByEmail('nobody@example.com')).toBeNull()
  })

  it('reports a finished account', async () => {
    mocks.profile = { id: 'user-7' }
    mocks.getUserById.mockResolvedValue({
      data: { user: { user_metadata: { full_name: 'Sarah' } } },
      error: null,
    })

    expect(await findAccountByEmail('sarah@nhs.net')).toEqual({
      userId: 'user-7',
      passwordPending: false,
    })
  })

  it('reports one that was provisioned and never given a password', async () => {
    mocks.profile = { id: 'user-7' }
    mocks.getUserById.mockResolvedValue({
      data: { user: { user_metadata: { password_pending: true } } },
      error: null,
    })

    expect(await findAccountByEmail('sarah@nhs.net')).toMatchObject({ passwordPending: true })
  })

  it('reads a lookup failure as "carry on", never as "no account"', async () => {
    // Returning null on an error is the same answer as "no account", and that
    // is the safe direction here: the sign-up carries on and createUser makes
    // the real decision against the unique index.
    mocks.profileError = { message: 'boom' }
    expect(await findAccountByEmail('sarah@nhs.net')).toBeNull()
  })
})

describe('provisionAccountWithPassword', () => {
  it('creates the account with the password, confirmed, and no pending stamp', async () => {
    const result = await provisionAccountWithPassword({
      email: 'Sarah@NHS.net',
      password: 'longenough1',
      fullName: 'Sarah',
      phone: '+447700900123',
    })

    expect(result).toEqual({ created: true, alreadyExisted: false, userId: 'user-1' })

    const args = mocks.createUser.mock.calls[0][0]
    expect(args.email).toBe('sarah@nhs.net')
    expect(args.password).toBe('longenough1')
    expect(args.email_confirm).toBe(true)
    // The middleware gates on `password_pending === true`. They have just
    // chosen a password; sending them to choose one is the bug this prevents.
    expect(args.user_metadata).not.toHaveProperty('password_pending')
    expect(args.user_metadata).toMatchObject({ full_name: 'Sarah', phone: '+447700900123' })
  })

  it('finishes an account that was provisioned without a password', async () => {
    mocks.createUser.mockResolvedValue({ data: null, error: { code: 'email_exists', message: 'already registered' } })
    mocks.profile = { id: 'user-7' }
    mocks.getUserById.mockResolvedValue({
      data: { user: { user_metadata: { password_pending: true } } },
      error: null,
    })

    const result = await provisionAccountWithPassword({
      email: 'sarah@nhs.net',
      password: 'longenough1',
    })

    expect(result).toMatchObject({ created: false, alreadyExisted: true, userId: 'user-7' })
    expect(mocks.updateUserById).toHaveBeenCalledWith(
      'user-7',
      expect.objectContaining({ password: 'longenough1' }),
    )
    expect(mocks.updateUserById.mock.calls[0][1].user_metadata).toMatchObject({
      password_pending: false,
    })
  })

  it('NEVER rewrites a password that already exists', async () => {
    // Verifying an emailed code proves the mailbox, which is the same proof a
    // reset takes — but a customer typing their address into the free form must
    // not have their password rotated by it. /auth/reset-password is the reset.
    mocks.createUser.mockResolvedValue({ data: null, error: { code: 'email_exists', message: 'already registered' } })
    mocks.profile = { id: 'user-7' }
    mocks.getUserById.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null })

    const result = await provisionAccountWithPassword({
      email: 'sarah@nhs.net',
      password: 'attackerchosen',
    })

    expect(result.userId).toBe('user-7')
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it('reports a real create failure rather than pretending', async () => {
    mocks.createUser.mockResolvedValue({ data: null, error: { code: 'weak_password', message: 'too weak' } })

    expect(await provisionAccountWithPassword({ email: 'a@b.com', password: 'x' })).toEqual({
      created: false,
      alreadyExisted: false,
      userId: null,
      error: 'too weak',
    })
  })

  it('survives a password that cannot be set on an existing account', async () => {
    mocks.createUser.mockResolvedValue({ data: null, error: { code: 'email_exists', message: 'already registered' } })
    mocks.profile = { id: 'user-7' }
    mocks.getUserById.mockResolvedValue({
      data: { user: { user_metadata: { password_pending: true } } },
      error: null,
    })
    mocks.updateUserById.mockResolvedValue({ data: null, error: { message: 'gotrue down' } })

    // The account and the grant are the point; a missing password is recoverable
    // from the ordinary reset, and this must not throw into the verify route.
    const result = await provisionAccountWithPassword({ email: 'a@b.com', password: 'longenough1' })
    expect(result.userId).toBe('user-7')
  })
})

describe('signInWithMagicLink', () => {
  it('mints a magic link and spends it here, so the response carries cookies', async () => {
    expect(await signInWithMagicLink('Sarah@NHS.net')).toBe(true)

    expect(mocks.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'sarah@nhs.net' })
    // Verified through the ROUTE-HANDLER client (lib/supabase/server), which is
    // the one that writes through next/headers. The admin client cannot.
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'hash-1' })
  })

  it('is not the recovery flow — that one lands people on set-password', async () => {
    await signInWithMagicLink('a@b.com')
    expect(mocks.generateLink.mock.calls[0][0].type).not.toBe('recovery')
  })

  it('returns false rather than throwing when no token can be minted', async () => {
    mocks.generateLink.mockResolvedValue({ data: null, error: { message: 'user not found' } })
    expect(await signInWithMagicLink('a@b.com')).toBe(false)
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
  })

  it('returns false when the token is refused', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: null, error: { message: 'expired' } })
    expect(await signInWithMagicLink('a@b.com')).toBe(false)
  })

  it('survives GoTrue throwing outright', async () => {
    mocks.generateLink.mockRejectedValue(new Error('network'))
    expect(await signInWithMagicLink('a@b.com')).toBe(false)
  })

  it('refuses an empty address without asking GoTrue', async () => {
    expect(await signInWithMagicLink('   ')).toBe(false)
    expect(mocks.generateLink).not.toHaveBeenCalled()
  })
})

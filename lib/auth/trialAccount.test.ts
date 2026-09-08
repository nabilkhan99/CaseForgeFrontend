import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Turning a verified address into a trialist.
 *
 * Four things matter here and none of them is the happy path:
 *
 *  1. an EXISTING account is not a failure. `provisionAccountForPurchase`
 *     reports "already exists" as an `error`, because the purchase path needs
 *     it to — and a naive reading of that would refuse the trial to every lead
 *     who has ever bought or been provisioned, which is most of door (c)'s
 *     audience.
 *  2. the claim runs BEFORE the grant, so the dashboard they land on has their
 *     own consultation on it.
 *  3. a failed sign-in link is not fatal. The account and grant are real; only
 *     the convenience is missing.
 *  4. `mintSignIn: false` mints nothing, because a caller that establishes the
 *     session itself would otherwise race its own token.
 *  5. a `password` switches which provisioner runs. The purchase one stamps
 *     `password_pending`, which would send an account-first trainee to
 *     /auth/set-password seconds after they chose a password.
 */

const mocks = vi.hoisted(() => ({
  provision: vi.fn(),
  provisionWithPassword: vi.fn(),
  claim: vi.fn(),
  grant: vi.fn(),
  loadAccess: vi.fn(),
  mintTokenHash: vi.fn(),
  order: [] as string[],
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/auth/provisioning', () => ({
  provisionAccountForPurchase: (...args: unknown[]) => {
    mocks.order.push('provision')
    return mocks.provision(...args)
  },
  mintRecoveryTokenHash: (...args: unknown[]) => {
    mocks.order.push('mint')
    return mocks.mintTokenHash(...args)
  },
  authLinkOrigin: () => 'https://www.fourteenfisherman.com',
}))

vi.mock('@/lib/auth/accountSignUp', () => ({
  provisionAccountWithPassword: (...args: unknown[]) => {
    mocks.order.push('provision-with-password')
    return mocks.provisionWithPassword(...args)
  },
}))

vi.mock('@/lib/auth/claimTrialSessions', () => ({
  claimTrialSessionsForUser: (...args: unknown[]) => {
    mocks.order.push('claim')
    return mocks.claim(...args)
  },
}))

vi.mock('@/lib/commerce/trialAccess', () => ({
  grantTrial: (...args: unknown[]) => {
    mocks.order.push('grant')
    return mocks.grant(...args)
  },
  loadTrialAccess: (...args: unknown[]) => mocks.loadAccess(...args),
}))

const { ensureTrialAccount } = await import('./trialAccount')

/** Never touched — every table call is mocked away above. */
const admin = {} as never

beforeEach(() => {
  vi.clearAllMocks()
  mocks.order.length = 0
  mocks.provision.mockResolvedValue({ created: true, alreadyExisted: false, userId: 'user-1' })
  mocks.provisionWithPassword.mockResolvedValue({
    created: true,
    alreadyExisted: false,
    userId: 'user-1',
  })
  mocks.claim.mockResolvedValue(1)
  mocks.grant.mockResolvedValue({ userId: 'user-1', source: 'signup' })
  mocks.loadAccess.mockResolvedValue({ state: 'trial' })
  mocks.mintTokenHash.mockResolvedValue({ tokenHash: 'hash-1' })
})

describe('a new address', () => {
  it('creates the account, claims, grants and hands back a sign-in url', async () => {
    const result = await ensureTrialAccount(admin, {
      email: 'Sarah@NHS.net',
      firstName: 'Sarah',
      source: 'signup',
    })

    expect(result).toMatchObject({
      userId: 'user-1',
      created: true,
      granted: true,
      state: 'trial',
      claimed: 1,
    })
    expect(result.signInUrl).toContain('/auth/start?token_hash=hash-1')

    // Lower-cased everywhere it is written, because trial_leads is uniquely
    // indexed on lower(email) and trial_grants.email has a CHECK on it.
    expect(mocks.provision).toHaveBeenCalledWith({ email: 'sarah@nhs.net', fullName: 'Sarah' })
    expect(mocks.grant).toHaveBeenCalledWith(admin, {
      userId: 'user-1',
      email: 'sarah@nhs.net',
      source: 'signup',
    })
  })

  it('claims before it grants', () => {
    // The order is the product decision: the dashboard they land on has their
    // own consultation on it, not an empty board with five stations offered.
    return ensureTrialAccount(admin, { email: 'a@b.com', source: 'guest_reveal' }).then(() => {
      expect(mocks.order.indexOf('claim')).toBeLessThan(mocks.order.indexOf('grant'))
      expect(mocks.order.indexOf('provision')).toBeLessThan(mocks.order.indexOf('claim'))
      // Minted last, so a retry cannot rotate a link somebody is holding.
      expect(mocks.order.indexOf('mint')).toBe(mocks.order.length - 1)
    })
  })

  it('records the door it came through', async () => {
    await ensureTrialAccount(admin, { email: 'a@b.com', source: 'guest_reveal' })
    expect(mocks.grant).toHaveBeenCalledWith(admin, expect.objectContaining({ source: 'guest_reveal' }))
  })
})

describe('an address that already has an account', () => {
  it('is granted anyway — "already exists" is not a failure here', async () => {
    // provisionAccountForPurchase reports this as an error because the PURCHASE
    // path needs it to. Most of door (c)'s audience is in this state.
    mocks.provision.mockResolvedValue({
      created: false,
      alreadyExisted: true,
      userId: 'user-9',
      error: 'account_already_exists',
    })

    const result = await ensureTrialAccount(admin, { email: 'a@b.com', source: 'link' })

    expect(result.created).toBe(false)
    expect(result.userId).toBe('user-9')
    expect(result.granted).toBe(true)
    expect(mocks.grant).toHaveBeenCalledOnce()
  })

  it('reports a spent grant honestly rather than promising five stations', async () => {
    mocks.loadAccess.mockResolvedValue({ state: 'trial_ended' })
    const result = await ensureTrialAccount(admin, { email: 'a@b.com', source: 'link' })
    expect(result.state).toBe('trial_ended')
  })
})

describe('failures', () => {
  it('does nothing at all when there is no account to hang it on', async () => {
    mocks.provision.mockResolvedValue({ created: false, alreadyExisted: false, userId: null, error: 'boom' })

    const result = await ensureTrialAccount(admin, { email: 'a@b.com', source: 'signup' })

    expect(result).toEqual({
      userId: null,
      created: false,
      signInUrl: null,
      granted: false,
      state: 'none',
      claimed: 0,
    })
    expect(mocks.claim).not.toHaveBeenCalled()
    expect(mocks.grant).not.toHaveBeenCalled()
  })

  it('keeps the account and the grant when the sign-in link cannot be minted', async () => {
    mocks.mintTokenHash.mockResolvedValue({ tokenHash: null, error: 'gotrue down' })

    const result = await ensureTrialAccount(admin, { email: 'a@b.com', source: 'signup' })

    expect(result.signInUrl).toBeNull()
    expect(result.granted).toBe(true)
    expect(result.userId).toBe('user-1')
  })

  it('reports no trial when the grant itself failed', async () => {
    mocks.grant.mockResolvedValue(null)
    const result = await ensureTrialAccount(admin, { email: 'a@b.com', source: 'signup' })
    expect(result.granted).toBe(false)
    expect(result.state).toBe('none')
    // No point counting consumption against a grant that is not there.
    expect(mocks.loadAccess).not.toHaveBeenCalled()
  })

  it('refuses an empty address without calling anything', async () => {
    const result = await ensureTrialAccount(admin, { email: '   ', source: 'signup' })
    expect(result.userId).toBeNull()
    expect(mocks.provision).not.toHaveBeenCalled()
  })
})

describe('mintSignIn: false', () => {
  it('mints nothing, so a caller establishing its own session cannot race itself', async () => {
    const result = await ensureTrialAccount(admin, {
      email: 'a@b.com',
      source: 'link',
      mintSignIn: false,
    })
    expect(mocks.mintTokenHash).not.toHaveBeenCalled()
    expect(result.signInUrl).toBeNull()
    expect(result.granted).toBe(true)
  })
})

describe('the account-first door', () => {
  it('provisions WITH the password rather than through the purchase path', async () => {
    // The purchase provisioner stamps `password_pending: true`, which the
    // middleware turns into a detour to /auth/set-password. Somebody who has
    // just chosen a password must not meet it.
    await ensureTrialAccount(admin, {
      email: 'Sarah@NHS.net',
      firstName: 'Sarah',
      source: 'signup',
      password: 'longenough1',
      phone: '+447700900123',
      mintSignIn: false,
    })

    expect(mocks.provision).not.toHaveBeenCalled()
    expect(mocks.provisionWithPassword).toHaveBeenCalledWith({
      email: 'sarah@nhs.net',
      password: 'longenough1',
      fullName: 'Sarah',
      phone: '+447700900123',
    })
  })

  it('still claims and grants exactly as the other doors do', async () => {
    const result = await ensureTrialAccount(admin, {
      email: 'a@b.com',
      source: 'signup',
      password: 'longenough1',
      mintSignIn: false,
    })

    expect(mocks.order.indexOf('claim')).toBeLessThan(mocks.order.indexOf('grant'))
    expect(result.granted).toBe(true)
    expect(result.userId).toBe('user-1')
  })

  it('falls back to the purchase provisioner when there is no password', async () => {
    // The guest reveal and the signed link have no form to have asked on.
    await ensureTrialAccount(admin, { email: 'a@b.com', source: 'guest_reveal' })
    expect(mocks.provisionWithPassword).not.toHaveBeenCalled()
    expect(mocks.provision).toHaveBeenCalledOnce()
  })

  it('treats a blank password as no password rather than a weak one', async () => {
    await ensureTrialAccount(admin, { email: 'a@b.com', source: 'signup', password: '   ' })
    expect(mocks.provisionWithPassword).not.toHaveBeenCalled()
  })
})

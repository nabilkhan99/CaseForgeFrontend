import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SITE_URL } from '@/lib/seo/site'

/**
 * Provisioning is the only thing standing between a paid customer and an
 * account they can never sign into, so every branch that ends without an email
 * is pinned here — especially the ones that used to fail silently.
 */

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  generateLink: vi.fn(),
  sendSetPasswordEmail: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { createUser: mocks.createUser, generateLink: mocks.generateLink } },
  }),
}))

vi.mock('@/lib/email/accountEmail', () => ({
  sendSetPasswordEmail: mocks.sendSetPasswordEmail,
}))

const { provisionAccountForPurchase, sendSetPasswordLink, setPasswordUrl } = await import('./provisioning')

const TOKEN = 'hashed-token-abc'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mocks.generateLink.mockResolvedValue({
    data: { properties: { hashed_token: TOKEN } },
    error: null,
  })
  mocks.sendSetPasswordEmail.mockResolvedValue({ sent: true })
})

describe('provisionAccountForPurchase', () => {
  it('creates a confirmed user and emails them a set-password link', async () => {
    const result = await provisionAccountForPurchase({ email: 'buyer@x.com', fullName: 'Jane Doe' })

    expect(mocks.createUser).toHaveBeenCalledTimes(1)
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: 'buyer@x.com',
      email_confirm: true,
      user_metadata: { full_name: 'Jane Doe' },
    })
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'buyer@x.com' })
    expect(result).toEqual({ created: true, emailSent: true, error: undefined })
  })

  it('lowercases and trims the buying email before creating the account', async () => {
    await provisionAccountForPurchase({ email: '  Buyer@X.com ', fullName: null })

    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'buyer@x.com' }),
    )
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'buyer@x.com' })
    expect(mocks.sendSetPasswordEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'buyer@x.com' }),
    )
  })

  it('emails a link on the canonical site, not whatever host called the webhook', async () => {
    await provisionAccountForPurchase({ email: 'buyer@x.com' })

    const { setPasswordUrl: url } = mocks.sendSetPasswordEmail.mock.calls[0][0]
    expect(url.startsWith(`${SITE_URL}/auth/set-password`)).toBe(true)
  })

  it('leaves an existing account alone and sends nothing', async () => {
    mocks.createUser.mockResolvedValue({ data: null, error: { code: 'email_exists', message: 'x' } })

    const result = await provisionAccountForPurchase({ email: 'buyer@x.com' })

    expect(mocks.generateLink).not.toHaveBeenCalled()
    expect(mocks.sendSetPasswordEmail).not.toHaveBeenCalled()
    expect(result.created).toBe(false)
    expect(result.emailSent).toBe(false)
    // ...but says so, so the caller can log it. A silent skip here is exactly
    // how a stranded buyer stayed invisible.
    expect(result.error).toBe('account_already_exists')
  })

  it('recognises the legacy already-registered error shape (no code)', async () => {
    mocks.createUser.mockResolvedValue({
      data: null,
      error: { code: undefined, message: 'A user with this email address has already been registered' },
    })

    const result = await provisionAccountForPurchase({ email: 'buyer@x.com' })

    expect(mocks.generateLink).not.toHaveBeenCalled()
    expect(mocks.sendSetPasswordEmail).not.toHaveBeenCalled()
    expect(result).toEqual({ created: false, emailSent: false, error: 'account_already_exists' })
  })

  it('reports an unrelated createUser failure and sends nothing', async () => {
    mocks.createUser.mockResolvedValue({ data: null, error: { message: 'fetch failed' } })

    const result = await provisionAccountForPurchase({ email: 'buyer@x.com' })

    expect(result).toEqual({ created: false, emailSent: false, error: 'fetch failed' })
    expect(mocks.sendSetPasswordEmail).not.toHaveBeenCalled()
  })

  it('reports an account created with no link (generateLink failed)', async () => {
    mocks.generateLink.mockResolvedValue({ data: null, error: { message: 'link boom' } })

    const result = await provisionAccountForPurchase({ email: 'buyer@x.com' })

    expect(result).toEqual({ created: true, emailSent: false, error: 'link boom' })
    expect(mocks.sendSetPasswordEmail).not.toHaveBeenCalled()
  })

  it('reports a link with no token in it', async () => {
    mocks.generateLink.mockResolvedValue({ data: { properties: {} }, error: null })

    const result = await provisionAccountForPurchase({ email: 'buyer@x.com' })

    expect(result).toEqual({ created: true, emailSent: false, error: 'no token in link' })
  })

  it('reports a Brevo send failure', async () => {
    mocks.sendSetPasswordEmail.mockResolvedValue({ sent: false, skipped: 'brevo_error' })

    const result = await provisionAccountForPurchase({ email: 'buyer@x.com' })

    expect(result).toEqual({ created: true, emailSent: false, error: 'brevo_error' })
  })

  it('emails exactly once when a second call races in behind the first', async () => {
    mocks.createUser
      .mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'email_exists', message: 'x' } })

    const [first, second] = await Promise.all([
      provisionAccountForPurchase({ email: 'buyer@x.com' }),
      provisionAccountForPurchase({ email: 'buyer@x.com' }),
    ])

    expect(mocks.sendSetPasswordEmail).toHaveBeenCalledTimes(1)
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
  })
})

describe('sendSetPasswordLink', () => {
  it('mints a fresh recovery token and sends the house email', async () => {
    const result = await sendSetPasswordLink({ email: 'Buyer@X.com', fullName: 'Jane' })

    expect(mocks.createUser).not.toHaveBeenCalled()
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'buyer@x.com' })
    expect(result).toEqual({ sent: true })
  })

  it('surfaces a send failure instead of claiming success', async () => {
    mocks.sendSetPasswordEmail.mockResolvedValue({ sent: false, skipped: 'brevo_error' })

    expect(await sendSetPasswordLink({ email: 'buyer@x.com' })).toEqual({
      sent: false,
      error: 'brevo_error',
    })
  })
})

describe('setPasswordUrl', () => {
  it('builds the link from an origin, the token and the email', () => {
    expect(setPasswordUrl('https://www.fourteenfisherman.com', 'tok', 'buyer@x.com')).toBe(
      'https://www.fourteenfisherman.com/auth/set-password?token_hash=tok&email=buyer%40x.com',
    )
  })

  it('encodes a +-addressed email once, not twice', () => {
    const url = setPasswordUrl('https://www.fourteenfisherman.com', 'tok', 'buyer+sca@x.com')
    expect(url).toContain('email=buyer%2Bsca%40x.com')
    expect(url).not.toContain('%25')
    expect(new URL(url).searchParams.get('email')).toBe('buyer+sca@x.com')
  })

  it('survives a trailing-slash or path-bearing origin', () => {
    expect(setPasswordUrl('https://www.fourteenfisherman.com/', 'tok', 'b@x.com')).toContain(
      'https://www.fourteenfisherman.com/auth/set-password?',
    )
    // An absolute path replaces the base path — the link never nests under it.
    expect(setPasswordUrl('https://www.fourteenfisherman.com/uk/', 'tok', 'b@x.com')).toContain(
      'https://www.fourteenfisherman.com/auth/set-password?',
    )
  })
})

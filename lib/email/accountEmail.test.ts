import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendTransacEmail: vi.fn(),
}))

vi.mock('@getbrevo/brevo', () => ({
  BrevoClient: class {
    transactionalEmails = { sendTransacEmail: mocks.sendTransacEmail }
  },
}))

const { buildSetPasswordEmailCopy, sendSetPasswordEmail } = await import('./accountEmail')

const SET_PASSWORD_URL =
  'https://www.fourteenfisherman.com/auth/set-password?token_hash=abc123&email=buyer%40x.com'

describe('buildSetPasswordEmailCopy', () => {
  it('greets with the first name only', () => {
    expect(buildSetPasswordEmailCopy('Jane Doe').greeting).toBe('Hi Jane,')
  })

  it('falls back to "there" when the name is missing or blank', () => {
    expect(buildSetPasswordEmailCopy(null).greeting).toBe('Hi there,')
    expect(buildSetPasswordEmailCopy(undefined).greeting).toBe('Hi there,')
    expect(buildSetPasswordEmailCopy('').greeting).toBe('Hi there,')
    expect(buildSetPasswordEmailCopy('   ').greeting).toBe('Hi there,')
  })

  it('names the product in the subject and puts one job on the button', () => {
    const copy = buildSetPasswordEmailCopy('Jane')
    expect(copy.subject).toContain('Fourteen Fisherman')
    expect(copy.cta).toBe('Set my password')
  })
})

describe('sendSetPasswordEmail', () => {
  const originalKey = process.env.BREVO_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendTransacEmail.mockResolvedValue({})
    process.env.BREVO_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalKey === undefined) delete process.env.BREVO_API_KEY
    else process.env.BREVO_API_KEY = originalKey
  })

  it('skips without calling Brevo when the API key is missing', async () => {
    delete process.env.BREVO_API_KEY
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await sendSetPasswordEmail({ toEmail: 'buyer@x.com', setPasswordUrl: SET_PASSWORD_URL })

    expect(result).toEqual({ sent: false, skipped: 'missing_BREVO_API_KEY' })
    expect(mocks.sendTransacEmail).not.toHaveBeenCalled()
  })

  it('puts the set-password URL in the href verbatim', async () => {
    // An HTML-escaping regression here (&amp; for &) silently breaks the token
    // on every link we send, and the buyer sees "this link has expired".
    await sendSetPasswordEmail({
      toEmail: 'buyer@x.com',
      toName: 'Jane',
      setPasswordUrl: SET_PASSWORD_URL,
    })

    const payload = mocks.sendTransacEmail.mock.calls[0][0]
    expect(payload.htmlContent).toContain(`href="${SET_PASSWORD_URL}"`)
    expect(payload.to).toEqual([{ email: 'buyer@x.com', name: 'Jane' }])
  })

  it('reports a Brevo failure rather than throwing', async () => {
    mocks.sendTransacEmail.mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await sendSetPasswordEmail({ toEmail: 'buyer@x.com', setPasswordUrl: SET_PASSWORD_URL })).toEqual({
      sent: false,
      skipped: 'brevo_error',
    })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The one post-purchase email: three plan variants, plus the two cases the spec
 * does not cover but the payment path produces anyway (a buyer who already had
 * an account, and a monthly renewal).
 *
 * The things pinned hardest are the ones with money or law behind them: the
 * renewal date and amount on the monthly plan, the PDF being a real attachment
 * rather than a link, and reply-to actually being set — the copy invites a
 * reply three times.
 */

const mocks = vi.hoisted(() => ({ sendTransacEmail: vi.fn() }))

vi.mock('@getbrevo/brevo', () => ({
  BrevoClient: class {
    transactionalEmails = { sendTransacEmail: mocks.sendTransacEmail }
  },
  BrevoError: class extends Error {},
}))

const { buildReceiptEmailCopy, sendReceiptEmail } = await import('./receiptEmail')

const SETUP_URL =
  'https://www.fourteenfisherman.com/auth/set-password?token_hash=abc123&email=buyer%40x.com'

const PDF = Buffer.from('%PDF-1.7 pretend')

const SEND_BASE = {
  toEmail: 'buyer@x.com',
  toName: 'Jane Okonkwo',
  setupUrl: SETUP_URL,
  hasSetupLink: true,
  pdf: PDF,
  fileName: 'Fourteen-Fisherman-receipt-FF-26-4478.pdf',
} as const

describe('subjects', () => {
  it('names the course for Complete and the plan for both Self-Study variants', () => {
    expect(buildReceiptEmailCopy({ planKey: 'complete', hasSetupLink: true }).subject).toBe(
      'Your Complete SCA Course receipt',
    )
    expect(buildReceiptEmailCopy({ planKey: 'self_study', hasSetupLink: true }).subject).toBe(
      'Your Self-Study receipt',
    )
    // Monthly deliberately shares the Self-Study subject.
    expect(
      buildReceiptEmailCopy({ planKey: 'self_study_monthly', hasSetupLink: true }).subject,
    ).toBe('Your Self-Study receipt')
  })
})

describe('{{FIRST_NAME}} never produces "Hi ,"', () => {
  it.each([
    ['Jane Okonkwo', 'Hi Jane,'],
    ['Jane', 'Hi Jane,'],
    [null, 'Hi there,'],
    [undefined, 'Hi there,'],
    ['', 'Hi there,'],
    ['   ', 'Hi there,'],
  ])('greets %o as %s', (firstName, expected) => {
    expect(buildReceiptEmailCopy({ planKey: 'complete', firstName, hasSetupLink: true }).greeting).toBe(
      expected,
    )
  })

  it('falls back to the recipient name when no first name is given separately', async () => {
    process.env.BREVO_API_KEY = 'test-key'
    mocks.sendTransacEmail.mockResolvedValue({ messageId: 'm1' })

    await sendReceiptEmail({ ...SEND_BASE, planKey: 'complete', firstName: null })

    expect(mocks.sendTransacEmail.mock.calls[0][0].textContent).toContain('Hi Jane,')
    mocks.sendTransacEmail.mockReset()
  })
})

describe('Complete SCA Course', () => {
  const copy = buildReceiptEmailCopy({
    planKey: 'complete',
    firstName: 'Jane',
    sessionDate: 'Saturday 12 September 2026',
    hasSetupLink: true,
  })

  it('thanks them for the course and says the receipt is attached', () => {
    expect(copy.intro[0]).toBe(
      'Thanks for joining the Complete SCA Course. Your receipt is attached.',
    )
  })

  it('makes account setup the action', () => {
    expect(copy.ctaLabel).toBe('Set up your account')
    expect(copy.preheader).toBe('Set up your account and get started.')
  })

  it('states the coaching day and where the joining link will appear', () => {
    const body = copy.outro.join(' ')
    expect(body).toContain('Saturday 12 September 2026, 09:00 to 17:00')
    expect(body).toContain('"Coaching day"')
  })

  it('omits the coaching paragraph when no day was booked', () => {
    const noDay = buildReceiptEmailCopy({ planKey: 'complete', hasSetupLink: true })
    expect(noDay.outro.join(' ')).not.toContain('coaching day is')
  })
})

describe('Self-Study, 3 month', () => {
  const copy = buildReceiptEmailCopy({ planKey: 'self_study', firstName: 'Arun', hasSetupLink: true })

  it('thanks them for Self-Study and promises 3 months', () => {
    expect(copy.intro[0]).toBe('Thanks for signing up to Self-Study. Your receipt is attached.')
    expect(copy.outro[0]).toContain('200 stations and unlimited practice for the next 3 months')
  })

  it('says nothing about renewal, because nothing renews', () => {
    expect(copy.outro.join(' ')).not.toContain('renews')
    expect(copy.outro.join(' ')).not.toContain('subscription')
  })
})

describe('Self-Study, monthly — the renewal line', () => {
  it('states the renewal date AND the amount', () => {
    // Consumer-law requirement, and the thing that stops a chargeback.
    const copy = buildReceiptEmailCopy({
      planKey: 'self_study_monthly',
      firstName: 'Sarah',
      nextBillingDate: '27 September 2026',
      hasSetupLink: true,
    })

    const body = copy.outro.join(' ')
    expect(body).toContain('It renews on 27 September 2026 at £129')
    expect(body).toContain('again each month until you cancel')
    expect(body).toContain("you'll keep access until the end of the period you've paid for")
  })

  it('still states the amount and the cancellation right when the date is unknown', () => {
    const copy = buildReceiptEmailCopy({
      planKey: 'self_study_monthly',
      nextBillingDate: null,
      hasSetupLink: true,
    })
    expect(copy.outro.join(' ')).toContain('renews each month at £129 until you cancel')
  })

  it('never shows the £99.66 pricing-page breakdown', () => {
    const copy = buildReceiptEmailCopy({
      planKey: 'self_study_monthly',
      nextBillingDate: '27 September 2026',
      hasSetupLink: true,
    })
    expect([...copy.intro, ...copy.outro].join(' ')).not.toContain('99.66')
  })
})

describe('a buyer who already had an account', () => {
  const copy = buildReceiptEmailCopy({
    planKey: 'self_study',
    firstName: 'Arun',
    hasSetupLink: false,
  })

  it('still sends them the receipt — they paid', () => {
    expect(copy.intro[0]).toContain('Your receipt is attached.')
  })

  it('points them at sign-in instead of asking them to set a password again', () => {
    expect(copy.ctaLabel).toBe('Go to your dashboard')
    expect(copy.intro[1]).toContain('You already have an account')
    expect(copy.intro.join(' ')).not.toContain('set up your account')
  })
})

describe('a monthly renewal', () => {
  const copy = buildReceiptEmailCopy({
    planKey: 'self_study_monthly',
    firstName: 'Sarah',
    nextBillingDate: '27 October 2026',
    hasSetupLink: false,
    isRenewal: true,
  })

  it('is not a welcome email', () => {
    expect(copy.intro[0]).toBe('Your Self-Study subscription renewed today. Your receipt is attached.')
    expect(copy.intro.join(' ')).not.toContain('Thanks for signing up')
  })

  it('restates the renewal date and amount on every charge', () => {
    expect(copy.intro.join(' ')).toContain('It renews on 27 October 2026 at £129')
  })
})

describe('sendReceiptEmail', () => {
  const originalKey = process.env.BREVO_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendTransacEmail.mockResolvedValue({ messageId: 'm1' })
    process.env.BREVO_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalKey === undefined) delete process.env.BREVO_API_KEY
    else process.env.BREVO_API_KEY = originalKey
  })

  async function send(overrides = {}) {
    await sendReceiptEmail({ ...SEND_BASE, planKey: 'complete', ...overrides })
    return mocks.sendTransacEmail.mock.calls[0][0]
  }

  it('attaches the PDF as a real base64 attachment, not a link', async () => {
    // These get forwarded to deanery finance teams. A login-gated or expiring
    // link is the most common reason a study-budget claim stalls.
    const payload = await send()

    expect(payload.attachment).toEqual([
      { content: PDF.toString('base64'), name: 'Fourteen-Fisherman-receipt-FF-26-4478.pdf' },
    ])
    expect(Buffer.from(payload.attachment[0].content, 'base64').toString()).toBe(PDF.toString())
  })

  it('sets reply-to so a reply reaches a human', async () => {
    const payload = await send()
    expect(payload.replyTo).toEqual({
      name: 'Fourteen Fisherman',
      email: 'hello@fourteenfisherman.com',
    })
  })

  it('puts the setup URL in the href verbatim, unescaped', async () => {
    // An HTML-escaping regression here (&amp; for &) silently breaks the token
    // on every link we send, and the buyer sees "this link has expired".
    const payload = await send()
    expect(payload.htmlContent).toContain(`href="${SETUP_URL}"`)
    expect(payload.htmlContent).not.toContain('token_hash=abc123&amp;email')
  })

  it('carries no marketing unsubscribe link and no cross-sell', async () => {
    // Transactional stream: it must still reach somebody who unsubscribed.
    const payload = await send()
    expect(payload.htmlContent.toLowerCase()).not.toContain('unsubscribe')
    expect(payload.htmlContent.toLowerCase()).not.toContain('upgrade')
    expect(payload.tags).toEqual(['receipt', 'purchase'])
  })

  it('states the real 24-hour link expiry, not the 7 days the spec hoped for', async () => {
    const payload = await send()
    expect(payload.htmlContent).toContain('expires in 24 hours')
    expect(payload.textContent).toContain('expires in 24 hours')
    expect(payload.htmlContent).not.toContain('7 days')
  })

  it('omits the expiry note when there is no link to expire', async () => {
    const payload = await send({ setupUrl: null, hasSetupLink: false })
    expect(payload.htmlContent).not.toContain('expires in 24 hours')
    expect(payload.htmlContent).toContain('https://www.fourteenfisherman.com/dashboard')
  })

  it('tags a renewal separately so it can be told apart in Brevo', async () => {
    const payload = await send({
      planKey: 'self_study_monthly',
      setupUrl: null,
      hasSetupLink: false,
      isRenewal: true,
    })
    expect(payload.tags).toEqual(['receipt', 'renewal'])
  })

  it('skips cleanly without a Brevo key rather than throwing on the payment path', async () => {
    delete process.env.BREVO_API_KEY
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await sendReceiptEmail({ ...SEND_BASE, planKey: 'complete' })).toEqual({
      sent: false,
      skipped: 'missing_BREVO_API_KEY',
    })
    expect(mocks.sendTransacEmail).not.toHaveBeenCalled()
  })

  it('reports a Brevo failure rather than throwing', async () => {
    mocks.sendTransacEmail.mockRejectedValue(new Error('boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await sendReceiptEmail({ ...SEND_BASE, planKey: 'complete' })
    expect(result.sent).toBe(false)
    expect(result.error).toBe('boom')
  })
})

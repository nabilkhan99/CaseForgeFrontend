import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The email the founders get when a lead verifies. Brevo is mocked: no email
 * leaves this file.
 */

const mocks = vi.hoisted(() => ({
  sendTransacEmail: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@getbrevo/brevo', () => ({
  BrevoClient: class {
    transactionalEmails = { sendTransacEmail: mocks.sendTransacEmail }
  },
  BrevoError: class extends Error {
    statusCode = 500
  },
}))

const { buildLeadAlertCopy, sendLeadAlertEmail } = await import('./leadAlertEmail')

const SESSION_ID = '11111111-1111-4111-8111-111111111111'

const ARGS = {
  sessionId: SESSION_ID,
  email: 'sarah@nhs.net',
  firstName: 'Sarah',
  phone: '+447700900123',
  trainingStage: 'ST3',
  scaSitting: 'January 2027',
  stationTitle: 'Headache in a teacher',
  door: 'guest_signup' as const,
}

describe('buildLeadAlertCopy', () => {
  it('carries main’s payload: name, email, phone, training answers, station and report link', () => {
    const copy = buildLeadAlertCopy(ARGS)

    expect(copy.subject).toBe('Mock lead: Sarah (+447700900123)')
    expect(copy.feedbackUrl).toBe(`https://www.fourteenfisherman.com/try/feedback/${SESSION_ID}`)
    expect(Object.fromEntries(copy.rows)).toEqual({
      Name: 'Sarah',
      Email: 'sarah@nhs.net',
      Phone: '+447700900123',
      'Training stage': 'ST3',
      'SCA sitting': 'January 2027',
      Station: 'Headache in a teacher',
      How: 'Signed up after a free case',
    })
  })

  it('says which door an old report link came through', () => {
    const rows = Object.fromEntries(buildLeadAlertCopy({ ...ARGS, door: 'report_link' }).rows)
    expect(rows.How).toBe('Verified on a report link')
  })

  it('fills the gaps plainly, without dashes', () => {
    const copy = buildLeadAlertCopy({
      sessionId: SESSION_ID,
      email: 'sarah@nhs.net',
      door: 'guest_signup',
    })

    expect(copy.subject).toBe('Mock lead: Unknown (sarah@nhs.net)')
    expect(JSON.stringify(copy)).not.toMatch(/[–—]/)
    expect(Object.fromEntries(copy.rows).Phone).toBe('Not given')
  })
})

describe('sendLeadAlertEmail', () => {
  const originalKey = process.env.BREVO_API_KEY
  const originalRecipients = process.env.LEAD_ALERT_RECIPIENTS

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendTransacEmail.mockResolvedValue({})
    process.env.BREVO_API_KEY = 'test-key'
    delete process.env.LEAD_ALERT_RECIPIENTS
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalKey === undefined) delete process.env.BREVO_API_KEY
    else process.env.BREVO_API_KEY = originalKey
    if (originalRecipients === undefined) delete process.env.LEAD_ALERT_RECIPIENTS
    else process.env.LEAD_ALERT_RECIPIENTS = originalRecipients
  })

  it('goes to the founders’ inbox by default, tagged', async () => {
    await sendLeadAlertEmail(ARGS)

    expect(mocks.sendTransacEmail).toHaveBeenCalledOnce()
    const message = mocks.sendTransacEmail.mock.calls[0][0]
    expect(message.to).toEqual([{ email: 'hello@fourteenfisherman.com' }])
    expect(message.tags).toEqual(['lead-alert'])
    expect(message.subject).toBe('Mock lead: Sarah (+447700900123)')
    expect(message.textContent).toContain(`/try/feedback/${SESSION_ID}`)
    expect(message.htmlContent).not.toMatch(/[–—]/)
    expect(message.textContent).not.toMatch(/[–—]/)
  })

  it('honours LEAD_ALERT_RECIPIENTS', async () => {
    process.env.LEAD_ALERT_RECIPIENTS = 'a@x.com, b@x.com'

    await sendLeadAlertEmail(ARGS)

    expect(mocks.sendTransacEmail.mock.calls[0][0].to).toEqual([
      { email: 'a@x.com' },
      { email: 'b@x.com' },
    ])
  })

  it('escapes what the lead typed before it goes into HTML', async () => {
    await sendLeadAlertEmail({ ...ARGS, firstName: '<script>alert(1)</script>' })

    const html = mocks.sendTransacEmail.mock.calls[0][0].htmlContent as string
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('skips without calling Brevo when the API key is missing', async () => {
    delete process.env.BREVO_API_KEY
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await sendLeadAlertEmail(ARGS)

    expect(mocks.sendTransacEmail).not.toHaveBeenCalled()
  })

  it('never throws when Brevo does', async () => {
    mocks.sendTransacEmail.mockRejectedValue(new Error('network'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendLeadAlertEmail(ARGS)).resolves.toBeUndefined()
  })
})

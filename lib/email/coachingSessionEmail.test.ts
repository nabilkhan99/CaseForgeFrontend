import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The coaching session confirmation. Pinned hardest: the link reaching both the
 * button and the plain text, the .ics being a real attachment, names being
 * escaped, no dashes in the copy, and an unsafe link never reaching Brevo.
 */

const mocks = vi.hoisted(() => ({ sendTransacEmail: vi.fn() }))

vi.mock('@getbrevo/brevo', () => ({
  BrevoClient: class {
    transactionalEmails = { sendTransacEmail: mocks.sendTransacEmail }
  },
  BrevoError: class extends Error {
    statusCode = 400
  },
}))

const { buildCoachingSessionEmail, sendCoachingSessionEmail, RETRY_DELAY_MS } = await import(
  './coachingSessionEmail'
)

const ARGS = {
  orderId: '4b082b91-3db7-4a79-99c3-c7ed5c507e45',
  toEmail: 'student@example.com',
  toName: 'Emily',
  day: '2026-10-04',
  slot: 'morning' as const,
  coachName: 'Dr Hassan Khan',
  meetingUrl: 'https://meet.google.com/abc-defg-hij',
}

const NOW = new Date('2026-09-29T09:00:00Z')

describe('buildCoachingSessionEmail', () => {
  it('names the date, the slot and the coach', () => {
    const email = buildCoachingSessionEmail(ARGS, NOW)
    expect(email.subject).toBe('Your coaching session: Sunday 4 October, 09:00 to 12:00')
    expect(email.htmlContent).toContain('Your coaching session is confirmed.')
    expect(email.htmlContent).toContain('Hi Emily,')
    expect(email.htmlContent).toContain(
      'with Dr Hassan Khan is booked for <strong>Sunday 4 October 2026, 09:00 to 12:00 (UK time)</strong>.',
    )
    expect(email.textContent).toContain(
      'Your one to one coaching session with Dr Hassan Khan is booked for Sunday 4 October 2026, 09:00 to 12:00 (UK time).',
    )
  })

  it('puts the link behind the button and in the plain text', () => {
    const email = buildCoachingSessionEmail(ARGS, NOW)
    expect(email.htmlContent).toContain(`href="${ARGS.meetingUrl}"`)
    expect(email.htmlContent).toContain('Join the session')
    expect(email.textContent).toContain(`Join the session: ${ARGS.meetingUrl}`)
  })

  it('attaches an ics for the right instant', () => {
    const email = buildCoachingSessionEmail(ARGS, NOW)
    expect(email.icsFileName).toBe('coaching-session.ics')
    expect(email.ics).toContain('DTSTART:20261004T080000Z')
    expect(email.ics).toContain('DTEND:20261004T110000Z')
    expect(email.ics).toContain(`UID:coaching-${ARGS.orderId}@fourteenfisherman.com`)
  })

  it('greets by first name, skipping a title, and falls back to "there"', () => {
    expect(buildCoachingSessionEmail({ ...ARGS, toName: 'Dr Jane Smith' }, NOW).textContent).toMatch(
      /^Hi Jane,/,
    )
    expect(buildCoachingSessionEmail({ ...ARGS, toName: null }, NOW).textContent).toMatch(/^Hi there,/)
    expect(buildCoachingSessionEmail({ ...ARGS, toName: '  ' }, NOW).textContent).toMatch(/^Hi there,/)
  })

  it('escapes person-typed names in the html', () => {
    const email = buildCoachingSessionEmail(
      { ...ARGS, toName: 'Amy <b>', coachName: 'Dr O"Brien & Co' },
      NOW,
    )
    expect(email.htmlContent).toContain('Dr O&quot;Brien &amp; Co')
    expect(email.htmlContent).not.toContain('Dr O"Brien & Co')
    expect(email.htmlContent).not.toContain('<b>,')
  })

  it('carries no em or en dashes and never mentions a group or a full day', () => {
    const email = buildCoachingSessionEmail(ARGS, NOW)
    for (const text of [email.subject, email.htmlContent, email.textContent]) {
      expect(text).not.toMatch(/[–—]/)
      expect(text).not.toMatch(/small group|group session|full day|09:00 to 17/i)
    }
  })

  it('names an afternoon slot correctly', () => {
    const email = buildCoachingSessionEmail({ ...ARGS, day: '2026-11-07', slot: 'afternoon' }, NOW)
    expect(email.subject).toBe('Your coaching session: Saturday 7 November, 13:00 to 16:00')
    expect(email.ics).toContain('DTSTART:20261107T130000Z')
  })
})

describe('sendCoachingSessionEmail', () => {
  const originalKey = process.env.BREVO_API_KEY

  beforeEach(() => {
    process.env.BREVO_API_KEY = 'test-key'
    mocks.sendTransacEmail.mockReset()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.BREVO_API_KEY = originalKey
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('skips without an API key', async () => {
    delete process.env.BREVO_API_KEY
    await expect(sendCoachingSessionEmail(ARGS)).resolves.toEqual({
      sent: false,
      error: 'missing_BREVO_API_KEY',
    })
    expect(mocks.sendTransacEmail).not.toHaveBeenCalled()
  })

  it('never hands an unsafe link to Brevo', async () => {
    for (const meetingUrl of ['javascript:alert(1)', 'http://meet.google.com/x', 'https://x.com/"a']) {
      await expect(sendCoachingSessionEmail({ ...ARGS, meetingUrl })).resolves.toEqual({
        sent: false,
        error: 'invalid_meeting_url',
      })
    }
    expect(mocks.sendTransacEmail).not.toHaveBeenCalled()
  })

  it('sends with reply-to, the tag and the ics as a base64 attachment', async () => {
    mocks.sendTransacEmail.mockResolvedValue({ messageId: '<abc@smtp-relay>' })
    await expect(sendCoachingSessionEmail(ARGS)).resolves.toEqual({
      sent: true,
      brevoMessageId: '<abc@smtp-relay>',
    })
    const payload = mocks.sendTransacEmail.mock.calls[0][0]
    expect(payload.to).toEqual([{ email: 'student@example.com', name: 'Emily' }])
    expect(payload.replyTo.email).toBe('hello@fourteenfisherman.com')
    expect(payload.subject).toBe('Your coaching session: Sunday 4 October, 09:00 to 12:00')
    expect(payload.tags).toEqual(['coaching-session'])
    expect(payload.attachment).toHaveLength(1)
    expect(payload.attachment[0].name).toBe('coaching-session.ics')
    const ics = Buffer.from(payload.attachment[0].content, 'base64').toString('utf8')
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/)
    expect(ics).toContain('DTSTART:20261004T080000Z')
  })

  it('omits the recipient name when there is none', async () => {
    mocks.sendTransacEmail.mockResolvedValue({ messageId: 'm1' })
    await sendCoachingSessionEmail({ ...ARGS, toName: null })
    expect(mocks.sendTransacEmail.mock.calls[0][0].to).toEqual([{ email: 'student@example.com' }])
  })

  it('retries once after a dropped connection', async () => {
    vi.useFakeTimers()
    mocks.sendTransacEmail
      .mockRejectedValueOnce(new Error('SocketError: other side closed'))
      .mockResolvedValueOnce({ messageId: 'm2' })
    const pending = sendCoachingSessionEmail(ARGS)
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    await expect(pending).resolves.toEqual({ sent: true, brevoMessageId: 'm2' })
    expect(mocks.sendTransacEmail).toHaveBeenCalledTimes(2)
  })

  it('reports failure when both attempts fail', async () => {
    vi.useFakeTimers()
    mocks.sendTransacEmail.mockRejectedValue(new Error('boom'))
    const pending = sendCoachingSessionEmail(ARGS)
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_MS)
    await expect(pending).resolves.toEqual({ sent: false, error: 'boom' })
    expect(mocks.sendTransacEmail).toHaveBeenCalledTimes(2)
  })
})

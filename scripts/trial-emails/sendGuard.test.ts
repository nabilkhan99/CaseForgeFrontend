import { describe, expect, it } from 'vitest'
import { buildTrialDay3Email, buildTrialDay5Email } from '@/lib/email/trialEmails'
import { assertSendable } from './sendGuard'

const DASHBOARD = 'https://www.fourteenfisherman.com/dashboard'
const TO = 'trainee@nhs.net'

const day3 = buildTrialDay3Email({
  firstName: 'Jane',
  daysLeft: 2,
  casesTried: 2,
  endsAt: new Date('2026-09-11T09:00:00Z'),
  dashboardUrl: DASHBOARD,
})
const day5 = buildTrialDay5Email({
  firstName: 'Jane',
  marks: [{ verdict: 'Bare Fail' }, { verdict: 'Bare Fail' }],
  dashboardUrl: DASHBOARD,
})

describe('assertSendable', () => {
  it('passes both real templates', () => {
    expect(() => assertSendable(day3, TO)).not.toThrow()
    expect(() => assertSendable(day5, TO)).not.toThrow()
  })

  it('refuses anything that is not a whole document', () => {
    expect(() => assertSendable({ ...day3, html: '' }, TO)).toThrow(/not a document/)
    expect(() => assertSendable({ ...day3, html: '<p>hello</p>' }, TO)).toThrow(/not a document/)
  })

  it('accepts the doctype in any case, because clients and formatters differ', () => {
    const shouty = { ...day3, html: day3.html.replace('<!doctype html', '<!DOCTYPE HTML') }
    expect(() => assertSendable(shouty, TO)).not.toThrow()
  })

  it('refuses a shell with the body missing', () => {
    const stub = { ...day3, html: `<!doctype html><html><body>${'x'.repeat(100)}</body></html>` }
    expect(() => assertSendable(stub, TO)).toThrow(/body is missing/)
  })

  it("refuses an email built for somebody else", () => {
    // The classic loop-variable bug: the right recipient, the wrong body.
    expect(() => assertSendable({ ...day3, greeting: 'Hi Amina,' }, TO)).toThrow(
      /does not carry this recipient/,
    )
  })

  it('handles a name that had to be escaped in the html', () => {
    const escaped = buildTrialDay3Email({
      firstName: 'Ben & Co',
      daysLeft: 1,
      endsAt: new Date('2026-09-11T09:00:00Z'),
      dashboardUrl: DASHBOARD,
    })
    expect(escaped.greeting).toBe('Hi Ben,')
    expect(() => assertSendable(escaped, TO)).not.toThrow()
  })
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * /try/feedback/[sessionId] opened by anybody but the browser that ran it.
 *
 * Owner decision, Sept 2026: old report links (from before the guest cookie,
 * forwarded ones, the link in a founder's lead alert) behave exactly as main
 * did. A verified lead sees the full report straight away; anybody else gets
 * main's email gate, then the report. No account is made on that path.
 *
 * Source assertions, because vitest runs in `node` here and there is no DOM to
 * render the page into. The server halves (gate-status, send-code,
 * verify-code) have their own route tests.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments discuss the rules; only the code and the copy are bound by them. */
function withoutComments(code: string): string {
  return code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

const PAGE = source('./[sessionId]/page.tsx')
const REPORT = source('../../../components/try/GatedTrialReport.tsx')
const GATE = source('../../../components/try/EmailVerificationGate.tsx')
const FIELDS = source('../../../components/try/gateFields.tsx')

/** The part of the page that runs when the cookie does not prove the session. */
const UNPROVEN = PAGE.slice(PAGE.indexOf("from('trial_leads')") - 200)

describe('which link gets main’s page', () => {
  it('is every link the guest cookie does not prove', () => {
    expect(PAGE).toContain('const proven = await browserRanIt(sessionId)')
    expect(PAGE.indexOf('if (proven) {')).toBeLessThan(PAGE.indexOf('<GatedTrialReport'))
  })

  it('decides "verified" on the server, from the lead on this session', () => {
    expect(UNPROVEN).toContain(".select('email_verified_at')")
    expect(UNPROVEN).toContain(".eq('session_id', sessionId)")
    expect(UNPROVEN).toContain('const verified = Boolean(lead?.email_verified_at)')
    expect(UNPROVEN).toContain('<GatedTrialReport sessionId={sessionId} verified={verified} />')
  })

  it('sends an owned session with no verified lead to the dashboard, since no gate could open it', () => {
    expect(UNPROVEN).toContain(
      'if (session.user_id && !verified) redirect(`/clinical-master/feedback/${sessionId}`)',
    )
  })

  it('names the tab for what is on it', () => {
    expect(PAGE).toContain("'Set up your free account' : 'Your feedback report'")
  })
})

describe('a verified lead sees the report straight away', () => {
  it('starts unlocked when the server says so', () => {
    expect(REPORT).toContain('useState(verified)')
    expect(REPORT).toContain('if (!unlocked) {')
    expect(REPORT).toContain('<EmailVerificationGate sessionId={sessionId} onUnlock={handleUnlock} />')
  })

  it('renders main’s report page under it: the report, the offer, the quotes and the plans', () => {
    expect(REPORT).toContain('<FeedbackReport')
    expect(REPORT).toContain('variant="trial"')
    expect(REPORT).toContain('<StationsPassedBar')
    expect(REPORT).toContain('<TrialProof />')
    expect(REPORT).toContain('<PricingTable />')
    expect(REPORT).toContain('<GuaranteeCard />')
  })
})

describe('anybody else gets main’s gate', () => {
  it('asks main’s questionnaire, saving as it goes', () => {
    expect(GATE).toContain('buildSteps(answers)')
    expect(GATE).toContain("'/api/try/save-lead'")
    expect(GATE).toContain('Enter your details to see your feedback')
  })

  it('sends the code through the legacy gate shape, with every answer', () => {
    const send = GATE.slice(GATE.indexOf("'/api/try/send-code'"))
    expect(send).toContain('JSON.stringify({ sessionId, ...answers, email: email.trim() })')
    expect(send.slice(0, 400)).not.toContain('mode:')
  })

  it('verifies with the session and the code, and nothing that could make an account', () => {
    const verify = GATE.slice(GATE.indexOf("'/api/try/verify-code'"))
    expect(verify).toContain('JSON.stringify({ sessionId, code: candidate })')
    expect(verify.slice(0, 400)).not.toMatch(/password|phone/)
  })

  it('ends at the email: there is no SMS step', () => {
    const code = withoutComments(GATE).toLowerCase()
    expect(code).not.toMatch(/send-phone-code|verify-phone-code|phonecode|check your phone/)
  })

  it('keeps main’s copy', () => {
    for (const line of [
      "We&apos;ll send a 6-digit code to verify your email, then your report opens",
      'Send my verification code',
      'Check your inbox',
      'No email? Check spam.',
      'Edit email',
      'You&apos;re verified',
      'Show my feedback',
    ]) {
      expect(GATE).toContain(line)
    }
    expect(FIELDS).toContain('Consultation complete')
  })

  it('writes no dashes in any copy on the page', () => {
    for (const file of [GATE, FIELDS, REPORT]) {
      expect(withoutComments(file)).not.toMatch(/[–—]/)
    }
    expect(REPORT).toContain('Keep practising until you pass, or we pay you £500.')
  })

  it('counts cases, not stations, in its own copy', () => {
    expect(REPORT).toContain('That was 1 of 200 cases')
  })
})

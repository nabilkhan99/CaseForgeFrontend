import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * /try/feedback/[sessionId] — the minute after a guest consultation. Contract C4.
 *
 * There is no DOM runner in this project (vitest runs in `node`), so what is
 * pinned here is the wiring and the copy, the same way app/free/start does it.
 * Both matter more than usual on this page: it is the single conversion point
 * of the whole guest funnel, and every failure it can have is silent —
 * a questionnaire creeping back in, the report rendering here instead of in the
 * dashboard, a second poll against gate-status, or a promise about the password
 * that a legacy session cannot keep.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments discuss the rules; only the code and the copy are bound by them. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const PAGE = source('./[sessionId]/page.tsx')
const FORM = source('../../../components/try/SignUpWhileMarking.tsx')
const FORM_COPY = withoutComments(FORM)

describe('which page a visitor gets', () => {
  it('hands an owned session to the dashboard report', () => {
    // The claim has happened — in another tab, or on an account made later.
    // The dashboard's report checks ownership itself; this only points at it.
    expect(PAGE).toContain("select('id, user_id')")
    expect(PAGE).toContain('if (session?.user_id) redirect(`/clinical-master/feedback/${sessionId}`)')
  })

  it('offers the five free cases when the session does not exist', () => {
    expect(PAGE).toContain('That consultation has gone')
    expect(PAGE).toContain('Try 5 free cases')
  })

  it('renders the sign-up for an unowned one', () => {
    expect(PAGE).toContain('<SignUpWhileMarking sessionId={sessionId} />')
  })
})

describe('what the page says while the mark runs', () => {
  it('states the wait, and that it ends', () => {
    expect(FORM).toContain('Set up your account while we mark your consultation')
    expect(FORM).toContain('Marking your consultation. It takes about a minute.')
  })

  it('says so when the result lands', () => {
    expect(FORM).toContain('Your report is ready')
  })

  it('keeps offering the account when the run was too short to mark', () => {
    expect(FORM).toContain(
      'You can still set up your free account and run it properly from your dashboard.',
    )
  })

  it('polls once for the whole page', () => {
    // The status line and VerdictReveal read one loop. Two would be two
    // requests every three seconds for one fact.
    expect(FORM).toContain('useVerdictPoll(sessionId)')
    expect(FORM).toContain('state={marking}')
    expect(FORM).toContain('showWaiting={false}')
  })
})

describe('what it asks for', () => {
  it('has exactly three fields: email, mobile, password', () => {
    expect(FORM).toContain('<EmailField id="marking-email"')
    expect(FORM).toContain('<MobileField id="marking-phone"')
    expect(FORM).toContain('<PasswordField id="marking-password"')
  })

  it('asks no questionnaire and takes no SMS step', () => {
    // Both are what people left at. The exam questions are asked on the
    // dashboard while the first mark runs.
    expect(FORM_COPY).not.toMatch(/trainingStage|aktStatus|scaSitting|questionnaire/i)
    expect(FORM_COPY.toLowerCase()).not.toMatch(/\bsms\b|send-phone-code|verify-phone-code/)
  })

  it('names the outcome on the button, and promises nothing about the password', () => {
    // A legacy report link has no `ff_guest` cookie, so verify-code cannot set
    // the password — the account is still made, and the copy stays true.
    expect(FORM).toContain('Create my free account')
    expect(FORM_COPY).not.toMatch(/password (is|will be) set/i)
  })

  it('says "no card" once, and never uses "sign up" as a verb', () => {
    expect(FORM_COPY.toLowerCase().match(/no card/g) ?? []).toHaveLength(1)
    expect(FORM_COPY.toLowerCase()).not.toMatch(/sign[ -]up/)
  })
})

describe('the three requests it makes', () => {
  it('saves the lead before the code, so an abandoned form still leaves a row', () => {
    expect(FORM).toContain("'/api/try/save-lead'")
    expect(FORM).toContain('saveLead();')
  })

  it('asks for the code on the guest door, opting into the relaxed validation', () => {
    const send = FORM.slice(FORM.indexOf("'/api/try/send-code'"))
    expect(send).toContain('sessionId,')
    expect(send).toContain("mode: 'guest_signup'")
  })

  it('verifies with the session, the address, the password and the mobile', () => {
    const verify = FORM.slice(FORM.indexOf("'/api/try/verify-code'"))
    expect(verify).toContain('sessionId,')
    expect(verify).toContain('code: candidate')
    // A returning trainee's verified lead stays on the consultation it was
    // verified against, so the address is what finds it for this one.
    expect(verify).toContain('email: cleanEmail')
    expect(verify).toContain('password,')
    expect(verify).toContain('...(phone.trim() ? { phone: phone.trim() } : {})')
  })

  it('follows the server’s redirect with a full navigation', () => {
    // The session cookies arrive on the verify response and the report is a
    // server component, so a client-side push would render it signed out.
    expect(FORM).toContain('window.location.assign(data.redirectTo)')
  })
})

describe('what no longer renders here', () => {
  it('shows no report, no pricing table and no guarantee', () => {
    // The report moved into the dashboard, on an account that owns it. This
    // page shows only the verdict summary gate-status has always allowed.
    expect(PAGE).not.toMatch(/FeedbackReport|PricingTable|GuaranteeCard|StationsPassedBar/)
    expect(FORM).not.toMatch(/FeedbackReport|PricingTable|GuaranteeCard/)
  })

  it('has no email gate left to unlock', () => {
    expect(PAGE).not.toContain('EmailVerificationGate')
    expect(PAGE).not.toContain('OpenDashboardButton')
  })
})

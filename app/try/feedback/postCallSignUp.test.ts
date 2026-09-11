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
    expect(PAGE).toContain("select('id, user_id, station_id')")
    expect(PAGE).toContain('if (session?.user_id) redirect(`/clinical-master/feedback/${sessionId}`)')
  })

  it('offers the five free cases when the session does not exist', () => {
    expect(PAGE).toContain('That consultation has gone')
    expect(PAGE).toContain('Try 5 free cases')
  })

  it('renders the sign-up for an unowned one, with the case it was on', () => {
    expect(PAGE).toContain(
      '<SignUpWhileMarking sessionId={sessionId} stationId={session.station_id ?? null} />',
    )
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
    expect(FORM).toContain('You can still set up your free account and run it again.')
  })

  it('stops promising a mark on a consultation nobody finished', () => {
    // A closed tab leaves the row on `live`: no transcript was saved and no
    // mark was ever requested, so the five-minute poll was five minutes of a
    // promise nobody could keep.
    expect(FORM).toContain(
      "This one wasn't finished. Set up your account and run it again from your dashboard.",
    )
    expect(FORM).toContain("case 'unfinished':")
  })

  it('drives the heading off the poll, not off the premise', () => {
    // "While we mark your consultation" over a line saying it was never
    // finished reads as a page that has lost track of what happened.
    expect(FORM).toContain('{headingFor(marking.kind)}')
    expect(FORM).toContain("return 'Set up your free account'")
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
    expect(FORM).toMatch(/<EmailField\s+id="marking-email"/)
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

  it('saves it on BLUR, which is what an abandoning visitor actually does', () => {
    // The button is precisely what somebody walking away does not press. The
    // gate this replaced saved per question, so submit-only would be a step
    // backwards: every address typed and left would leave nothing behind.
    expect(FORM).toContain('onBlur={saveLead}')
    // And only once there is an address worth writing, and not twice for the
    // same one — blur fires on every focus change.
    expect(FORM).toContain('if (!EMAIL_RE.test(cleanEmail) || savedLead.current === fingerprint) return;')
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

describe('a run too short to mark', () => {
  it('offers to run THAT case properly, not the five in general', () => {
    // It was a dead end: the person has no report, no account and no way back
    // into the case they just tried, which costs the consultation AND the
    // account it was going to earn.
    expect(FORM).toContain('`/try/talk?station=${encodeURIComponent(stationId)}`')
    expect(FORM).toContain('retryHref={retryHref}')
    expect(FORM).not.toContain('retryHref={null}')
  })

  it('falls back to the first free case when the row names no station', () => {
    expect(FORM).toContain(": '/try/talk'")
  })

  it('still offers the account, because the account is still worth having', () => {
    expect(FORM).toContain('You can still set up your free account and run it again.')
  })
})

describe('the poll ends when no mark is coming', () => {
  const REVEAL = source('../../../components/try/VerdictReveal.tsx')

  it('reads the server’s unfinished verdict instead of waiting five minutes', () => {
    expect(REVEAL).toContain("if (data.status === 'unfinished')")
    expect(REVEAL).toContain("setState({ kind: 'unfinished' })")
  })

  it('reveals nothing for it — there is no result to reveal', () => {
    expect(REVEAL).toContain(
      "if (state.kind === 'silent' || state.kind === 'unfinished') return null;",
    )
  })
})

describe('an address that already has an account', () => {
  const FREE_START = source('../../../components/free/FreeStart.tsx')
  const FIELDS = source('../../../components/account/AccountFormFields.tsx')

  it('says the typed password was not the one that counts', () => {
    // verify-code keeps an existing password on purpose — rotating one because
    // somebody typed the address into a free form would be a takeover with a
    // friendly name. Keeping it silently is how people end up locked out of an
    // account they believe they just set a password on.
    expect(FIELDS).toContain(
      "You already have an account. We've signed you in; your existing password still applies.",
    )
  })

  it('shows it on BOTH doors, from one string', () => {
    for (const form of [FORM, FREE_START]) {
      expect(form).toContain('EXISTING_ACCOUNT_NOTICE')
      expect(form).toContain('data.account?.alreadyExisted && data.account?.passwordKept')
      expect(form).toContain('setNotice(EXISTING_ACCOUNT_NOTICE)')
    }
  })

  it('waits for it to be read, then goes where the server said', () => {
    // Still a redirect, and still the server's: they ARE signed in, and the
    // report is what they are owed. The pause is long enough for one sentence.
    for (const form of [FORM, FREE_START]) {
      expect(form).toContain(
        'await new Promise((resolve) => setTimeout(resolve, EXISTING_ACCOUNT_NOTICE_MS));',
      )
      expect(form).toContain('window.location.assign(data.redirectTo)')
    }
    expect(FIELDS).toContain('export const EXISTING_ACCOUNT_NOTICE_MS = 3000;')
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

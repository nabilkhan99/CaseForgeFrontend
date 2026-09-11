import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '@/lib/auth/passwordPolicy'
import { startPrefill } from '@/lib/trial/freeParams'

/**
 * /free/start — the one door into the trial, checked against its source.
 *
 * There is no DOM test runner in this project (vitest runs in `node`), so the
 * form cannot be rendered and asserted on. What CAN be pinned is the wiring and
 * the copy rules, and both matter more than usual here: this page is now the
 * only way into the free trial, so a field that silently became required, a
 * request that stopped carrying the station, or a button that went back to
 * naming a mechanism are all failures nothing else would catch.
 *
 * Same readFileSync approach app/free/page.test.ts and Hero.test.ts use.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments discuss the copy rules; only the copy itself is bound by them. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const PAGE = source('./page.tsx')
const FORM = source('../../../components/free/FreeStart.tsx')
const FORM_COPY = withoutComments(FORM)

describe('what the page asks for', () => {
  it('leads with the account, not the mechanism', () => {
    expect(FORM).toContain('Create your free account')
    expect(FORM).toContain(
      'Five cases, unlimited attempts, five days. Your first verdict is minutes away.',
    )
  })

  it('has exactly three fields: email, mobile, password', () => {
    expect(FORM).toContain('id="start-email"')
    expect(FORM).toContain('id="start-phone"')
    expect(FORM).toContain('id="start-password"')
    // No first name, no exam date, no training stage. Those are asked on the
    // dashboard after the first station.
    expect(FORM).not.toContain('id="start-first-name"')
  })

  it('does not require the mobile, and never calls it optional', () => {
    // Two halves of one rule: a field labelled with its own unimportance is a
    // field nobody fills in, and a `required` on it would contradict the label.
    const phoneField = FORM.slice(FORM.indexOf('id="start-phone"'))
    expect(phoneField.slice(0, phoneField.indexOf('/>'))).not.toContain('required')
    expect(FORM_COPY.toLowerCase()).not.toContain('optional')
    expect(FORM).toContain('Mobile')
    expect(FORM).toContain('placeholder="+44 7…"')
  })

  it('states the password rule once, from the same constant the server checks', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(PASSWORD_HINT).toBe('8 characters or more')
    expect(FORM).toContain('{PASSWORD_HINT}')
    expect(FORM).toContain('passwordLongEnough(password)')
    expect(FORM).toContain('minLength={MIN_PASSWORD_LENGTH}')
  })

  it('lets the password be read back', () => {
    expect(FORM).toContain("type={revealPassword ? 'text' : 'password'}")
    expect(FORM).toContain("aria-label={revealPassword ? 'Hide password' : 'Show password'}")
  })
})

describe('the copy rules', () => {
  it('names the outcome on the button', () => {
    expect(FORM).toContain('Create my free account')
  })

  it('never uses "sign up" as a verb', () => {
    expect(FORM_COPY.toLowerCase()).not.toMatch(/sign[ -]up/)
  })

  it('says "no card" once', () => {
    expect(FORM_COPY.toLowerCase().match(/no card/g) ?? []).toHaveLength(1)
  })

  it('never promises a second email after the code', () => {
    // The verify response carries the session cookies, so there is no inbox
    // trip after the code and nothing here may imply one.
    expect(FORM_COPY.toLowerCase()).not.toContain('sign-in link')
    expect(FORM_COPY).not.toContain('Check your inbox')
  })
})

describe('the two requests it makes', () => {
  it('asks for a code as a sign-up, which is what earns the "already have an account" answer', () => {
    expect(FORM).toContain("JSON.stringify({ mode: 'signup', intent: 'signup', email: cleanEmail })")
  })

  it('sends the password, the mobile and the station with the code', () => {
    const verify = FORM.slice(FORM.indexOf("'/api/try/verify-code'"))
    expect(verify).toContain('code: candidate')
    expect(verify).toContain('password,')
    expect(verify).toContain("...(phone.trim() ? { phone: phone.trim() } : {})")
    expect(verify).toContain('...(station ? { station } : {})')
  })

  it('follows the server’s redirect with a full navigation', () => {
    // The cookies arrive on the verify response; every server component past
    // here has to be rendered with them, so a client-side push will not do.
    expect(FORM).toContain('window.location.assign(data.redirectTo)')
  })
})

describe('an address that already has an account', () => {
  it('offers the sign-in, and a code as the way round a forgotten password', () => {
    expect(FORM).toContain('You already have an account. Sign in instead.')
    expect(FORM).toContain('/auth/sign-in?email=')
    expect(FORM).toContain('/free/open?email=')
  })
})

describe('the station carried through', () => {
  it('is read from the query and named on the page', () => {
    expect(PAGE).toContain('startPrefill(await searchParams)')
    expect(PAGE).toContain('stationTitle={station ? await stationTitle(station) : null}')
    expect(FORM).toContain("You&apos;ll start on")
  })

  it('only survives when it is a uuid', () => {
    const station = '2b0d9a5e-0000-4000-8000-000000000000'
    expect(startPrefill({ station })).toEqual({ email: undefined, station })
    expect(startPrefill({ station: 'https://evil.example.com' }).station).toBeUndefined()
  })

  it('prefills the address handed over from another surface', () => {
    expect(startPrefill({ email: 'sarah@nhs.net' }).email).toBe('sarah@nhs.net')
  })

  it('renders the form without the station line rather than 500ing', () => {
    // The title is a reassurance, not the page. `listFreeStations` fails soft
    // for the same reason on /free.
    expect(PAGE).toContain('return null')
    expect(PAGE).toContain('[free/start] could not name the station')
  })
})

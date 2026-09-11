import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  TRIAL_CLAIMED_KEY,
  TRIAL_FEEDBACK_URL_KEY,
  TRIAL_USED_KEY,
  getTrialState,
  markTrialClaimed,
  markTrialSessionStarted,
} from './storage'

/**
 * What the browser remembers about a guest consultation, and the one decision
 * that reads it.
 *
 * `ff_trial_used` is written when a consultation STARTS, so on its own it
 * cannot tell a finished funnel from an abandoned one — and the navbar, reading
 * only that, offered "See your feedback" to somebody who had walked out of a
 * call, on a link that lands on the sign-up form. A promise of a report,
 * answered by a form.
 *
 * None of this gates anything: the report page decides who may read what. It
 * decides a label and a deep link.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const NAVBAR = source('../../components/landing/LandingNavbar.tsx')
const FORM = source('../../components/try/SignUpWhileMarking.tsx')

/** vitest runs in `node`, so the one `window` this module touches is built here. */
function installStorage(): Map<string, string> {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    },
  })
  return store
}

let store: Map<string, string>

beforeEach(() => {
  store = installStorage()
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
})

describe('what a started consultation remembers', () => {
  it('records the run and where its report will live', () => {
    markTrialSessionStarted('session-1')

    expect(store.get(TRIAL_USED_KEY)).toBe('1')
    expect(store.get(TRIAL_FEEDBACK_URL_KEY)).toBe('/try/feedback/session-1')
    expect(getTrialState()).toMatchObject({ used: true, claimed: false })
  })

  it('does not carry the last consultation’s account onto a new one', () => {
    markTrialClaimed()
    markTrialSessionStarted('session-2')

    // Otherwise the navbar would offer a report for a run that was abandoned.
    expect(store.has(TRIAL_CLAIMED_KEY)).toBe(false)
    expect(getTrialState().claimed).toBe(false)
  })

  it('reports the account once one has been made', () => {
    markTrialSessionStarted('session-1')
    markTrialClaimed()

    expect(getTrialState()).toMatchObject({
      used: true,
      claimed: true,
      feedbackUrl: '/try/feedback/session-1',
    })
  })

  it('reads as a browser that has done nothing when storage is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'window')

    expect(getTrialState()).toEqual({
      email: null,
      used: false,
      feedbackUrl: null,
      claimed: false,
    })
    // And writing must not throw into a page render either.
    expect(() => markTrialClaimed()).not.toThrow()
    expect(() => markTrialSessionStarted('session-1')).not.toThrow()
  })
})

describe('the navbar says which of the two it is', () => {
  it('names the unfinished sign-up for what it is', () => {
    expect(NAVBAR).toContain(
      "label: trial.claimed ? 'See your feedback' : 'Finish your free account',",
    )
    // Same destination either way — /try/feedback is both the form and, once
    // the session is owned, a redirect to the report.
    expect(NAVBAR).toContain('href: trial.feedbackUrl,')
  })

  it('is set where the account is actually made', () => {
    expect(FORM).toContain('markTrialClaimed()')
    // In `rememberAddress`, which only runs on a verified code.
    expect(FORM.slice(FORM.indexOf('function rememberAddress'))).toContain('markTrialClaimed();')
  })
})

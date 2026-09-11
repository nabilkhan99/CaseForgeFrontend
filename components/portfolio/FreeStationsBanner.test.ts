import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The one line above the portfolio tool that introduces the SCA product.
 *
 * Two things it must keep doing, and they pull in opposite directions:
 *
 *   * it must gate NOTHING. The portfolio tool below has active users who came
 *     for CCRs and works exactly the same whether this is read, filled in or
 *     ignored. A hard email gate on it is explicitly out of scope;
 *   * the address, when somebody does type one, is handed to /free/start in
 *     the query and that page does the whole of the sign-up. This banner is
 *     the one free surface that still leads with the account, because an
 *     address typed here is a person saying "send me this", not a person about
 *     to spend twelve minutes on a consultation.
 *
 * Source assertions, because vitest runs in `node` here and there is no DOM to
 * render a client component into.
 */

const SOURCE = readFileSync(
  fileURLToPath(new URL('./FreeStationsBanner.tsx', import.meta.url)),
  'utf8',
)

/** Comments explain the rules; only the code and the copy are bound by them. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const CODE = withoutComments(SOURCE)

describe('what the banner says', () => {
  it('offers five free SCA cases with an AI patient', () => {
    expect(CODE).toContain('five free SCA cases')
    expect(CODE).toContain('with an AI patient')
  })

  it('counts cases, not stations, at a reader who has never sat one', () => {
    expect(CODE.toLowerCase()).not.toContain('free sca stations')
    expect(CODE.toLowerCase()).not.toContain('five free stations')
  })
})

describe('where it sends people', () => {
  it('sends a plain click to the picker', () => {
    expect(CODE).toContain('href="/free"')
  })

  it('hands an address over to the account form, in the query', () => {
    expect(CODE).toContain('/free/start?email=${encodeURIComponent(clean)}')
  })

  it('sends no code of its own', () => {
    // A code mailed before anybody has chosen a password expires while they
    // are still filling the form in. /free/start owns the sign-up.
    expect(CODE).not.toContain('send-code')
  })
})

describe('what it does not do', () => {
  it('gates nothing: no request is made before the hand-over', () => {
    expect(CODE).not.toContain('fetch(')
  })

  it('refuses to hand over something that is not an address', () => {
    expect(CODE).toContain('/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(clean)')
  })
})

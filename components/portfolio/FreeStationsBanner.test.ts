import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The one line above the portfolio tool that introduces the SCA product.
 *
 *   * it must gate NOTHING. The portfolio tool below has active users who came
 *     for CCRs and works exactly the same whether this is read, clicked or
 *     ignored. A hard email gate on it is explicitly out of scope;
 *   * it is a plain link to /free, the one door into the free cases. No email
 *     field, and no address in any URL.
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

  it('names the link for what it does', () => {
    expect(CODE).toContain('Try 5 free cases')
  })
})

describe('where it sends people', () => {
  it('links to the five cases on /free, and nowhere else', () => {
    expect(CODE).toContain('href="/free"')
    expect(CODE.match(/href=/g) ?? []).toHaveLength(1)
  })

  it('puts no address in any URL', () => {
    expect(CODE).not.toContain('email=')
    expect(CODE).not.toContain('encodeURIComponent')
  })
})

describe('what it does not do', () => {
  it('has no form and no email field', () => {
    expect(CODE).not.toContain('<form')
    expect(CODE).not.toContain('<input')
    expect(CODE).not.toContain('type="email"')
  })

  it('gates nothing: it makes no request of its own', () => {
    expect(CODE).not.toContain('fetch(')
    expect(CODE).not.toContain('send-code')
    expect(CODE).not.toContain('window.location')
  })
})

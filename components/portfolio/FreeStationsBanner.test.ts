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

describe('where it sits', () => {
  // Both navbars are position: fixed. Rendered before them, the strip sat
  // under the navbar at the top of the page and nobody could see it, which
  // is how it spent its first month in production.
  const CLIENT = withoutComments(
    readFileSync(
      fileURLToPath(new URL('./PortfolioToolClient.tsx', import.meta.url)),
      'utf8',
    ),
  )
  const PAGE = withoutComments(
    readFileSync(
      fileURLToPath(new URL('../../app/gp-portfolio-tool/page.tsx', import.meta.url)),
      'utf8',
    ),
  )

  it('is not rendered by the page, above the tool and its fixed navbar', () => {
    expect(PAGE).not.toContain('<FreeStationsBanner')
  })

  it('renders below the navbar in both the signed-in and anonymous shells', () => {
    const mounts = [...CLIENT.matchAll(/<FreeStationsBanner \/>/g)].map((m) => m.index ?? -1)
    expect(mounts).toHaveLength(2)

    const appNavbar = CLIENT.indexOf('<AppNavbar />')
    const landingNavbar = CLIENT.indexOf('<LandingNavbar')
    expect(appNavbar).toBeGreaterThan(-1)
    expect(landingNavbar).toBeGreaterThan(appNavbar)

    expect(mounts[0]).toBeGreaterThan(appNavbar)
    expect(mounts[0]).toBeLessThan(landingNavbar)
    expect(mounts[1]).toBeGreaterThan(landingNavbar)
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

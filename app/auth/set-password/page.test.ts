import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * /auth/set-password must never spend the emailed link just by being opened.
 *
 * There is no DOM test runner in this project (vitest runs in `node`), so the
 * page cannot be rendered and clicked. What can be pinned is its wiring, with
 * the same readFileSync approach app/free/page.test.ts uses: the single-use
 * recovery token is verified from a button's click handler and from nowhere
 * else. The decision itself is tested in lib/auth/setPasswordArrival.test.ts.
 *
 * Why it matters: a mail scanner that renders links (Safe Links on nhs.net)
 * runs a mount effect exactly as a browser does, but it does not press
 * buttons. A verify on mount hands the scanner the buyer's only link.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments explain the rule; only the code is bound by it. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const PAGE = source('./page.tsx')
const CODE = withoutComments(PAGE)

describe('/auth/set-password never spends the link on arrival', () => {
  it('verifies the token in exactly one place', () => {
    expect(CODE.match(/verifyOtp\(/g)).toHaveLength(1)
  })

  it('keeps that one place out of the mount effect', () => {
    const effectStart = CODE.indexOf('useEffect(')
    const handlerStart = CODE.indexOf('const continueSetup = ')
    expect(effectStart).toBeGreaterThan(-1)
    expect(handlerStart).toBeGreaterThan(effectStart)
    expect(CODE.slice(effectStart, handlerStart)).not.toContain('verifyOtp')
  })

  it('lets the mount effect call nothing but the session check and the rule', () => {
    // The substring check above cannot see inside a helper: an effect that
    // called `autoVerify(supabase, tokenHash)` would pass it while doing exactly
    // what this page must never do. So the effect's calls are an allow-list,
    // and anything new in there has to be added here on purpose.
    const effectStart = CODE.indexOf('useEffect(')
    const effectClose = '}, [tokenHash]);'
    const effectEnd = CODE.indexOf(effectClose, effectStart)
    expect(effectEnd).toBeGreaterThan(effectStart)
    const effect = CODE.slice(effectStart, effectEnd + effectClose.length)

    const calls = [...effect.matchAll(/(\w+)\(/g)].map((match) => match[1])
    const allowed = new Set(['useEffect', 'arrive', 'getSession', 'Boolean', 'decideSetPasswordArrival', 'setState'])
    expect(calls.filter((call) => !allowed.has(call))).toEqual([])
    // And the session check is really in there, so an emptied effect fails too.
    expect(calls).toContain('getSession')
    expect(calls).toContain('decideSetPasswordArrival')
  })

  it('verifies from the continue handler, as a recovery token', () => {
    const handler = CODE.slice(CODE.indexOf('const continueSetup = '), CODE.indexOf('const resend = '))
    expect(handler).toContain("verifyOtp({ type: 'recovery', token_hash: tokenHash })")
  })

  it('puts that handler on a button a person has to press', () => {
    expect(CODE).toMatch(/<button[^>]*onClick=\{continueSetup\}/)
  })

  it('decides the arrival with the shared, tested rule', () => {
    expect(PAGE).toContain("from '@/lib/auth/setPasswordArrival'")
    expect(CODE).toContain('decideSetPasswordArrival(')
    expect(CODE).toContain('decideAfterVerify(')
  })
})

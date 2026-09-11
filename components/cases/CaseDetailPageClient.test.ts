import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { caseCtaFor } from '@/lib/trial/freeStationPicks'

/**
 * The button in the sidebar of a public case page.
 *
 * There are 200 of these pages and five of the cases are free, so the button
 * has two honest forms and picking the wrong one is the failure that matters:
 * "Practise this case free" on a case the guest door will NOT open sends
 * somebody to a consultation on a different case than the one they just spent
 * five minutes reading. The decision itself is a pure function
 * (`caseCtaFor`) and is pinned in lib/trial/freeStationPicks.test.ts; what is
 * checked here is that this page asks it rather than composing an href of its
 * own, and that it reaches the guest door without a prefetch.
 *
 * Source assertions, because vitest runs in `node` here and there is no DOM to
 * render a client component into — the same readFileSync approach
 * lib/commerce/pricingFeatures.test.ts uses for the pricing grid.
 */

const SOURCE = readFileSync(
  fileURLToPath(new URL('./CaseDetailPageClient.tsx', import.meta.url)),
  'utf8',
)

/** Comments explain the rules; only the code and the copy are bound by them. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const CODE = withoutComments(SOURCE)

describe('which door a case page offers', () => {
  it('asks the one function rather than composing an href', () => {
    expect(CODE).toContain("import { caseCtaFor } from '@/lib/trial/freeStationPicks'")
    expect(CODE).toContain('caseCtaFor({ id: caseData.id, isFree: isFreeCase })')
    expect(CODE).toContain('href={cta.href}')
    expect(CODE).toContain('{cta.label}')
  })

  it('reads the flag off the case itself, and treats a missing one as not free', () => {
    // `is_free_trial` is optional on PublicCase — the light list select does
    // not carry it. `=== true` so an absent flag never offers a free case.
    expect(CODE).toContain('const isFreeCase = caseData.is_free_trial === true')
  })

  it('never builds the retired account-form href', () => {
    expect(CODE).not.toContain('/free/start?station=')
  })

  it('reaches the guest door with a plain anchor, never a prefetching Link', () => {
    // /try/talk opens a consultation as a side effect of a GET.
    expect(CODE).toContain('<a href={cta.href}')
  })
})

describe('what the two buttons say', () => {
  it('offers this case when this case is one of the five', () => {
    expect(caseCtaFor({ id: 'abc', isFree: true }).label).toBe('Practise this case free')
    expect(SOURCE).toContain('You see your verdict before we ask for anything.')
  })

  it('offers the five when this case is not one of them', () => {
    expect(caseCtaFor({ id: 'abc', isFree: false })).toEqual({
      label: 'Try 5 free cases',
      href: '/free',
    })
    expect(SOURCE).toContain('Five cases are free')
  })

  it('says "no card" at most once on the page', () => {
    expect((CODE.toLowerCase().match(/no card/g) ?? []).length).toBeLessThanOrEqual(1)
  })
})

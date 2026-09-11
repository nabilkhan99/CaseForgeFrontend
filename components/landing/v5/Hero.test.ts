import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FREE_TIER } from '@/lib/commerce/plans'

/**
 * Where the landing page's calls to action point.
 *
 * The rule they all now obey (11 September 2026): the free offer is FIVE CASES
 * and the consultation comes first. Every free call to action on the landing
 * page therefore goes to /free, the picker, where Start opens a consultation
 * on that case; the account is made afterwards, while it is being marked. The
 * account-first form at /free/start still exists and is still deliberate — it
 * is the pricing table's free column, where somebody is comparing plans rather
 * than looking for a patient.
 *
 * The noun is "cases" on every one of these surfaces. "Station" is the word
 * the product uses inside itself (the brief, the report, the library, "200 AI
 * stations" on the receipt) and it stays there.
 *
 * Source assertions, because vitest runs in `node` here and there is no DOM to
 * render a client component into — the same readFileSync approach
 * lib/commerce/pricingFeatures.test.ts already uses for the pricing grid.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments explain the copy rules; only the copy itself is bound by them. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const HERO = source('./Hero.tsx')
const HERO_COPY = withoutComments(HERO)
const FINAL_CTA = source('./FinalCta.tsx')
const NAVBAR = source('../LandingNavbar.tsx')
const PRICING = source('./PricingTable.tsx')

describe('the hero’s call to action', () => {
  it('names the offer and opens the picker', () => {
    expect(HERO).toContain('href="/free"')
    expect(HERO_COPY).toContain('Try 5 free cases')
  })

  it('carries one button and no secondary link', () => {
    // Two doors into the same offer only made the reader choose between them.
    expect(HERO_COPY).not.toContain('See the five cases')
    expect(HERO).not.toContain('href="/free/start"')
  })

  it('says what the free offer is, underneath', () => {
    expect(HERO_COPY).toContain('Live consultations with an AI patient · marked · no card')
  })

  it('never counts stations at somebody who has not sat one', () => {
    expect(HERO_COPY).not.toContain('Five stations')
  })

  it('names outcomes, never mechanisms', () => {
    const copy = HERO_COPY.toLowerCase()
    expect(copy).not.toMatch(/sign[ -]up/)
    expect(copy).not.toContain('6-digit')
    // "no card" is allowed once per page and this is the hero's one use of it.
    expect(copy.match(/no card/g) ?? []).toHaveLength(1)
  })
})

describe('the receipt block is untouched', () => {
  it('still itemises the course against the study budget', () => {
    expect(HERO).toContain("{ label: '200 AI stations, unlimited', amount: '£299' }")
    expect(HERO).toContain("{ label: '8 hours of lectures', amount: '£599' }")
    expect(HERO).toContain("{ label: '8-hour live coaching day', amount: '£599' }")
    expect(HERO).toContain('£1,497')
    expect(HERO).toContain('Study budget (GP0001)')
  })

  it('still leads with the £599 → £0 headline and the £500 stamp', () => {
    expect(HERO).toContain('£599')
    expect(HERO).toContain('£500')
  })
})

describe('the other doors into the offer', () => {
  it('keeps the navbar CTA on the picker, in the same noun', () => {
    expect(NAVBAR).toContain("label: '5 free cases'")
    expect(NAVBAR).toContain("href: '/free'")
  })

  it('sends the pricing table’s free column to the account form', () => {
    // The free column is the DELIBERATE door: a reader comparing plans is not
    // looking for a patient. Its destination and its label both live on
    // FREE_TIER and PricingTable reads them from there, so there is one source
    // of truth and no local override.
    expect(FREE_TIER.ctaHref).toBe('/free/start')
    expect(FREE_TIER.ctaLabel).toBe('Create free account')
    expect(PRICING).toContain('href={FREE_TIER.ctaHref}')
    expect(PRICING).toContain('{FREE_TIER.ctaLabel}')
  })

  it('sends the closing banner to the picker, and off mechanism words', () => {
    expect(FINAL_CTA).toContain('href="/free"')
    expect(FINAL_CTA).toContain('Try 5 free cases')
    expect(withoutComments(FINAL_CTA).toLowerCase()).not.toMatch(/sign[ -]up|6-digit/)
  })
})

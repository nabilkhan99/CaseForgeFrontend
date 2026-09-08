import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FREE_TIER } from '@/lib/commerce/plans'

/**
 * Where the landing page's calls to action point.
 *
 * The rule they all now obey (7 September 2026): the free trial is an ACCOUNT,
 * made in one go at /free/start, and every free call to action goes there. The
 * guest lane behind /try/talk is retired — a button still pointing at it would
 * take somebody through a redirect they did not need, and would keep a dead
 * door alive in every cached copy of this page.
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
  it('makes the free account', () => {
    expect(HERO).toContain('href="/free/start"')
    expect(HERO).toContain('Start free')
  })

  it('no longer points at the retired guest door', () => {
    expect(HERO).not.toContain('/try/talk')
  })

  it('offers the picker underneath, as a text link', () => {
    expect(HERO).toContain('href="/free"')
    expect(HERO).toContain('See the five cases')
  })

  it('says what the free account is worth', () => {
    expect(HERO_COPY).toContain('Five stations · unlimited attempts · five days · no card')
  })

  it('drops the promise the guest lane used to make', () => {
    expect(HERO_COPY).not.toContain('before we ask for')
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
  it('keeps the navbar CTA on the picker — it is a browse link, not a start', () => {
    expect(NAVBAR).toContain("label: '5 free stations'")
    expect(NAVBAR).toContain("href: '/free'")
  })

  it('sends the pricing table’s free column to the account form', () => {
    // The free column's destination lives on FREE_TIER in the plan catalogue
    // and PricingTable reads it from there, so there is one source of truth.
    expect(FREE_TIER.ctaHref).toBe('/free/start')
    expect(PRICING).toContain('href={FREE_TIER.ctaHref}')
    expect(FREE_TIER.ctaLabel).toBe('Start free')
  })

  it('sends the closing banner to the account form, and off mechanism words', () => {
    expect(FINAL_CTA).toContain('href="/free/start"')
    expect(FINAL_CTA).toContain('Start free')
    expect(withoutComments(FINAL_CTA).toLowerCase()).not.toMatch(/sign[ -]up|6-digit/)
  })
})

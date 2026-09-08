import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FREE_TIER } from '@/lib/commerce/plans'

/**
 * Where the landing page's calls to action point.
 *
 * The rule they all now obey: the consultation is the call to action, and
 * identity is asked for at the reveal after the first station rather than in
 * front of it. So the hero's primary button opens a patient, and every route
 * that used to promise a form promises an outcome instead.
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

describe('the hero’s call to action', () => {
  it('opens a consultation rather than a form', () => {
    expect(HERO).toContain('href="/try/talk"')
    expect(HERO).toContain('Start your first station')
  })

  it('offers the picker underneath, as a text link', () => {
    expect(HERO).toContain('href="/free"')
    expect(HERO).toContain('See the five cases')
  })

  it('says what is free and when the asking happens', () => {
    expect(HERO_COPY).toContain('Five free stations · every one marked')
    expect(HERO_COPY).toContain('your first verdict before we ask for')
  })

  it('no longer sends people to a form to start', () => {
    expect(HERO_COPY).not.toContain('Start 5 free stations')
  })

  it('names outcomes, never mechanisms', () => {
    const copy = HERO_COPY.toLowerCase()
    expect(copy).not.toMatch(/sign[ -]up/)
    expect(copy).not.toContain('6-digit')
    expect(copy).not.toContain('no card')
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
  it('keeps the navbar CTA on the picker', () => {
    expect(NAVBAR).toContain("label: '5 free stations'")
    expect(NAVBAR).toContain("href: '/free'")
  })

  it('keeps the pricing table’s free column on the picker', () => {
    expect(FREE_TIER.ctaHref).toBe('/free')
    expect(FREE_TIER.ctaLabel).toBe('Start free')
  })

  it('keeps the closing banner on the picker, and off mechanism words', () => {
    expect(FINAL_CTA).toContain('href="/free"')
    expect(withoutComments(FINAL_CTA).toLowerCase()).not.toMatch(/sign[ -]up|6-digit/)
  })
})

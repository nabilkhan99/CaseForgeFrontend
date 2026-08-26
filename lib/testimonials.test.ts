import { describe, expect, it } from 'vitest'
import { TESTIMONIALS } from './testimonials'

/**
 * These guard a promise rather than a behaviour: every quote the product shows
 * is something a named person actually said, and the trimmed version is a cut
 * of it rather than a rewrite. A paraphrase that reads better is still a
 * paraphrase, and the shortest path to inventing a testimonial is editing one.
 */
describe('testimonials', () => {
  it('has three, each attributed to a named person', () => {
    expect(TESTIMONIALS).toHaveLength(3)
    for (const t of TESTIMONIALS) {
      expect(t.name.trim()).not.toBe('')
      expect(t.meta.trim()).not.toBe('')
    }
  })

  it('every short form is a verbatim substring of the full quote', () => {
    for (const t of TESTIMONIALS) {
      expect(t.quote, `"${t.short}" is not a verbatim cut of ${t.name}'s quote`).toContain(t.short)
    }
  })

  it('claims no exam result, because none of them told us one', () => {
    // "pass"/"fail" appear inside Zain's quote as exam vocabulary, which is his
    // words about the lectures — the attribution line is what must stay clean.
    for (const t of TESTIMONIALS) {
      expect(t.meta.toLowerCase()).not.toMatch(/pass|fail|resit|attempt/)
    }
  })
})

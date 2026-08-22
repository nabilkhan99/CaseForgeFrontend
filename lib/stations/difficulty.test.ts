import { describe, expect, it } from 'vitest'
import {
    difficultyLabel,
    difficultyStyle,
    difficultyTier,
    shouldShowDifficulty,
} from './difficulty'

describe('difficultyTier', () => {
    it('maps the two values the bank actually holds', () => {
        // 185 intermediate + 15 advanced in production; the old colour switch
        // knew neither, so all 200 pills rendered as "easy" green.
        expect(difficultyTier('intermediate')).toBe('intermediate')
        expect(difficultyTier('advanced')).toBe('advanced')
    })

    it('still maps the easy/medium/hard vocabulary the UI was written for', () => {
        expect(difficultyTier('easy')).toBe('foundation')
        expect(difficultyTier('medium')).toBe('intermediate')
        expect(difficultyTier('hard')).toBe('advanced')
    })

    it('is case- and whitespace-insensitive', () => {
        expect(difficultyTier('  Advanced ')).toBe('advanced')
    })

    it('returns null for anything it does not recognise, rather than guessing', () => {
        expect(difficultyTier('spicy')).toBeNull()
        expect(difficultyTier('')).toBeNull()
        expect(difficultyTier(null)).toBeNull()
        expect(difficultyTier(undefined)).toBeNull()
    })
})

describe('difficultyLabel and difficultyStyle', () => {
    it('labels by tier so two spellings of one tier read identically', () => {
        expect(difficultyLabel('hard')).toBe('Advanced')
        expect(difficultyLabel('advanced')).toBe('Advanced')
        expect(difficultyLabel('spicy')).toBeNull()
    })

    it('gives each tier a distinct style and none to unknown values', () => {
        const tiers = ['easy', 'intermediate', 'advanced'].map(v => difficultyStyle(v)?.color)
        expect(new Set(tiers).size).toBe(3)
        expect(difficultyStyle('spicy')).toBeNull()
    })

    it('stays inside the amber/stone palette — no greens or blues', () => {
        for (const value of ['easy', 'intermediate', 'advanced']) {
            const style = difficultyStyle(value)!
            // Warm hues only: the red channel leads in every token.
            const [, r, g, b] = /#(..)(..)(..)/.exec(style.color)!
            expect(parseInt(r, 16)).toBeGreaterThanOrEqual(parseInt(g, 16))
            expect(parseInt(g, 16)).toBeGreaterThanOrEqual(parseInt(b, 16))
        }
    })
})

describe('shouldShowDifficulty', () => {
    it('hides the pill when a list is all one tier — the usual case', () => {
        // A typical domain page: ten intermediate stations. "INTERMEDIATE"
        // stamped on all ten says nothing and costs a line of phone width.
        expect(shouldShowDifficulty(Array(10).fill('intermediate'))).toBe(false)
    })

    it('shows the pill as soon as a list mixes tiers', () => {
        expect(shouldShowDifficulty(['intermediate', 'intermediate', 'advanced'])).toBe(true)
    })

    it('ignores unknown and missing values when judging variety', () => {
        expect(shouldShowDifficulty(['intermediate', null, undefined, 'spicy'])).toBe(false)
        expect(shouldShowDifficulty([])).toBe(false)
    })

    it('treats synonyms as the same tier', () => {
        expect(shouldShowDifficulty(['hard', 'advanced'])).toBe(false)
    })
})

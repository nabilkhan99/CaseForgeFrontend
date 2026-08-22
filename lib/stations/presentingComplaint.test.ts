import { describe, expect, it } from 'vitest'
import { extractPresentingComplaint } from './presentingComplaint'

/**
 * Both fixtures below are the real shapes in production — the escaped-quote
 * block form (169 briefs) and the inline bullet form. 199 of the 200 stations
 * parse; the one that doesn't is a staged station with a free-text brief.
 */
describe('extractPresentingComplaint', () => {
    it('reads the block form and unescapes JSON-mangled quotes', () => {
        const brief = [
            '**Patient Name:** Simon Fletcher',
            '**Age:** 45',
            '**Situation:** Telephone Consultation.',
            '**Reason for Encounter:**',
            '\\"Patient complaining of daily headaches that have been worsening.\\"',
            '**Medical Records:**',
            '- **PMH:** Mild Hypertension.',
        ].join('\n')

        expect(extractPresentingComplaint(brief)).toBe(
            'Patient complaining of daily headaches that have been worsening.',
        )
    })

    it('reads the inline bullet form and stops at the next heading', () => {
        const brief = [
            '**Recent Medical Notes:**',
            '- **Current Situation:** Self-booked via app.',
            '- **Reason for Encounter:** "Requests HIV testing after a recent incident."',
            '- **Last BP/BMI:** Not recorded in last 3 years.',
        ].join('\n')

        expect(extractPresentingComplaint(brief)).toBe(
            'Requests HIV testing after a recent incident.',
        )
    })

    it('strips emphasis markers around a quoted triage note', () => {
        const brief = "**Reason for Encounter:**\n*'Chest still tight, inhaler isn't working.'*\n**PMH:** Asthma."
        expect(extractPresentingComplaint(brief)).toBe("Chest still tight, inhaler isn't working.")
    })

    it('collapses the multi-line block form onto one line', () => {
        const brief = '**Reason for Encounter:**\n\n"My skin is driving me mad.\n\nIt is so itchy."\n\n**Medical Records:**\n- PMH'
        expect(extractPresentingComplaint(brief)).toBe('My skin is driving me mad. It is so itchy.')
    })

    it('truncates on a word boundary rather than mid-word', () => {
        const long = `**Reason for Encounter:** ${'symptom '.repeat(60)}end`
        const result = extractPresentingComplaint(long)
        expect(result.length).toBeLessThanOrEqual(241)
        expect(result.endsWith('…')).toBe(true)
        expect(result).not.toMatch(/sym…$/)
    })

    it('returns empty rather than a guess when the brief has no such heading', () => {
        // A real staged station: free prose, no headings at all.
        expect(extractPresentingComplaint('Personal details: Patient name: Brian Thompson')).toBe('')
        expect(extractPresentingComplaint(null)).toBe('')
        expect(extractPresentingComplaint(undefined)).toBe('')
    })
})

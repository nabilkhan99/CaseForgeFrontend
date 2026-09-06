import { describe, expect, it } from 'vitest'
import { toVerdictSummary } from './verdictSummary'

/**
 * The gate, expressed as a function.
 *
 * The report is what the email is being asked for, so the test that matters
 * here is not "does the verdict come through" but "does anything else". It is
 * written as an allowlist for that reason: a session_results row grows columns
 * over time, and a blocklist would leak each new one on the day it was added.
 */

/** A full row, with every field the report renders. */
const FULL_ROW = {
  verdict: 'Bare Fail',
  weighted_score: 5.5,
  max_score: 10.5,
  one_line_summary: 'A solid history, but the management plan missed the withdrawal.',
  domains: [
    { domain: 'data_gathering', grade: 'P', what_you_missed: [{ point: 'No ICE' }] },
    { domain: 'clinical_management', grade: 'F', evidence: [{ quote: 'Take paracetamol' }] },
  ],
  focus_areas: [{ priority: 1, label: 'Medication overuse', narrative: 'Explain withdrawal.' }],
  capability_links: ['Clinical management'],
  timing: { total_duration_ms: 720_000 },
  confidence: { transcript_quality: 'high', notes: '' },
  tier3_override_applied: false,
  session_id: 'session-1',
}

describe('toVerdictSummary', () => {
  it('passes exactly four fields and nothing else', () => {
    const summary = toVerdictSummary(FULL_ROW)

    expect(summary).toEqual({
      verdict: 'Bare Fail',
      weightedScore: 5.5,
      maxScore: 10.5,
      oneLineSummary: 'A solid history, but the management plan missed the withdrawal.',
    })
    // Named explicitly as well as by the equality above: this is the assertion
    // that fails if someone widens the allowlist without meaning to.
    expect(Object.keys(summary!).sort()).toEqual([
      'maxScore',
      'oneLineSummary',
      'verdict',
      'weightedScore',
    ])
  })

  it('leaks no part of the report', () => {
    const serialised = JSON.stringify(toVerdictSummary(FULL_ROW))

    // The paid half of the product, checked by its actual content rather than
    // by key name — a nested quote would survive a key-only check.
    expect(serialised).not.toContain('data_gathering')
    expect(serialised).not.toContain('what_you_missed')
    expect(serialised).not.toContain('No ICE')
    expect(serialised).not.toContain('Take paracetamol')
    expect(serialised).not.toContain('Medication overuse')
    expect(serialised).not.toContain('capability_links')
    expect(serialised).not.toContain('total_duration_ms')
  })

  it('shows nothing for a row with no verdict', () => {
    expect(toVerdictSummary({ ...FULL_ROW, verdict: '' })).toBeNull()
    expect(toVerdictSummary({ ...FULL_ROW, verdict: null })).toBeNull()
    expect(toVerdictSummary({ weighted_score: 5.5 })).toBeNull()
  })

  it('refuses an empty-transcript artefact', () => {
    // A real row from production: marking ran without a transcript guard and
    // graded one or two turns. Presenting that above the gate as somebody's
    // result — to the person deciding whether the marking is worth an email
    // address — is the worst possible place for a fabricated mark.
    expect(
      toVerdictSummary({
        verdict: 'Fail',
        weighted_score: 0,
        max_score: 10.5,
        one_line_summary:
          'The consultation did not progress beyond a brief opening, so there was no meaningful history.',
      }),
    ).toBeNull()

    // The fallback path lands on 0 too, and must not slip through it.
    expect(toVerdictSummary({ verdict: 'Fail', weighted_score: null })).toBeNull()
    // A genuine mark of any size still shows.
    expect(toVerdictSummary({ ...FULL_ROW, weighted_score: 0.5 })).toMatchObject({
      weightedScore: 0.5,
    })
  })

  it('shows nothing when the mark has not landed', () => {
    expect(toVerdictSummary(null)).toBeNull()
    expect(toVerdictSummary(undefined)).toBeNull()
    expect(toVerdictSummary('a string')).toBeNull()
  })

  it('reads numerics that arrive as strings', () => {
    // Postgres numeric columns come back as strings through PostgREST.
    expect(toVerdictSummary({ ...FULL_ROW, weighted_score: '7.0', max_score: '10.5' })).toMatchObject(
      { weightedScore: 7, maxScore: 10.5 },
    )
  })

  it('falls back rather than rendering NaN', () => {
    expect(
      toVerdictSummary({ verdict: 'Pass', weighted_score: 7, max_score: undefined }),
    ).toEqual({ verdict: 'Pass', weightedScore: 7, maxScore: 10.5, oneLineSummary: '' })
  })
})

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The report's "too short to mark" screen, pinned against source.
 *
 * Main carries a component-level version of this test for its own report;
 * develop's report handles the same Azure 'unmarkable' verdict inside the
 * main component, so the checks here are on what a reader can see: the poll
 * stops on the status, the wording is neutral for paying users, and no dash
 * made it into the copy.
 */

const REPORT = readFileSync(
  fileURLToPath(new URL('./FeedbackReport.tsx', import.meta.url)),
  'utf8',
)

function unmarkableBlock(): string {
  const start = REPORT.indexOf("if (problem === 'unmarkable')")
  expect(start, 'unmarkable branch').toBeGreaterThan(-1)
  return REPORT.slice(start, REPORT.indexOf('</ProblemScreen>', start))
}

describe('a consultation too short to mark', () => {
  it('stops polling on the status rather than timing out', () => {
    const handled = REPORT.indexOf("data.status === 'unmarkable'")
    expect(handled).toBeGreaterThan(-1)
    expect(REPORT.slice(handled, handled + 400)).toContain("setProblem('unmarkable')")
  })

  it('says how short it was, and offers a proper run', () => {
    const block = unmarkableBlock()
    expect(block).toContain('not enough to mark fairly.')
    expect(block).toContain('Run it properly')
  })

  it('is neutral for paying users', () => {
    const block = unmarkableBlock()
    expect(block).not.toContain('used one of your stations')
    expect(block).not.toMatch(/[–—]/)
  })
})

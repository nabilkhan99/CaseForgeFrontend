import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The "Further reading" block, checked against source.
 *
 * There is no DOM test runner in this project (vitest runs in `node`), so the
 * block cannot be rendered. What can be pinned, the way app/free/page.test.ts
 * does it, is the wiring that would otherwise fail silently: that both surfaces
 * which show a case's learning points also show its further reading, that the
 * links leave the referrer intact so PCCS can see where its visitors came from,
 * and that the copy is honest about the member login the modules sit behind.
 * Which case gets which module is tested in lib/partners/pccsAcademy.test.ts.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments discuss the rules; only the code and copy are bound by them. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const BLOCK = withoutComments(source('./PccsFurtherReading.tsx'))
const CASE_PAGE = withoutComments(source('./CaseDetailPageClient.tsx'))
const REPORT = withoutComments(source('../clinical-master/FeedbackReport.tsx'))

describe('where the further reading shows', () => {
  it('sits under the learning points on the public case page', () => {
    expect(CASE_PAGE).toMatch(
      /<LearningPointsDisplay content=\{caseData\.clinical_learning_points \?\? null\} \/>\s*<PccsFurtherReading stationId=\{caseData\.id\} surface="case_page" \/>/,
    )
  })

  it('sits under the learning points in the feedback report', () => {
    expect(REPORT).toMatch(
      /<LearningPointsDisplay content=\{learning\} \/>\s*<PccsFurtherReading stationId=\{feedback\.station_id\} surface="feedback_report" \/>/,
    )
  })
})

describe('the block itself', () => {
  it('asks the shared pairing which modules to show, and shows nothing when there are none', () => {
    expect(BLOCK).toContain("from '@/lib/partners/pccsAcademy'")
    expect(BLOCK).toContain('pccsFurtherReadingFor(stationId)')
    expect(BLOCK).toMatch(/if \(modules\.length === 0\) return null/)
  })

  it('opens PCCS in a new tab and lets the referrer through', () => {
    // `noreferrer` would hide fourteenfisherman.com from PCCS's analytics, and
    // being able to see the visitors we send is half the point for them.
    expect(BLOCK).toContain('target="_blank"')
    expect(BLOCK).toContain('rel="noopener"')
    expect(BLOCK).not.toContain('noreferrer')
  })

  it('says plainly that the modules need a free PCCS account', () => {
    expect(BLOCK).toContain('Free for practising healthcare professionals')
    expect(BLOCK).toContain('PCCS account')
    expect(BLOCK).toContain('PCCS_JOIN_URL')
  })

  it('counts the clicks, by module and by surface', () => {
    expect(BLOCK).toContain("trackEvent('pccs_module_clicked'")
    expect(BLOCK).toMatch(/module: module\.key/)
    expect(BLOCK).toMatch(/surface/)
  })

  it('keeps em dashes out of the copy', () => {
    expect(BLOCK).not.toContain('—')
  })
})

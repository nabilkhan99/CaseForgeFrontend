import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The "Further reading" section and its MediConf group, checked against source.
 *
 * One section holds every partner's links under a single heading, because a
 * case can carry more than one: the pre-diabetes risk case points at a PCCS
 * module and at a MediConf webinar, and two "Further reading" headings stacked
 * on one page would read as a bug. As with the rest of this folder, there is no
 * DOM runner, so the wiring is pinned against the source.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const SECTION = withoutComments(source('./FurtherReading.tsx'))
const MEDICONF = withoutComments(source('./MediconfReadingGroup.tsx'))
const CASE_PAGE = withoutComments(source('./CaseDetailPageClient.tsx'))
const REPORT = withoutComments(source('../clinical-master/FeedbackReport.tsx'))

describe('where the further reading shows', () => {
  it('sits under the learning points on the public case page', () => {
    expect(CASE_PAGE).toMatch(
      /<LearningPointsDisplay content=\{caseData\.clinical_learning_points \?\? null\} \/>\s*<FurtherReading stationId=\{caseData\.id\} surface="case_page" \/>/,
    )
  })

  it('sits under the learning points in the feedback report', () => {
    expect(REPORT).toMatch(
      /<LearningPointsDisplay content=\{learning\} \/>\s*<FurtherReading stationId=\{feedback\.station_id\} surface="feedback_report" \/>/,
    )
  })

  it('has replaced the PCCS-only block at both call sites', () => {
    expect(CASE_PAGE).not.toContain('PccsFurtherReading')
    expect(REPORT).not.toContain('PccsFurtherReading')
  })
})

describe('the section', () => {
  it('asks both partners what this case links to', () => {
    expect(SECTION).toContain('pccsFurtherReadingFor(stationId)')
    expect(SECTION).toContain('mediconfWebinarFor(stationId)')
  })

  it('renders nothing for a case no partner links', () => {
    expect(SECTION).toMatch(/if \(modules\.length === 0 && !webinar\) return null/)
  })

  it('has one heading, whoever is linked', () => {
    expect(SECTION.match(/Further reading/g)).toHaveLength(1)
    expect(SECTION).toContain('<MediconfReadingGroup')
    expect(SECTION).toContain('<PccsReadingGroup')
  })
})

describe('the MediConf group', () => {
  it('opens MediConf in a new tab and lets the referrer through', () => {
    expect(MEDICONF).toContain('target="_blank"')
    expect(MEDICONF).toContain('rel="noopener"')
    expect(MEDICONF).not.toContain('noreferrer')
  })

  it('shows the strapline MediConf supplied and says when the webinar is', () => {
    expect(MEDICONF).toContain('MEDICONF_STRAPLINE')
    expect(MEDICONF).toContain('webinarWhen(webinar)')
  })

  it('shows the logo only once there is one, and the name until then', () => {
    expect(MEDICONF).toMatch(/MEDICONF_LOGO\s*\?/)
    expect(MEDICONF).toContain('MediConf')
  })

  it('counts the clicks, by webinar and by surface', () => {
    expect(MEDICONF).toContain("trackEvent('mediconf_webinar_clicked'")
    expect(MEDICONF).toMatch(/webinar: webinar\.key/)
    expect(MEDICONF).toMatch(/surface/)
  })

  it('keeps em dashes out of the copy', () => {
    expect(MEDICONF).not.toContain('—')
    expect(SECTION).not.toContain('—')
  })
})

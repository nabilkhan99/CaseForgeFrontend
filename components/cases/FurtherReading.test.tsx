import React, { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import FurtherReading from './FurtherReading'
import { MEDICONF_INTRO } from '@/lib/partners/mediconf'

// Vitest compiles JSX with the classic runtime (Next uses the automatic one),
// so the component's JSX needs React in scope when it renders.
;(globalThis as { React?: typeof React }).React = React

/**
 * The "Further reading" section: every partner's links for a case, under one
 * heading.
 *
 * A case can carry both partners (the pre-diabetes risk case is on PCCS's list
 * and on MediConf's webinar topics), and two "Further reading" headings stacked
 * on one page would read as a bug. The shipped MediConf map is empty until
 * MediConf send their list, so the section is rendered against a fixture
 * standing in for it; PCCS is the real map.
 */

const CASE = {
  // PCCS 'risk' only in the shipped maps.
  preDiabetesRisk: '16c48616-d334-4d20-8af1-f17388f702b8',
  // No PCCS module.
  teenHeadache: 'c72e0e6f-526c-4812-9515-85d4c9fbad59',
  // PCCS 'sport' only.
  sportScreening: '14d22868-ae06-4d75-a8b7-bbd432bd5f8d',
  // Neither partner.
  dryCoughAfterMi: 'c64a5ae8-0000-0000-0000-000000000000',
} as const

const { FIXTURE } = vi.hoisted(() => ({
  FIXTURE: {
    '16c48616-d334-4d20-8af1-f17388f702b8': [
      {
        key: 'communicating-diabetes-risk',
        title: 'Communicating diabetes risk',
        url: 'https://www.mediconf.co.uk/resources/communicating-diabetes-risk',
      },
    ],
    'c72e0e6f-526c-4812-9515-85d4c9fbad59': [
      {
        key: 'headache-migraine-primary-care',
        title: 'Headache and migraine in primary care',
        url: 'https://www.mediconf.co.uk/resources/headache-and-migraine',
      },
    ],
  },
}))

vi.mock('@/lib/partners/mediconf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/partners/mediconf')>()
  return {
    ...actual,
    mediconfResourcesFor: (stationId: string | null | undefined) => actual.mediconfResourcesFor(stationId, FIXTURE),
  }
})
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

const PCCS_INTRO = 'From the PCCS Academy'

function render(stationId: string | null | undefined): string {
  return renderToStaticMarkup(createElement(FurtherReading, { stationId, surface: 'case_page' }))
}

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const SECTION = withoutComments(source('./FurtherReading.tsx'))
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
  it('shows both partners under one heading, MediConf first', () => {
    const html = render(CASE.preDiabetesRisk)
    expect(html.match(/Further reading/g)).toHaveLength(1)
    expect(html).toContain(MEDICONF_INTRO)
    expect(html).toContain(PCCS_INTRO)
    expect(html.indexOf(MEDICONF_INTRO)).toBeLessThan(html.indexOf(PCCS_INTRO))
  })

  it('shows MediConf alone when PCCS has nothing for the case', () => {
    const html = render(CASE.teenHeadache)
    expect(html).toContain('Further reading')
    expect(html).toContain('Headache and migraine in primary care')
    expect(html).not.toContain(PCCS_INTRO)
  })

  it('shows PCCS alone when MediConf has nothing for the case', () => {
    const html = render(CASE.sportScreening)
    expect(html).toContain('Further reading')
    expect(html).toContain('Cardiology in sport')
    expect(html).not.toContain(MEDICONF_INTRO)
    expect(html).not.toContain('mediconf-logo')
  })

  it('renders nothing for a case no partner links, or no case at all', () => {
    expect(render(CASE.dryCoughAfterMi)).toBe('')
    expect(render(null)).toBe('')
    expect(render(undefined)).toBe('')
  })

  it('keeps em dashes out of the copy', () => {
    expect(SECTION).not.toContain('—')
  })
})

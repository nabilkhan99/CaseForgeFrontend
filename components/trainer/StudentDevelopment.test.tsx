import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import StudentDevelopment, { type StudentDevelopmentState } from './StudentDevelopment'
import type { TrainerStudentDevelopmentResponse } from '@/app/api/trainer/students/[userId]/development/route'
import type { TrendReportV2 } from '@/lib/clinical-master/trendTypes'

// Vitest compiles JSX with the classic runtime (Next uses the automatic one),
// so the component's JSX needs React in scope when it renders.
;(globalThis as { React?: typeof React }).React = React

/** Visible text: React's text-node separators removed, tags flattened to spaces. */
function text(html: string): string {
  return html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const render = (state: StudentDevelopmentState, name = 'Priya') =>
  renderToStaticMarkup(createElement(StudentDevelopment, { userId: 'student-1', name, state }))

const REPORT: TrendReportV2 = {
  version: 2,
  candidate_id: 'student-1',
  window: { cases_included: 6, from: '2026-09-01', to: '2026-09-20' },
  overall_trajectory: 'improving',
  overall_narrative: 'Steadier structure across the last six cases.',
  patterns: [
    {
      headline: 'Safety-net with specifics',
      domain: 'clinical_management',
      frequency: 4,
      your_quote: 'Come back if it gets worse',
      quote_gloss: '',
      model_line: 'If the pain spreads to the arm, call 999.',
      model_gloss: '',
      the_change: 'Name the red flag.',
      evidence: [{ case_id: 'station-a', quote: 'Come back if it gets worse' }],
    },
  ],
}

function ready(overrides: Partial<TrainerStudentDevelopmentResponse> = {}): StudentDevelopmentState {
  return {
    kind: 'ready',
    development: {
      report: null,
      domainCases: [],
      caseTitles: {},
      markedCount: 0,
      ...overrides,
    },
  }
}

describe('StudentDevelopment', () => {
  it('heads the section with the student\'s name and says what it is', () => {
    const rendered = text(render({ kind: 'loading' }))
    expect(rendered).toContain('Priya’s development')
    expect(rendered).toContain(
      'What Priya sees on their Development page, updated after every marked case.',
    )
  })

  it('shows a quiet line while loading', () => {
    expect(text(render({ kind: 'loading' }))).toContain('Loading Priya’s development')
  })

  it('shows a muted line on error', () => {
    expect(text(render({ kind: 'error' }))).toContain(
      'Couldn’t load Priya’s development just now.',
    )
  })

  it('counts down to the three-case minimum when there is no report', () => {
    expect(text(render(ready({ markedCount: 2 })))).toContain(
      '2 of 3 marked cases until Priya’s development picture appears',
    )
  })

  it('says the picture is not built yet once there are enough cases', () => {
    const rendered = text(render(ready({ markedCount: 5 })))
    expect(rendered).toContain('Priya’s development picture hasn’t been built yet.')
    expect(rendered).toContain('It builds when they next open their Development page.')
  })

  it('renders the report in the student\'s name, with evidence cases named', () => {
    const html = render(
      ready({
        report: REPORT,
        markedCount: 6,
        caseTitles: { 'station-a': 'Chest pain in a lorry driver' },
        domainCases: [
          { sessionId: 'a', points: { data_gathering: 2, clinical_management: 3, relating_to_others: 2 } },
        ],
      }),
    )
    const rendered = text(html)

    expect(html).toContain('aria-label="Priya’s average grade in each domain"')
    expect(rendered).toContain('Improving')
    expect(rendered).toContain('What’s costing Priya marks')
    // casesIncluded comes from the report window, not the series length.
    expect(rendered).toContain('in 4 of Priya’s last 6 cases')
    expect(rendered).toContain('Where it happened')
    expect(rendered).not.toContain('marked cases until')
  })

  it('draws the domain averages even before there is a report', () => {
    const html = render(
      ready({
        markedCount: 1,
        domainCases: [
          { sessionId: 'a', points: { data_gathering: 2, clinical_management: 3, relating_to_others: 2 } },
        ],
      }),
    )
    expect(html).toContain('aria-label="Priya’s average grade in each domain"')
  })

  it('writes no dashes and no gendered pronouns in any state', () => {
    const states: StudentDevelopmentState[] = [
      { kind: 'loading' },
      { kind: 'error' },
      ready({ markedCount: 1 }),
      ready({ markedCount: 4 }),
    ]
    for (const state of states) {
      const rendered = text(render(state))
      expect(rendered).not.toMatch(/[–—]/)
      expect(rendered).not.toMatch(/\b(he|she|his|her|him|hers)\b/i)
    }
  })
})

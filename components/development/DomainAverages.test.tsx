import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DomainAverages from './DomainAverages'
import type { DomainCasePoints } from '@/lib/development/domainAverages'

// Vitest compiles JSX with the classic runtime (Next uses the automatic one),
// so the component's JSX needs React in scope when it renders.
;(globalThis as { React?: typeof React }).React = React

const CASES: DomainCasePoints[] = [
  { sessionId: 'a', points: { data_gathering: 2, clinical_management: 3, relating_to_others: 2 } },
  { sessionId: 'b', points: { data_gathering: 3, clinical_management: 4.5, relating_to_others: 3 } },
]

const render = (studentName?: string) =>
  renderToStaticMarkup(createElement(DomainAverages, { cases: CASES, studentName }))

describe('DomainAverages label', () => {
  it('addresses the trainee by default', () => {
    expect(render()).toContain('aria-label="Your average grade in each domain"')
  })

  it("names the student when a trainer is reading", () => {
    const html = render('Priya')
    expect(html).toContain('aria-label="Priya’s average grade in each domain"')
    expect(html).not.toContain('Your average')
  })

  it('still renders nothing when no case carries a grade', () => {
    expect(
      renderToStaticMarkup(createElement(DomainAverages, { cases: [], studentName: 'Priya' })),
    ).toBe('')
  })
})

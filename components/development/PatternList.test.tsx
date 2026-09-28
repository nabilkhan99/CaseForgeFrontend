import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PatternList from './PatternList'
import PatternBlock from './PatternBlock'
import type { TrendPattern } from '@/lib/clinical-master/trendTypes'

// Vitest compiles JSX with the classic runtime (Next uses the automatic one),
// so the component's JSX needs React in scope when it renders.
;(globalThis as { React?: typeof React }).React = React

/**
 * The patterns are written for the trainee ("costing you marks"). A trainer
 * reading the same list on the Students tab needs the student's name in those
 * places instead, and the trainee's own page must not change by a character.
 */

const PATTERN: TrendPattern = {
  headline: 'Check ideas before explaining',
  domain: 'relating_to_others',
  frequency: 3,
  your_quote: 'So what we will do today is',
  quote_gloss: 'Straight into the plan.',
  model_line: 'What were you thinking it might be?',
  model_gloss: 'Asks first.',
  the_change: 'Ask about ideas first.',
  evidence: [],
}

/** Visible text: React's text-node separators removed, tags flattened to spaces. */
function text(html: string): string {
  return html
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const list = (studentName?: string) =>
  renderToStaticMarkup(
    createElement(PatternList, {
      patterns: [PATTERN],
      casesIncluded: 4,
      titles: new Map(),
      studentName,
    }),
  )

const block = (studentName?: string) =>
  renderToStaticMarkup(
    createElement(PatternBlock, {
      pattern: PATTERN,
      position: 1,
      casesIncluded: 4,
      titles: new Map(),
      studentName,
    }),
  )

describe('PatternList copy', () => {
  it("reads as today's second person when no name is given", () => {
    const rendered = text(list())
    expect(rendered).toContain('What’s costing you marks')
    expect(rendered).toContain('from your own consultations')
    expect(rendered).toContain('in 3 of your last 4 cases')
    expect(rendered).toContain('In your consultation')
  })

  it("uses the student's name throughout when one is given", () => {
    const rendered = text(list('Priya'))
    expect(rendered).toContain('What’s costing Priya marks')
    expect(rendered).toContain('from Priya’s own consultations')
    // Threaded down into each block, not just the heading.
    expect(rendered).toContain('in 3 of Priya’s last 4 cases')
    expect(rendered).toContain('In Priya’s consultation')
  })

  it('never falls back to "you" or a gendered pronoun for a named student', () => {
    // The model line is quoted patient-facing speech and legitimately says
    // "you"; everything the component itself writes must not.
    const rendered = text(list('Priya')).replace(PATTERN.model_line, '')
    expect(rendered).not.toMatch(/\byour?\b/i)
    expect(rendered).not.toMatch(/\b(he|she|his|her|him|hers)\b/i)
  })
})

describe('PatternBlock copy', () => {
  it('keeps the frequency and quote labels in the second person by default', () => {
    const rendered = text(block())
    expect(rendered).toContain('in 3 of your last 4 cases')
    expect(rendered).toContain('In your consultation')
  })

  it('names the student in the frequency and quote labels', () => {
    const rendered = text(block('Sam'))
    expect(rendered).toContain('in 3 of Sam’s last 4 cases')
    expect(rendered).toContain('In Sam’s consultation')
    expect(rendered).not.toContain('your last')
    expect(rendered).not.toContain('In your consultation')
  })
})

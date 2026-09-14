import React, { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UnmarkableScreen, unmarkableTitle } from './FeedbackReport'

// Vitest compiles JSX with the classic runtime (Next uses the automatic one),
// so the component's JSX needs React in scope when it renders.
;(globalThis as { React?: typeof React }).React = React

/**
 * The report's answer to a consultation the Azure guard refused as too short
 * to mark. Before this existed the page read 'unmarkable' as "still marking",
 * spun for five minutes and then blamed a timeout.
 */

type ScreenProps = Parameters<typeof UnmarkableScreen>[0]

const render = (props: Partial<ScreenProps>): string =>
  renderToStaticMarkup(
    createElement(UnmarkableScreen, {
      isTrial: false,
      candidateSeconds: 40,
      retryHref: '/clinical-master/station/station-9',
      ...props,
    }),
  )

/** Visible text only, entities decoded, so copy assertions read like the page. */
const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

describe('unmarkableTitle', () => {
  it('quotes the run length back when the guard refused it for time', () => {
    expect(unmarkableTitle(40)).toBe('That was 40 seconds, not enough to mark fairly.')
    expect(unmarkableTitle(1)).toBe('That was 1 second, not enough to mark fairly.')
  })

  it('falls back to plain words when there is no usable number', () => {
    expect(unmarkableTitle(null)).toBe('That was too short to mark fairly.')
    expect(unmarkableTitle(0)).toBe('That was too short to mark fairly.')
  })

  it('does not quote a number at or past the 90 second floor', () => {
    // Refused for too few turns rather than for time. "That was 240 seconds,
    // not enough" would have the page arguing with the guard.
    expect(unmarkableTitle(90)).toBe('That was too short to mark fairly.')
    expect(unmarkableTitle(240)).toBe('That was too short to mark fairly.')
  })
})

describe('UnmarkableScreen, signed-in trainee', () => {
  const html = render({})
  const copy = text(html)

  it('says how short, and that nothing was marked', () => {
    expect(copy).toContain('That was 40 seconds, not enough to mark fairly.')
    expect(copy).toContain('A real station runs to about twelve minutes.')
    expect(copy).toContain('Nothing has been marked.')
    expect(copy).toContain("Run it properly and you'll get the full report.")
  })

  it('sends them back to the case brief', () => {
    expect(html).toContain('href="/clinical-master/station/station-9"')
    expect(copy).toContain('Run it properly')
  })

  it('makes no promise about station allowance', () => {
    // Paying users have no station count to spare; the develop copy for the
    // five-station trial must not leak onto main.
    expect(copy).not.toMatch(/used one of your stations|free go/i)
  })

  it('omits the button when there is no station to go back to', () => {
    // The body copy still says "Run it properly"; it is the link that goes.
    expect(render({ retryHref: null })).not.toContain('<a')
  })
})

describe('UnmarkableScreen, free mock visitor', () => {
  const html = render({ isTrial: true, candidateSeconds: 25 })
  const copy = text(html)

  it('says how short, and that there is no report', () => {
    expect(copy).toContain('That was 25 seconds, not enough to mark fairly.')
    expect(copy).toContain('Nothing has been marked, so there is no report for this one.')
  })

  it('points at the plans, never at a rerun the free lane would refuse', () => {
    // /api/try/create-session answers free_station_used for a verified email
    // and redirects to this very report, so a rerun link would loop.
    expect(html).toContain('href="#pricing"')
    expect(html).not.toContain('/clinical-master/station/')
    expect(html).not.toContain('/try/station/')
    expect(copy).not.toMatch(/free go|used one of your stations/i)
  })
})

describe('copy house style', () => {
  it('uses no em or en dashes on either variant', () => {
    for (const html of [render({}), render({ isTrial: true }), render({ candidateSeconds: null })]) {
      expect(text(html)).not.toMatch(/[–—]/)
    }
  })
})

describe('FeedbackReport poll', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./FeedbackReport.tsx', import.meta.url)),
    'utf8',
  )

  it('stops on unmarkable before the generating branch can keep it spinning', () => {
    const unmarkableAt = source.indexOf("data.status === 'unmarkable'")
    const generatingAt = source.indexOf("data.status === 'generating'")
    expect(unmarkableAt).toBeGreaterThan(-1)
    expect(unmarkableAt).toBeLessThan(generatingAt)

    const branch = source.slice(unmarkableAt, generatingAt)
    expect(branch).toContain("setProblem('unmarkable')")
    expect(branch).toContain('setLoading(false)')
    expect(branch).toContain('return;')
    expect(branch).not.toContain('setTimeout(poll')
  })

  it('renders the unmarkable screen for that problem', () => {
    expect(source).toMatch(/problem === 'unmarkable'\) \{\s*return \(\s*<UnmarkableScreen/)
  })
})

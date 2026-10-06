import React, { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SeoCase } from '@/lib/seo/cases'
import type { DraftReviewMeta } from './types'

// Vitest compiles JSX with the classic runtime (Next uses the automatic one),
// so the components' JSX needs React in scope when it renders.
;(globalThis as { React?: typeof React }).React = React

/**
 * The review page's two views, rendered to markup. The public case page
 * component is stubbed to a marker of which case it was handed (and to show
 * the admin bar it was given), so what is checked here is the swap and the bar;
 * the page component itself is the public one, pinned by source in
 * app/api/admin/case-review/route.test.ts.
 *
 * No DOM in this repo's vitest, so the toggle's click is not simulated: the
 * stateful wrapper owns only `view`, and each view is rendered directly.
 */

const shown = vi.hoisted(() => ({ cases: [] as { id: string; hasBar: boolean }[] }))

vi.mock('@/components/cases/CaseDetailPageClient', () => ({
  default: ({ caseData, reviewBar }: { caseData: { id: string }; reviewBar?: ReactNode }) => {
    shown.cases.push({ id: caseData.id, hasBar: Boolean(reviewBar) })
    return createElement('main', { 'data-case': caseData.id }, reviewBar)
  },
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

const { default: CaseReviewPreview, CaseReviewScreen, caseOnShow } = await import('./CaseReviewPreview')

const DRAFT_ID = '4101a48e-0f7a-4790-b370-d06a4fa3a87b'
const OLD_ID = '11111111-1111-4111-8111-111111111111'

function seoCase(over: Partial<SeoCase>): SeoCase {
  return {
    id: DRAFT_ID,
    title: 'Young man with worsening eczema',
    patient_name: 'Sam Patel',
    patient_age: 24,
    consultation_type: 'face_to_face',
    consultation_duration_seconds: 720,
    domain_id: 'dom-1',
    domain_name: 'Dermatology',
    seo_description: 'A young man whose eczema is back.',
    condition: 'Worsening Eczema',
    slug: 'worsening-eczema',
    path: '/sca-cases/worsening-eczema',
    ...over,
  }
}

const DRAFT = seoCase({})
const OLD = seoCase({ id: OLD_ID, title: 'Patient with eczema', condition: 'Eczema', seo_description: null })

const META: DraftReviewMeta = {
  id: DRAFT_ID,
  approvedAt: null,
  approvedBy: null,
  replacesStationId: OLD_ID,
  replaces: { id: OLD_ID, title: 'Patient with eczema', lifecycle: 'archived', keeperCount: 3 },
  checklist: { data_gathering: 12, clinical_management: 0, relating_to_others: 7 },
}

const noop = () => {}

function screen(over: Partial<Parameters<typeof CaseReviewScreen>[0]> = {}): string {
  return renderToStaticMarkup(
    createElement(CaseReviewScreen, {
      meta: META,
      draft: DRAFT,
      old: OLD,
      libraryCaseCount: 200,
      view: 'new',
      onToggleView: noop,
      onApprovalChange: noop,
      ...over,
    }),
  )
}

/** Markup without tags, entities decoded, whitespace collapsed: what a reader sees. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

beforeEach(() => {
  shown.cases = []
})

describe('the new case view (what the page opens on)', () => {
  it('renders the draft through the public case page, with the admin bar on it', () => {
    const html = renderToStaticMarkup(createElement(CaseReviewPreview, { meta: META, draft: DRAFT, old: OLD, libraryCaseCount: 200 }))
    expect(shown.cases).toEqual([{ id: DRAFT_ID, hasBar: true }])
    expect(html).toContain(`data-case="${DRAFT_ID}"`)
    expect(html).toContain('aria-label="Admin review"')
  })

  it('shows the sign-off, a way to sit the case, and the toggle', () => {
    const html = screen()
    const words = text(html)
    expect(words).toContain('Draft Waiting for sign-off')
    expect(words).toContain('Approve this case')
    expect(html).toContain(`href="/clinical-master/station/${DRAFT_ID}" target="_blank" rel="noopener noreferrer"`)
    expect(words).toContain('View the case it replaces')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('href="/admin/case-review"')
  })

  it('shows the line Google will show, and the checklist per domain with a zero flagged', () => {
    const words = text(screen())
    expect(words).toContain('Google shows A young man whose eczema is back.')
    expect(words).toContain('Data gathering 12 Clinical management 0 Relating to others 7')
    expect(screen()).toMatch(/text-danger">0</)
  })

  it('names who approved it, and when, once approved', () => {
    const words = text(screen({ meta: { ...META, approvedAt: '2026-10-05T12:00:00Z', approvedBy: 'ishaq@example.org' } }))
    expect(words).toContain('Approved by ishaq@example.org on 5 Oct 2026')
    expect(words).toContain('Withdraw approval')
    expect(words).not.toContain('Approve this case')
  })

  it('says when no Google line is written and the template stands in', () => {
    const words = text(screen({ draft: { ...DRAFT, seo_description: '  ' } }))
    expect(words).toContain('Google shows Free SCA practice case covering Worsening Eczema.')
    expect(words).toContain('no line written, so the standard template')
  })

  it('says when there is no structured checklist rather than showing zeros', () => {
    const words = text(screen({ meta: { ...META, checklist: null } }))
    expect(words).toContain('Checklist None. The marker needs one before this case goes live.')
  })
})

describe('the old case view', () => {
  it('swaps the page to the old case, and says so', () => {
    const html = screen({ view: 'old' })
    const words = text(html)
    expect(shown.cases).toEqual([{ id: OLD_ID, hasBar: true }])
    expect(words).toContain('Old case it replaces · archived · 3 keepers. Read only.')
    expect(words).toContain('Back to the new case')
    expect(html).toContain('aria-pressed="true"')
  })

  it('puts away everything that acts on the draft', () => {
    const words = text(screen({ view: 'old' }))
    expect(words).not.toContain('Approve this case')
    expect(words).not.toContain('Try this case')
    expect(words).not.toContain('Google shows')
    expect(words).not.toContain('Checklist')
  })
})

describe('a draft with no old case to show', () => {
  it('stays on the draft, with no toggle', () => {
    const words = text(screen({ view: 'old', old: null, meta: { ...META, replacesStationId: null, replaces: null } }))
    expect(shown.cases).toEqual([{ id: DRAFT_ID, hasBar: true }])
    expect(words).toContain('New case, replaces nothing')
    expect(words).not.toContain('View the case it replaces')
  })

  it('flags an old case that could not be found or loaded', () => {
    expect(text(screen({ old: null, meta: { ...META, replaces: null } }))).toContain('Replaces a case that could not be found')
    expect(text(screen({ old: null }))).toContain('Replaces Patient with eczema, which could not be loaded')
  })

  it('caseOnShow falls back to the draft', () => {
    expect(caseOnShow('old', DRAFT, null)).toBe(DRAFT)
    expect(caseOnShow('old', DRAFT, OLD)).toBe(OLD)
    expect(caseOnShow('new', DRAFT, OLD)).toBe(DRAFT)
  })
})

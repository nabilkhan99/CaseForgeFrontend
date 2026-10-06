'use client'

import { useCallback, useState } from 'react'
import CaseDetailPageClient from '@/components/cases/CaseDetailPageClient'
import type { SeoCase } from '@/lib/seo/cases'
import CaseReviewBar, { type ReviewView } from './CaseReviewBar'
import type { CaseApprovalResponse, DraftReviewMeta } from './types'

/**
 * /admin/case-review/[id]: the draft rendered by the public case page's own
 * component, CaseDetailPageClient, so the reviewer sees the page trainees will
 * get (header, brief, photos, script, mark scheme, learning points, further
 * reading) and nothing else, bar the admin strip on top.
 *
 * "View the case it replaces" swaps the case on that same component, so the
 * open tab survives the swap: read the new mark scheme, flip, read the old.
 */

export interface CaseReviewPreviewProps {
  meta: DraftReviewMeta
  draft: SeoCase
  old: SeoCase | null
  libraryCaseCount: number
}

interface CaseReviewScreenProps extends CaseReviewPreviewProps {
  view: ReviewView
  onToggleView: () => void
  onApprovalChange: (approval: CaseApprovalResponse) => void
}

/** The case the page shows: the old one only when asked for and there is one. */
export function caseOnShow(view: ReviewView, draft: SeoCase, old: SeoCase | null): SeoCase {
  return view === 'old' && old ? old : draft
}

/** Stateless: what one view of the review looks like. */
export function CaseReviewScreen({
  meta,
  draft,
  old,
  libraryCaseCount,
  view,
  onToggleView,
  onApprovalChange,
}: CaseReviewScreenProps) {
  const shown = caseOnShow(view, draft, old)
  return (
    <CaseDetailPageClient
      caseData={shown}
      libraryCaseCount={libraryCaseCount}
      reviewBar={
        <CaseReviewBar
          meta={meta}
          draft={draft}
          old={old}
          view={shown === draft ? 'new' : 'old'}
          onToggleView={onToggleView}
          onApprovalChange={onApprovalChange}
        />
      }
    />
  )
}

export default function CaseReviewPreview({ meta: initialMeta, draft, old, libraryCaseCount }: CaseReviewPreviewProps) {
  const [view, setView] = useState<ReviewView>('new')
  const [meta, setMeta] = useState<DraftReviewMeta>(initialMeta)

  const onToggleView = useCallback(() => setView((v) => (v === 'new' ? 'old' : 'new')), [])
  const onApprovalChange = useCallback((approval: CaseApprovalResponse) => {
    setMeta((prev) => ({ ...prev, approvedAt: approval.approvedAt, approvedBy: approval.approvedBy }))
  }, [])

  return (
    <CaseReviewScreen
      meta={meta}
      draft={draft}
      old={old}
      libraryCaseCount={libraryCaseCount}
      view={view}
      onToggleView={onToggleView}
      onApprovalChange={onApprovalChange}
    />
  )
}

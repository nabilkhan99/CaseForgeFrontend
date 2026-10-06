import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getCaseByIdForReview, getPublicCasesForList, type PublicCase } from '@/lib/cases/publicCases'
import { buildCaseSeoIndex, type SeoCase } from '@/lib/seo/cases'
import { loadDraftReviewMeta } from '@/app/api/admin/case-review/caseReviewData'
import type { DraftReviewMeta } from '@/components/admin/case-review/types'

/**
 * Everything /admin/case-review/[id] renders, read server side. ADMIN ONLY:
 * the page calls this after requireAdminPage, never before.
 *
 * The draft and the case it replaces are read with the public case page's own
 * helper (getCaseByIdForReview is getPublicCaseById without the live filter)
 * and shaped by the same SEO index (condition, overrides), so the review page
 * hands CaseDetailPageClient exactly the data the public page would.
 */
export interface CaseReviewPageData {
  meta: DraftReviewMeta
  draft: SeoCase
  /** Null when the draft replaces nothing, or the old case could not be read. */
  old: SeoCase | null
  /** The live library's size, for the page's footer line, as on the public page. */
  libraryCaseCount: number
}

/**
 * One case shaped as /sca-cases/[slug] shapes it: its SEO index entry over its
 * full body. Indexed alone, so the slug carries no collision suffix; the page
 * component never shows the slug, so nothing on screen differs.
 */
function asCasePage(caseItem: PublicCase): SeoCase {
  return buildCaseSeoIndex([caseItem])[0]
}

/** Null when the id is not a draft (the page 404s). Throws on a failed read. */
export async function loadCaseReview(id: string): Promise<CaseReviewPageData | null> {
  const meta = await loadDraftReviewMeta(getSupabaseAdmin(), id)
  if (!meta) return null

  const [draft, old, live] = await Promise.all([
    getCaseByIdForReview(id),
    meta.replaces ? getCaseByIdForReview(meta.replaces.id) : Promise.resolve(null),
    getPublicCasesForList(),
  ])

  // The draft row was there a moment ago, so a missing body is a failed read,
  // not a 404: say so rather than pretend the case does not exist.
  if (!draft) throw new Error(`draft ${id} exists but its case body could not be read`)

  return {
    meta,
    draft: asCasePage(draft),
    old: old ? asCasePage(old) : null,
    libraryCaseCount: live.length,
  }
}

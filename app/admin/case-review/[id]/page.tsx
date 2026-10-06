import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CaseReviewPreview from '@/components/admin/case-review/CaseReviewPreview'
import { UUID_RE } from '@/app/api/admin/case-review/caseReviewData'
import { requireAdminPage } from '../requireAdminPage'
import { loadCaseReview } from './loadCaseReview'

export const metadata: Metadata = {
  title: 'Review a case | Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * One draft case, rendered exactly as its public /sca-cases page will look
 * (the same CaseDetailPageClient, fed the same data shape), under a slim admin
 * bar with the sign-off and a toggle to the old case it replaces. Admin only:
 * the gate runs before anything is read.
 */
export default async function AdminCaseReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdminPage(`/admin/case-review/${id}`)
  if (!UUID_RE.test(id)) notFound()

  const review = await loadCaseReview(id)
  if (!review) notFound()

  return <CaseReviewPreview {...review} />
}

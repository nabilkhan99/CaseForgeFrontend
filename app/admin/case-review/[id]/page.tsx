import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CaseReviewDetail from '@/components/admin/case-review/CaseReviewDetail'
import { UUID_RE } from '@/app/api/admin/case-review/caseReviewData'
import { requireAdminPage } from '../requireAdminPage'

export const metadata: Metadata = {
  title: 'Review a case | Admin',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

/** One draft next to the old case it replaces, with the sign-off. Admin only. */
export default async function AdminCaseReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdminPage(`/admin/case-review/${id}`)
  if (!UUID_RE.test(id)) notFound()
  return <CaseReviewDetail id={id} />
}

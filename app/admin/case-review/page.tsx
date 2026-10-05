import type { Metadata } from 'next'
import CaseReviewList from '@/components/admin/case-review/CaseReviewList'
import { requireAdminPage } from './requireAdminPage'

export const metadata: Metadata = {
  title: 'Case review | Admin',
  robots: { index: false },
}

// Guard runs on every request; it reads the session per-request.
export const dynamic = 'force-dynamic'

/** Draft cases waiting for (or holding) clinical sign-off. Admin only. */
export default async function AdminCaseReviewPage() {
  await requireAdminPage('/admin/case-review')
  return <CaseReviewList />
}

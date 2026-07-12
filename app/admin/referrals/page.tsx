import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isAdmin } from '@/lib/admin/guard';
import ReferralsTable from './ReferralsTable';

export const metadata: Metadata = {
  title: 'Referrals — Admin',
  robots: { index: false },
};

// Guard runs on every request; the guard itself reads the session per-request.
export const dynamic = 'force-dynamic';

export default async function AdminReferralsPage() {
  // Fail-closed guard before any data access — render 404 to non-admins so the
  // route's existence isn't disclosed.
  if (!(await isAdmin())) {
    notFound();
  }

  return <ReferralsTable />;
}

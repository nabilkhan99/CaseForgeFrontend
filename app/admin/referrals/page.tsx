import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { parseAdminEmails } from '@/lib/admin/guard';
import ReferralsTable from './ReferralsTable';

export const metadata: Metadata = {
  title: 'Referrals — Admin',
  robots: { index: false },
};

// Guard runs on every request; it reads the session per-request.
export const dynamic = 'force-dynamic';

const SIGN_IN_PATH = '/auth/sign-in?redirect=/admin/referrals';

/**
 * Fail-closed admin gate with a friendlier logged-out path:
 *   - not signed in     -> redirect to sign-in (with a return path here)
 *   - signed-in non-admin -> 404 (route existence stays hidden from strangers)
 *   - any auth error      -> 404 (fail closed)
 */
export default async function AdminReferralsPage() {
  // Resolve the session inside try/catch (fail closed on error); keep the
  // redirect()/notFound() control-flow signals OUTSIDE it so they propagate.
  let userEmail: string | null = null;
  let hasUser = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasUser = Boolean(user);
    userEmail = user?.email?.trim().toLowerCase() ?? null;
  } catch (error: unknown) {
    console.error('[admin-referrals-page] auth check failed', error);
    notFound();
  }

  if (!hasUser) {
    redirect(SIGN_IN_PATH);
  }

  const allowlist = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (!userEmail || !allowlist.has(userEmail)) {
    notFound();
  }

  return <ReferralsTable />;
}

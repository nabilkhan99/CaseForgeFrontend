import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { parseAdminEmails } from '@/lib/admin/guard';
import AdminHome from './AdminHome';

export const metadata: Metadata = {
  title: 'Admin — Fourteen Fisherman',
  robots: { index: false },
};

// Guard runs on every request; it reads the session per-request.
export const dynamic = 'force-dynamic';

const SIGN_IN_PATH = '/auth/sign-in?redirect=/admin';

/**
 * Front door for the admin area. Same fail-closed gate as the pages it links to:
 *   - not signed in       -> redirect to sign-in (with a return path here)
 *   - signed-in non-admin -> 404 (route existence stays hidden from strangers)
 *   - any auth error      -> 404 (fail closed)
 */
export default async function AdminPage() {
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
    console.error('[admin-page] auth check failed', error);
    notFound();
  }

  if (!hasUser) {
    redirect(SIGN_IN_PATH);
  }

  const allowlist = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (!userEmail || !allowlist.has(userEmail)) {
    notFound();
  }

  return <AdminHome email={userEmail} />;
}

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseAdminEmails } from '@/lib/admin/guard'

/**
 * The same fail-closed gate as /admin, /admin/recordings and /admin/leads,
 * shared by the two case review pages:
 *   - not signed in       -> redirect to sign-in (with a return path)
 *   - signed-in non-admin -> 404 (route existence stays hidden from strangers)
 *   - any auth error      -> 404 (fail closed)
 */
export async function requireAdminPage(returnPath: string): Promise<string> {
  // Resolve the session inside try/catch (fail closed on error); keep the
  // redirect()/notFound() control-flow signals OUTSIDE it so they propagate.
  let userEmail: string | null = null
  let hasUser = false
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    hasUser = Boolean(user)
    userEmail = user?.email?.trim().toLowerCase() ?? null
  } catch (error: unknown) {
    console.error('[admin-case-review-page] auth check failed', error)
    notFound()
  }

  if (!hasUser) {
    redirect(`/auth/sign-in?redirect=${encodeURIComponent(returnPath)}`)
  }

  const allowlist = parseAdminEmails(process.env.ADMIN_EMAILS)
  if (!userEmail || !allowlist.has(userEmail)) {
    notFound()
  }
  return userEmail
}

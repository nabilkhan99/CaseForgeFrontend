import { createClient } from '@/lib/supabase/server'

/**
 * Parse the comma-separated ADMIN_EMAILS allowlist into a normalized set.
 * Fails closed: an unset or empty env yields an empty set (deny everyone).
 */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

/**
 * True when the currently authenticated Supabase user's email is on the
 * ADMIN_EMAILS allowlist. Fail-closed at every step: no session, no email,
 * or unset allowlist all deny.
 *
 * Use in both admin route handlers (return 403 JSON) and admin pages
 * (redirect / render 404) — the check must run before any data access.
 */
export async function isAdmin(): Promise<boolean> {
  return (await getAdminEmail()) !== null
}

/**
 * The signed-in admin's lower-cased email, or null for anyone who is not an
 * admin. Same fail-closed checks as isAdmin(); use it when a route needs to
 * record who did something, not just whether they may.
 */
export async function getAdminEmail(): Promise<string | null> {
  const allowlist = parseAdminEmails(process.env.ADMIN_EMAILS)
  if (allowlist.size === 0) return null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const email = user?.email?.trim().toLowerCase()
    return email && allowlist.has(email) ? email : null
  } catch (error: unknown) {
    console.error('[admin-guard] auth check failed', error)
    return null
  }
}

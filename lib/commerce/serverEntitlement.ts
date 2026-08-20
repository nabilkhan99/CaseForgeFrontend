import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { parseAdminEmails } from '@/lib/admin/guard'
import { isStagedDeployment } from '@/lib/stations/visibility'
import { decideAccess, NO_ENTITLEMENT, type AccessDecision } from './entitlements'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface ServerEntitlement extends AccessDecision {
  /** Null when the request carries no session — callers answer 401 themselves. */
  user: User | null
  /**
   * The request's cookie-scoped client, handed back so a route can do its own
   * RLS work without paying for a second `auth.getUser()` round-trip.
   */
  supabase: ServerSupabaseClient
}

/**
 * What the caller of a server route is entitled to, decided exactly as the
 * page middleware decides it (`decideAccess`).
 *
 * The middleware only guards page navigations; without this, any signed-in
 * user could POST straight at the endpoints that create sessions and mint
 * Azure keys. Purchases are matched by email (buying email = account email)
 * and the RLS policy "read own purchases by email" scopes the select.
 */
export async function getServerEntitlement(): Promise<ServerEntitlement> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, entitlement: NO_ENTITLEMENT, bypass: false, allowed: false }
  }

  try {
    const { data: purchases, error } = await supabase
      .from('preorders')
      .select('plan, status, created_at, coaching_day')
    if (error) throw error

    return {
      supabase,
      user,
      ...decideAccess(purchases ?? [], {
        email: user.email,
        staged: isStagedDeployment(),
        admins: parseAdminEmails(process.env.ADMIN_EMAILS),
      }),
    }
  } catch (error: unknown) {
    // Same fail-open stance as the middleware — a transient DB error must not
    // lock paying users out mid-revision — but loud, because a gate that
    // silently stops gating is the failure nobody notices.
    console.error('[entitlement] fail-open:', error)
    return { supabase, user, entitlement: NO_ENTITLEMENT, bypass: true, allowed: true }
  }
}

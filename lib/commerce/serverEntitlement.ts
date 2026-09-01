import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { parseAdminEmails } from '@/lib/admin/guard'
import { effectiveLaunchDate } from '@/lib/commerce/launchDate'
import { decideAccess, NO_ENTITLEMENT, type AccessDecision } from './entitlements'
import { loadCohortAccess } from './cohortAccess'
import { exactEmailPattern } from './emailFilter'

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface ServerEntitlement extends AccessDecision {
  /** Null when the request carries no session — callers answer 401 themselves. */
  user: User | null
  /**
   * The lookup failed and access was granted anyway. Kept separate from
   * `bypass` (which means access was deliberately waived for an admin) so
   * nothing downstream can mistake a broken gate for a
   * granted one — a fail-open must be able to say so.
   */
  failedOpen: boolean
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
    return {
      supabase,
      user: null,
      entitlement: NO_ENTITLEMENT,
      bypass: false,
      cohort: null,
      cohortOnly: false,
      failedOpen: false,
      allowed: false,
    }
  }

  // Outside the try below on purpose: `loadCohortAccess` fails closed on its
  // own, and a cohort read that broke must not be able to take the purchase
  // read down with it into the fail-open branch.
  const cohort = await loadCohortAccess(supabase, user.id)

  try {
    // Belt and braces, exactly as the middleware does it: RLS already scopes
    // this select to the user's own email, but a dropped policy must degrade
    // to "no rows", not "every purchase in the database" — which would fold to
    // `active` and hand the whole product to any signed-in account.
    const { data: purchases, error } = await supabase
      .from('preorders')
      .select('plan, status, created_at, coaching_day, access_starts_at, access_ends_at')
      .ilike('email', exactEmailPattern(user.email))
    if (error) throw error

    return {
      supabase,
      user,
      failedOpen: false,
      ...decideAccess(purchases ?? [], {
        email: user.email,
        launchDate: effectiveLaunchDate(),
        admins: parseAdminEmails(process.env.ADMIN_EMAILS),
        cohort,
      }),
    }
  } catch (error: unknown) {
    // Same fail-open stance as the middleware — a transient DB error must not
    // lock paying users out mid-revision — but loud, because a gate that
    // silently stops gating is the failure nobody notices. `bypass` stays
    // false: nobody waived this access, the lookup broke, and callers that
    // report state to the user need to be able to tell the two apart.
    console.error('[entitlement] fail-open:', error)
    return {
      supabase,
      user,
      entitlement: NO_ENTITLEMENT,
      bypass: false,
      // The cohort read succeeded or returned null on its own terms; it is
      // reported either way so a pilot student whose purchase lookup broke is
      // still recognised as cohort-limited rather than silently given the bank.
      cohort,
      cohortOnly: cohort !== null,
      failedOpen: true,
      allowed: true,
    }
  }
}

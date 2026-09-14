import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { parseAdminEmails } from '@/lib/admin/guard'
import { effectiveLaunchDate } from '@/lib/commerce/launchDate'
import {
  decideAccess,
  NO_ENTITLEMENT,
  type AccessDecision,
  type EntitlementRow,
} from './entitlements'
import { loadCohortAccess } from './cohortAccess'
import { loadTrialAccessForGrant, loadTrialGrant, trialAccessFromGrant } from './trialAccess'
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

/** The purchase read, settled rather than thrown, so it can share a batch. */
type PurchaseRead = { ok: true; rows: EntitlementRow[] } | { ok: false; error: unknown }

/**
 * The signed-in user's purchases, matched by email.
 *
 * Never rejects: a failure comes back as a value, so the batch it runs in still
 * delivers the cohort and the grant, and the caller fails open on the purchase
 * read alone.
 */
async function readPurchases(supabase: ServerSupabaseClient, user: User): Promise<PurchaseRead> {
  try {
    // Belt and braces, exactly as the middleware does it: RLS already scopes
    // this select to the user's own email, but a dropped policy must degrade
    // to "no rows", not "every purchase in the database" — which would fold to
    // `active` and hand the whole product to any signed-in account.
    const { data, error } = await supabase
      .from('preorders')
      .select('plan, status, created_at, coaching_day, coaching_slot, access_starts_at, access_ends_at')
      .ilike('email', exactEmailPattern(user.email))
    if (error) throw error
    return { ok: true, rows: (data ?? []) as EntitlementRow[] }
  } catch (error: unknown) {
    return { ok: false, error }
  }
}

/**
 * What the caller of a server route is entitled to, decided exactly as the
 * page middleware decides it (`decideAccess`).
 *
 * The middleware only guards page navigations; without this, any signed-in
 * user could POST straight at the endpoints that create sessions and mint
 * Azure keys. Purchases are matched by email (buying email = account email)
 * and the RLS policy "read own purchases by email" scopes the select.
 *
 * ROUND TRIPS. One batch of three for everybody — purchases, cohort, trial
 * grant — issued together, because this sits on the hottest path in the
 * product (every consultation start, every navbar poll of /api/subscription).
 * Access is decided from that batch alone: whether a grant is live depends on
 * the row and the clock, nothing else. The trial's five cases and the progress
 * through them cost two more round trips, and only an account whose access
 * RESTS on a live grant (`trialOnly`) pays them — so a paying customer never
 * does, including one who began as a trialist and still has the row.
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
      trial: null,
      trialOnly: false,
      failedOpen: false,
      allowed: false,
    }
  }

  // The cohort and grant reads fail closed on their own and the purchase read
  // settles to a value, so none of the three can take the others down with it
  // into the fail-open branch.
  const [purchases, cohort, grant] = await Promise.all([
    readPurchases(supabase, user),
    loadCohortAccess(supabase, user.id),
    loadTrialGrant(supabase, user.id),
  ])
  const now = new Date()
  const grantState = grant ? trialAccessFromGrant(grant, now) : null

  if (!purchases.ok) {
    // Same fail-open stance as the middleware — a transient DB error must not
    // lock paying users out mid-revision — but loud, because a gate that
    // silently stops gating is the failure nobody notices. `bypass` stays
    // false: nobody waived this access, the lookup broke, and callers that
    // report state to the user need to be able to tell the two apart.
    console.error('[entitlement] fail-open:', purchases.error)
    return {
      supabase,
      user,
      entitlement: NO_ENTITLEMENT,
      bypass: false,
      // The cohort read succeeded or returned null on its own terms; it is
      // reported either way so a pilot student whose purchase lookup broke is
      // still recognised as cohort-limited rather than silently given the bank.
      cohort,
      // The grant read succeeded or failed closed on its own terms, so where it
      // stands is reported either way. `trialOnly` stays FALSE regardless: this
      // branch has already granted access unconditionally, and claiming the
      // trial is what granted it would narrow the trainee to five cases against
      // a broken lookup — and, on the dashboard, count down a trial that is not
      // being used. Which is also why the five are not loaded here.
      trial: grantState,
      trialOnly: false,
      cohortOnly: grantState?.state === 'trial' ? false : cohort !== null,
      failedOpen: true,
      allowed: true,
    }
  }

  const decision = decideAccess(purchases.rows, {
    email: user.email,
    now,
    launchDate: effectiveLaunchDate(),
    admins: parseAdminEmails(process.env.ADMIN_EMAILS),
    cohort,
    trial: grantState,
  })

  // `trialOnly` is exactly "a live grant, with no purchase or admin allowlist
  // outranking it" — the one case where WHICH cases the account may open is the
  // trial's to say, and where the dashboard draws progress. Swapping in the full
  // picture changes nothing `decideAccess` decided: it reads only `state`.
  if (grant && decision.trialOnly) {
    return {
      supabase,
      user,
      failedOpen: false,
      ...decision,
      trial: await loadTrialAccessForGrant(supabase, grant, now),
    }
  }

  return { supabase, user, failedOpen: false, ...decision }
}

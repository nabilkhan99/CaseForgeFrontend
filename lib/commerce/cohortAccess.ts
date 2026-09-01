import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A trainer pilot seat: access to a named handful of cases, without a purchase.
 *
 * Deliberately a peer of {@link import('./entitlements').Entitlement} rather
 * than a plan inside it. A cohort seat has no window, no tier and no money
 * behind it, so folding it into the `preorders` precedence ladder would mean
 * teaching every rule on that ladder about a row shape that does not exist.
 * `decideAccess` composes the two instead: purchases decide *whether* someone
 * may practise, a cohort can also say yes, and `station_ids` decides *what*.
 */
export interface CohortAccess {
  id: string;
  /**
   * Every station this cohort may open — the whole of a cohort-only user's
   * access, not a bonus on top of one. Empty means the cohort has been created
   * but not yet assigned cases: access to nothing, which is the safe reading.
   */
  stationIds: string[];
  /** The educator who owns the cohort. Compared through lower(), never raw. */
  trainerEmail: string;
}

/** The nested shape PostgREST returns for the membership → cohort join. */
interface CohortMemberRow {
  cohorts: {
    id: string;
    station_ids: string[] | null;
    trainer_email: string | null;
  } | null;
}

/**
 * The cohort a signed-in user belongs to, or null.
 *
 * FAILS CLOSED, unlike the purchase lookup beside it. The two are not the same
 * risk: a broken `preorders` read locks out customers who have paid, so it
 * fails open loudly; a broken `cohorts` read only means a pilot student sees
 * the paywall for a few minutes. Failing open here would instead hand every
 * signed-in account a cohort-shaped grant with an empty allowlist, and the
 * enforcement downstream keys off "is this user cohort-only" — so a fail-open
 * would be a new way to be told your cases don't exist, not a way through.
 *
 * Takes the caller's client rather than making one, because the three callers
 * run in three runtimes: the edge middleware's request-scoped client, the
 * route handlers' cookie-scoped one, and the service-role client behind the
 * trainer guard. RLS (`read own cohort membership` / `read own cohort`) scopes
 * the first two; the explicit `user_id` filter is what scopes the third, and is
 * belt-and-braces for the other two exactly as the purchase reads are.
 */
export async function loadCohortAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<CohortAccess | null> {
  try {
    const { data, error } = await supabase
      .from('cohort_members')
      .select('cohorts(id, station_ids, trainer_email)')
      .eq('user_id', userId)
      // One cohort per user is the pilot's shape, not a constraint the schema
      // enforces. Oldest wins so a second membership cannot silently change
      // which five cases somebody has between two page loads.
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const cohort = (data as CohortMemberRow | null)?.cohorts;
    if (!cohort?.id || !cohort.trainer_email) return null;

    return {
      id: cohort.id,
      stationIds: cohort.station_ids ?? [],
      trainerEmail: cohort.trainer_email,
    };
  } catch (error: unknown) {
    // Loud, because a pilot student hitting the paywall reads as a billing bug
    // and will be reported as one.
    console.error('[cohort] membership lookup failed — no cohort access', error);
    return null;
  }
}

/** True when `stationId` is one of the cases this cohort was assigned. */
export function cohortAllowsStation(cohort: CohortAccess, stationId: string): boolean {
  return cohort.stationIds.includes(stationId);
}

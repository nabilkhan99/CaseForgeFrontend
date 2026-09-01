import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * The cohort a signed-in educator owns, and who is in it.
 *
 * The trainer's own user id is deliberately absent from {@link studentIds}:
 * they are a member of their own cohort so they can sit the same five cases,
 * and every number on the Students tab would otherwise be their own practice
 * mixed in with their students'.
 */
export interface TrainerCohort {
  cohortId: string;
  name: string;
  /** The cases this cohort was assigned. */
  stationIds: string[];
  /** Cohort members other than the trainer, in join order. */
  studentIds: string[];
}

interface CohortRow {
  id: string;
  name: string;
  station_ids: string[] | null;
}

interface MemberRow {
  user_id: string;
}

/**
 * The trainer guard, mirroring `isAdmin()` (lib/admin/guard.ts) beat for beat:
 * fail-closed at every step, run before any data access, and 403 on the route
 * side rather than here.
 *
 * Service role, not RLS. RLS lets a member read the cohort they belong to,
 * which is enough to know their own allowlist and no more — a trainer needs to
 * read rows across three other accounts, which no own-data policy will ever
 * return. So the authority is this function, and the routes behind it are the
 * only things that may hold the students' data.
 *
 * Matched by plain equality on an address lower-cased here first. `cohorts`
 * requires the normal form by CHECK constraint, so a cohort can only ever be
 * seeded as `trainer@clinic.ca` and an account signed in as `Trainer@Clinic.CA`
 * still resolves — without the unindexable `lower()`/ILIKE dance that
 * `preorders` needs, where Stripe controls the stored casing and we do not.
 *
 * Returns null for: no session, no email, no cohort owned, or any error at all.
 */
export async function getTrainerCohort(): Promise<TrainerCohort | null> {
  let email: string | null = null;
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email?.trim().toLowerCase() ?? null;
    userId = user?.id ?? null;
  } catch (error: unknown) {
    console.error('[trainer-guard] auth check failed', error);
    return null;
  }

  if (!email || !userId) return null;

  try {
    const admin = getSupabaseAdmin();

    // `.eq` on an already-lower-cased address, not `.ilike`. The column carries
    // a CHECK constraint requiring the normal form (see the migration), so this
    // is exact AND it is the only shape `cohorts_trainer_email_idx` can serve —
    // Postgres will not rewrite a wildcard-free ILIKE into an index lookup, so
    // the careful-looking version was a guaranteed sequential scan.
    //
    // Ordered and capped rather than a bare `.maybeSingle()`. Nothing stops two
    // cohorts naming the same trainer — the pilot is seeded by hand — and an
    // unordered maybeSingle would either error (PGRST116, which fails closed and
    // reads as "you are not a trainer") or return whichever row Postgres felt
    // like. Oldest wins, every time.
    const { data: cohort, error: cohortError } = await admin
      .from('cohorts')
      .select('id, name, station_ids')
      .eq('trainer_email', email)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (cohortError) throw cohortError;
    if (!cohort) return null;

    const row = cohort as CohortRow;

    const { data: members, error: memberError } = await admin
      .from('cohort_members')
      .select('user_id')
      .eq('cohort_id', row.id)
      .order('created_at', { ascending: true });
    if (memberError) throw memberError;

    return {
      cohortId: row.id,
      name: row.name,
      stationIds: row.station_ids ?? [],
      studentIds: ((members ?? []) as MemberRow[])
        .map((member) => member.user_id)
        .filter((id) => id !== userId),
    };
  } catch (error: unknown) {
    console.error('[trainer-guard] cohort lookup failed', error);
    return null;
  }
}

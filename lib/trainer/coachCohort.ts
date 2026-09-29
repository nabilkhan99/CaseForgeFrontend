import type { SupabaseClient } from '@supabase/supabase-js';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';

/**
 * Lets a one to one coach see their student on the trainer Students tab.
 *
 * Reuses the trainer cohort feature rather than inventing a second visibility
 * rule: a coach owns ONE cohort (matched by `trainer_email`), and the coach and
 * each of their students are `cohort_members` of it. The coach has to be a
 * member too, because the Students tab nav hint (`isTrainer` in
 * /api/subscription) reads the cohort the signed-in user belongs to.
 *
 * One cohort per coach, never one per student: `getTrainerCohort()` in
 * lib/trainer/guard.ts only ever reads a coach's OLDEST cohort, so a second one
 * would hide every student put in it. This module resolves the cohort with the
 * exact same rule and only creates one when the coach has none.
 *
 * The cohort is created with `station_ids = '{}'`. Purchased students keep the
 * whole bank regardless (their purchase decides access, not the cohort), and an
 * empty allowlist is the safe reading for anyone without one.
 *
 * Service role only: cohorts and cohort_members have no write policy, so the
 * caller passes the admin client. Database errors throw; a missing account is a
 * warning for the admin, because the fix is "ask them to sign up, save again".
 */

export interface EnsureCoachSeesStudentArgs {
  coachEmail: string;
  coachName: string;
  studentEmail: string;
}

export interface EnsureCoachSeesStudentResult {
  cohortId: string;
  warnings: string[];
}

export const COACH_NO_ACCOUNT_WARNING =
  'The coach has no account yet, so their Students tab will not appear until they sign up and you save again.';

export function studentNoAccountWarning(studentEmail: string): string {
  return `${studentEmail.trim()} has no account yet.`;
}

/** How a coach's cohort is named when this module has to create it. */
export function coachCohortName(coachName: string): string {
  return `${coachName.trim()}, one to one coaching`;
}

/** The normal form `cohorts.trainer_email` is constrained to. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The coach's cohort id: the OLDEST cohort naming them, the same rule the
 * trainer guard uses, so the cohort written to here is the one the coach's
 * Students tab reads. Null when they own none. Throws on a database error.
 */
export async function findCoachCohortId(
  admin: SupabaseClient,
  coachEmail: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('cohorts')
    .select('id')
    .eq('trainer_email', normaliseEmail(coachEmail))
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * The account behind an address, by exact case-insensitive match on
 * `public.profiles` (one row per auth user, kept by trigger). Same shape as the
 * private lookup in lib/auth/provisioning.ts, except a database error throws
 * here: silently reading it as "no account" would tell the admin to chase a
 * sign-up that already happened.
 */
export async function findUserIdByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .ilike('email', exactEmailPattern(email))
    .maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

async function createCoachCohort(
  admin: SupabaseClient,
  coachEmail: string,
  coachName: string,
): Promise<string> {
  const { data, error } = await admin
    .from('cohorts')
    .insert({
      name: coachCohortName(coachName),
      trainer_email: coachEmail,
      station_ids: [],
    })
    .select('id')
    .single();
  if (error) throw error;
  const id = (data as { id?: string } | null)?.id;
  if (!id) throw new Error('Cohort insert returned no id');
  return id;
}

/**
 * Make sure the coach owns a cohort and that the coach and the student are both
 * members of it. Idempotent: saving the same booking twice changes nothing.
 */
export async function ensureCoachSeesStudent(
  admin: SupabaseClient,
  args: EnsureCoachSeesStudentArgs,
): Promise<EnsureCoachSeesStudentResult> {
  const coachEmail = normaliseEmail(args.coachEmail);

  const cohortId =
    (await findCoachCohortId(admin, coachEmail)) ??
    (await createCoachCohort(admin, coachEmail, args.coachName));

  const [coachId, studentId] = await Promise.all([
    findUserIdByEmail(admin, coachEmail),
    findUserIdByEmail(admin, args.studentEmail),
  ]);

  const warnings: string[] = [];
  if (!coachId) warnings.push(COACH_NO_ACCOUNT_WARNING);
  if (!studentId) warnings.push(studentNoAccountWarning(args.studentEmail));

  // Deduplicated: a coach booking a session with themselves (testing) would
  // otherwise put the same key in one statement twice.
  const userIds = [...new Set([coachId, studentId].filter((id): id is string => Boolean(id)))];
  if (userIds.length > 0) {
    const { error } = await admin
      .from('cohort_members')
      .upsert(
        userIds.map((userId) => ({ cohort_id: cohortId, user_id: userId })),
        { onConflict: 'cohort_id,user_id', ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  return { cohortId, warnings };
}

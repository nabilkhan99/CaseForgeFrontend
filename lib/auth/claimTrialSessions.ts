import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import { normalizeEmail } from '@/lib/commerce/referrals';

/**
 * Attaching the free mock a person sat as a GUEST to the account they later
 * ended up with.
 *
 * The free-station funnel (/try) is deliberately anonymous: `app/api/try/*`
 * writes `clinical_sessions` rows with `user_id: null`, and the only identity
 * ever attached is the `trial_leads` row the email gate writes after the
 * consultation. So the single most valuable thing a new customer owns — the
 * mock that convinced them to buy, with its transcript and its marked feedback
 * — is invisible from the dashboard they get on day one. They see "Start your
 * first consultation" and reasonably conclude their work was thrown away.
 *
 * This closes that gap on the only evidence we actually have: the lead
 * VERIFIED that email (they typed a code we sent to it), and the account is
 * signed in under the same address, so the two are the same person.
 *
 * Three rules, all load-bearing:
 *  - `email_verified_at is not null` — an unverified lead is an unproven claim
 *    on someone else's consultation. Anyone can type any address into the gate.
 *  - `user_id is null` in the WHERE — a session that already belongs to
 *    somebody is NEVER reassigned, whatever the leads table says.
 *  - Case-insensitive matching, via {@link exactEmailPattern}, exactly as
 *    entitlements match purchases: `trial_leads` is uniquely indexed on
 *    `lower(email)`, so a lead stored as `Sarah@Nhs.net` must match an account
 *    signing in as `sarah@nhs.net` or the claim silently never happens.
 *
 * Idempotent by construction: the second run matches the same leads, finds
 * their sessions already owned, and claims nothing.
 */

/** Anything that can reach the tables — in practice the service-role client. */
type ClaimClient = Pick<SupabaseClient, 'from'>;

export async function claimTrialSessionsForUser(
  supabase: ClaimClient,
  userId: string,
  email: string | null | undefined,
): Promise<number> {
  const normalized = normalizeEmail(email ?? '');
  if (!userId || !normalized) return 0;

  // One indexed lookup. `trial_leads` is unique on lower(email), so this is at
  // most a handful of rows even if the "one free station per person" rule ever
  // relaxes.
  const { data: leads, error: leadError } = await supabase
    .from('trial_leads')
    .select('session_id')
    .ilike('email', exactEmailPattern(normalized))
    .not('email_verified_at', 'is', null);

  if (leadError) {
    console.error('[claim-trial] lead lookup failed', { userId, error: leadError });
    return 0;
  }

  const sessionIds = [
    ...new Set(
      (leads ?? [])
        .map((lead) => (lead as { session_id?: string | null }).session_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (sessionIds.length === 0) return 0;

  // `.is('user_id', null)` is the whole safety story: it is what makes a
  // re-run a no-op and what stops a recycled address from stealing a session
  // that has already been claimed by somebody else.
  const { data: claimed, error: claimError } = await supabase
    .from('clinical_sessions')
    .update({ user_id: userId })
    .in('id', sessionIds)
    .is('user_id', null)
    .select('id');

  if (claimError) {
    console.error('[claim-trial] session claim failed', { userId, error: claimError });
    return 0;
  }

  return claimed?.length ?? 0;
}

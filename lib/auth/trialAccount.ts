import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claimTrialSessionsForUser } from '@/lib/auth/claimTrialSessions';
import { authLinkOrigin, mintRecoveryTokenHash, provisionAccountForPurchase } from '@/lib/auth/provisioning';
import { trialSignInUrl } from '@/lib/auth/trialLink';
import { grantTrial, loadTrialAccess, type TrialSource, type TrialState } from '@/lib/commerce/trialAccess';

/**
 * The four things that turn a verified address into a trialist, in the one
 * order that is safe, shared by every door.
 *
 *   1. ACCOUNT  — `provisionAccountForPurchase`, which is idempotent and
 *                 confirms the email, so nobody is asked to confirm an address
 *                 they have just typed a code from.
 *   2. CLAIM    — any guest consultation that address already sat becomes
 *                 theirs. Before the grant, so the dashboard they land on has
 *                 their own work on it.
 *   3. GRANT    — the five stations, idempotent on `user_id`.
 *   4. SIGN-IN  — a one-time URL, minted last because it is the only step that
 *                 is allowed to fail without failing the request.
 *
 * WHY THE ORDER. Steps 1–3 are each idempotent, so a caller that retries
 * repeats them harmlessly. Step 4 is not — minting a recovery token
 * INVALIDATES the previous one — so it goes last, where a retry that got
 * further than the mint cannot silently rotate a link somebody is holding.
 *
 * NOTHING HERE THROWS. Every door calling this has already verified a code, and
 * an infrastructure hiccup after that point must not read to the person as
 * "your code was wrong". The result says how far it got and the caller renders
 * the truth: an account with no sign-in URL still gets a "sign in from the
 * email we just sent you" path, and a claim that failed is a session that is
 * still there to be claimed by the dashboard's own claim-once.
 */

export interface EnsureTrialAccountInput {
  email: string;
  /** Goes on the auth user's `full_name`, so the dashboard can greet them. */
  firstName?: string | null;
  /** Which door. Decides `trial_grants.source` and, through it, the analytics door. */
  source: TrialSource;
  /**
   * Mint the one-time sign-in URL. False for callers that are about to
   * establish the session themselves (see app/api/auth/start), which would
   * otherwise rotate the token out from under their own verifyOtp.
   */
  mintSignIn?: boolean;
}

export interface EnsuredTrialAccount {
  /** Null only when provisioning genuinely failed; the caller treats it as "skip". */
  userId: string | null;
  /** We created the auth user on this call. False for a returning address. */
  created: boolean;
  /** One-time URL that leaves the browser signed in on /dashboard, or null. */
  signInUrl: string | null;
  /** A grant is now in the table for this account — new or pre-existing. */
  granted: boolean;
  /** Where the grant stands, so the caller can say "five left" without a second read. */
  state: TrialState;
  /** How many guest consultations were attached to the account by this call. */
  claimed: number;
}

const NOT_PROVISIONED: EnsuredTrialAccount = {
  userId: null,
  created: false,
  signInUrl: null,
  granted: false,
  state: 'none',
  claimed: 0,
};

export async function ensureTrialAccount(
  admin: SupabaseClient,
  input: EnsureTrialAccountInput,
): Promise<EnsuredTrialAccount> {
  const email = input.email.trim().toLowerCase();
  if (!email) return NOT_PROVISIONED;

  // `alreadyExisted` is reported as an error by provisioning — it has to be,
  // for the purchase path's stranded-buyer accounting — but here it is the
  // ordinary case: a lead who already has an account is exactly who door (c)
  // is for. Only a MISSING user id means we could not go on.
  const provisioned = await provisionAccountForPurchase({
    email,
    fullName: input.firstName?.trim() || null,
  });
  const userId = provisioned.userId;
  if (!userId) {
    console.error('[trial-account] no account for a verified address', {
      email,
      error: provisioned.error,
    });
    return NOT_PROVISIONED;
  }

  const claimed = await claimTrialSessionsForUser(admin, userId, email);
  const grant = await grantTrial(admin, { userId, email, source: input.source });

  // Read back rather than infer: a returning trialist may already have spent
  // their five, and the caller's copy ("five stations, five days") would be a
  // lie if this said 'trial' for them.
  const access = grant ? await loadTrialAccess(admin, userId) : null;

  let signInUrl: string | null = null;
  if (input.mintSignIn !== false) {
    const { tokenHash, error } = await mintRecoveryTokenHash({ email });
    if (tokenHash) {
      signInUrl = trialSignInUrl(authLinkOrigin(), tokenHash, email);
    } else {
      // Never fatal. The person is verified, has an account and has the grant;
      // they can sign in from any of the emails that carry a link. The one
      // thing that must not happen is the whole request 500ing over it.
      console.error('[trial-account] sign-in link mint failed', { error });
    }
  }

  return {
    userId,
    created: provisioned.created,
    signInUrl,
    granted: grant !== null,
    state: access?.state ?? 'none',
    claimed,
  };
}

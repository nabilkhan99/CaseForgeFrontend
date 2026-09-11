import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claimTrialSessionsForUser } from '@/lib/auth/claimTrialSessions';
import { provisionAccountWithPassword } from '@/lib/auth/accountSignUp';
import { authLinkOrigin, mintRecoveryTokenHash, provisionAccountForPurchase } from '@/lib/auth/provisioning';
import { trialSignInUrl } from '@/lib/auth/trialLink';
import {
  grantTrial,
  loadTrialAccess,
  startTrialWindow,
  type TrialSource,
  type TrialState,
} from '@/lib/commerce/trialAccess';

/**
 * The four things that turn a verified address into a trialist, in the one
 * order that is safe, shared by every door.
 *
 *   1. ACCOUNT  — idempotent, and confirms the email either way, so nobody is
 *                 asked to confirm an address they have just typed a code from.
 *                 With a `password` it is `provisionAccountWithPassword` (the
 *                 account-first form, which has already asked for one); without,
 *                 `provisionAccountForPurchase` (the guest reveal and the
 *                 signed link, which have not).
 *   2. CLAIM    — any guest consultation that address already sat becomes
 *                 theirs, plus `claimSessionId` when the caller can name one the
 *                 leads table cannot. Before the grant, so the dashboard they
 *                 land on has their own work on it.
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
  /**
   * The password the trainee chose on the account-first form.
   *
   * Its presence switches step 1 from the purchase provisioner to
   * {@link provisionAccountWithPassword}: the account is born WITH a password
   * and without the `password_pending` stamp, so nobody is sent to
   * /auth/set-password moments after choosing one. Absent for the guest reveal
   * and the signed link, which have no form to have asked on.
   *
   * ⚠️ Never overwrites a password that already exists — see accountSignUp.
   */
  password?: string | null;
  /** Mobile, E.164 where we could parse it. Stored on the auth user as metadata. */
  phone?: string | null;
  /**
   * Start the five days HERE, from this instant, instead of leaving the clock
   * for the first consultation to start.
   *
   * Exactly one door needs it: the guest who has ALREADY sat their first
   * consultation and is making the account afterwards. Their five days must run
   * from the consultation they just did — `clinical_sessions.started_at` — or a
   * window that is meant to cover the work would begin after most of a session
   * of it was over, and (worse) the chokepoints that normally stamp it would
   * start it again from whenever they next opened a station.
   *
   * Absent everywhere else, and deliberately so: the account-first form has no
   * consultation behind it, and a clock started at sign-up would spend days a
   * trainee has not used. {@link startTrialWindow} is a compare-and-set, so a
   * grant that already has a `started_at` is left exactly as it is.
   */
  windowStartsAt?: Date | null;
  /**
   * One more consultation to attach, named directly rather than found through a
   * lead row.
   *
   * The claim normally follows `trial_leads.session_id`, which is the only
   * evidence that links an anonymous consultation to an address. A returning
   * trainee has no such link for their SECOND guest consultation: `send-code`
   * deliberately leaves a verified lead pointing at the session it was verified
   * for, because re-pointing it would disown the first one. So the new session
   * is passed here instead, and only when the signed `ff_guest` cookie proved it
   * belongs to this browser (contract C3).
   *
   * Still subject to `user_id is null` — see lib/auth/claimTrialSessions.
   */
  claimSessionId?: string | null;
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
  const fullName = input.firstName?.trim() || null;
  const password = input.password?.trim() || '';
  const provisioned = password
    ? await provisionAccountWithPassword({
        email,
        password,
        fullName,
        phone: input.phone ?? null,
      })
    : await provisionAccountForPurchase({ email, fullName });
  const userId = provisioned.userId;
  if (!userId) {
    console.error('[trial-account] no account for a verified address', {
      email,
      error: provisioned.error,
    });
    return NOT_PROVISIONED;
  }

  const claimed = await claimTrialSessionsForUser(admin, userId, email, input.claimSessionId ?? null);
  const grant = await grantTrial(admin, { userId, email, source: input.source });

  // Between the grant and the read-back, because the read-back is what the
  // caller's copy is written from and a window stamped after it would be a
  // countdown nobody was told about. Never throws, and a grant that already
  // carries a `started_at` is untouched.
  if (grant && input.windowStartsAt) await startTrialWindow(admin, grant, input.windowStartsAt);

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

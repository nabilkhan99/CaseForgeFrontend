import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { sendSetPasswordEmail } from '@/lib/email/accountEmail';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import { SITE_URL } from '@/lib/seo/site';

/**
 * Purchase → account provisioning (self-service from 1 Sept 2026).
 *
 * Called from the Stripe webhook for a paid order: creates the auth user under
 * the buying email (buying email = account email, by product decision).
 *
 * This module owns the ACCOUNT only. Minting the setup link and sending the
 * mail that carries it belong to lib/auth/provisionBuyer, which does both
 * behind its compare-and-swap on `set_password_sent_at` — so exactly one of two
 * concurrent Stripe deliveries can mint a link, and a link is never minted
 * (invalidating the previous one) by a delivery that will not go on to send it.
 *
 * Idempotent: an existing user is left untouched. Every outcome that leaves a
 * buyer without an account returns an `error`, so the webhook logs it rather
 * than stranding them silently.
 *
 * Emailed links always point at {@link SITE_URL}, never the webhook request's
 * own origin: a Stripe endpoint pointed at a preview or apex host would
 * otherwise email buyers a set-password link on a host they can't sign in from.
 */

export interface ProvisionResult {
  /** We created the auth user on this call. */
  created: boolean;
  /**
   * The auth user was already there, so nothing was created and nothing sent —
   * but the buyer is NOT stranded and owes no email.
   *
   * Distinct from `created` because the caller stamps on it: without a flag to
   * hang that on, a repeat buyer left both stamps NULL forever, every Stripe
   * retry for three days re-attempted `createUser`, and no ops query could tell
   * "already had an account" from "Brevo ate their link".
   */
  alreadyExisted: boolean;
  /**
   * The auth user this purchase now belongs to, on both the created and the
   * already-existed path — so the caller can attach anything the buyer did
   * BEFORE they had an account (their guest free mock; see
   * {@link ../auth/claimTrialSessions}).
   *
   * Null only when we genuinely don't know: a create that failed for a real
   * reason, or an existing account with no `profiles` row to look the id up
   * from. Callers must treat null as "skip", never as an error.
   */
  userId: string | null;
  error?: string;
}

function getAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function setPasswordUrl(origin: string, tokenHash: string, email: string): string {
  const url = new URL('/auth/set-password', origin);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('email', email);
  return url.toString();
}

/**
 * Mint a fresh, single-use recovery link for an existing auth user.
 *
 * Split out from {@link sendSetPasswordLink} so the link can be carried by an
 * email this module does not own. The Stripe webhook now sends ONE mail on a
 * purchase — the receipt, with the setup link as its button — and it needs the
 * URL, not a send.
 *
 * The token is a recovery `token_hash`, which /auth/set-password verifies
 * client-side via verifyOtp. Deliberately not `generateLink().action_link`,
 * whose implicit flow does not survive this app's PKCE browser client, and
 * deliberately not the browser client's `resetPasswordForEmail`, whose PKCE
 * `code_verifier` lives in the requesting browser and so breaks the
 * laptop-requests / phone-opens case.
 *
 * ⚠️ EXPIRY. Minting a new link INVALIDATES the previous one for that user, and
 * the lifetime is GoTrue's `MAILER_OTP_EXP`, which Supabase caps at 24 hours —
 * not the 7 days the receipt spec asks for. Nothing here can extend it: a
 * longer window needs a bespoke token table, which is not a thing to build on
 * the eve of launch. The emails therefore state 24 hours, and the self-serve
 * resend at /api/auth/resend-set-password is the recovery path.
 */
export async function mintSetPasswordLink(args: {
  email: string;
}): Promise<{ url: string | null; error?: string }> {
  const supabase = getAdminAuthClient();
  const email = args.email.toLowerCase().trim();

  // Wrapped, not just error-checked. GoTrue reports most failures in `error`,
  // but a transport-level fault rejects — and this runs while the caller holds
  // the send claim, so an escaping throw would leave `set_password_sent_at`
  // written for a mail that never went and no retry would ever revisit the
  // buyer. Always resolve; never throw.
  try {
    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
    });
    if (linkError || !link?.properties?.hashed_token) {
      return { url: null, error: linkError?.message ?? 'no token in link' };
    }
    return { url: setPasswordUrl(SITE_URL, link.properties.hashed_token, email) };
  } catch (error: unknown) {
    console.error('[provisioning] generateLink threw', { error });
    return { url: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Mint a link and email the house set-password mail.
 *
 * This is now the SELF-SERVICE path only — /api/auth/resend-set-password, for a
 * buyer whose link expired. The purchase path no longer calls it: a buyer who
 * has just paid gets the receipt email carrying the same link instead, so they
 * receive one mail rather than two. Kept intact, and still exported, because
 * the resend route is the spec's answer to an expired link and must keep
 * working exactly as it does today.
 */
export async function sendSetPasswordLink(args: {
  email: string;
  fullName?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const email = args.email.toLowerCase().trim();

  const { url, error } = await mintSetPasswordLink({ email });
  if (!url) return { sent: false, error };

  const sent = await sendSetPasswordEmail({
    toEmail: email,
    toName: args.fullName,
    setPasswordUrl: url,
  });
  return sent.sent ? { sent: true } : { sent: false, error: sent.skipped };
}

/**
 * The auth user id behind an address, for the account that already existed.
 *
 * `admin.createUser` hands back the new user on the create path, but says
 * nothing useful when the account is already there, and the GoTrue admin API
 * has no "get user by email". `public.profiles` is the map: a trigger on
 * `auth.users` inserts one row per account carrying `id` and `email`, so it is
 * complete by construction. Case-insensitive for the same reason every other
 * email match in this codebase is.
 *
 * Best-effort. A miss returns null and the caller skips whatever it wanted the
 * id for — this is a nice-to-have on top of provisioning, never a reason to
 * fail a purchase.
 */
async function findUserIdByEmail(
  supabase: ReturnType<typeof getAdminAuthClient>,
  email: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', exactEmailPattern(email))
    .maybeSingle();

  if (error) {
    console.error('[provisioning] profile lookup failed', { error });
    return null;
  }
  return (data as { id?: string } | null)?.id ?? null;
}

export async function provisionAccountForPurchase(args: {
  email: string;
  fullName?: string | null;
}): Promise<ProvisionResult> {
  const supabase = getAdminAuthClient();
  const email = args.email.toLowerCase().trim();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: args.fullName ? { full_name: args.fullName } : undefined,
  });

  if (createError) {
    const alreadyExists =
      createError.code === 'email_exists' || /already/i.test(createError.message);
    if (alreadyExists) {
      // An existing account keeps its password, so it is owed no setup link.
      // It IS owed a receipt — see provisionBuyer, which sends one either way.
      //
      // Still reported as an error, because the caller has recorded no send for
      // this buyer and a silent skip is exactly how the stranded-buyer case
      // stayed invisible.
      return {
        created: false,
        alreadyExisted: true,
        userId: await findUserIdByEmail(supabase, email),
        error: 'account_already_exists',
      };
    }
    return {
      created: false,
      alreadyExisted: false,
      userId: null,
      error: createError.message,
    };
  }

  return {
    created: true,
    alreadyExisted: false,
    userId: created?.user?.id ?? null,
  };
}

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { sendSetPasswordEmail } from '@/lib/email/accountEmail';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import { SITE_URL } from '@/lib/seo/site';

/**
 * Purchase → account provisioning (self-service from 1 Sept 2026).
 *
 * Called from the Stripe webhook for a paid order that has not yet been sent a
 * set-password email (`preorders.set_password_sent_at is null`): creates the
 * auth user under the buying email (buying email = account email, by product
 * decision) and sends a set-password email. The link carries a recovery
 * `token_hash`, which /auth/set-password verifies client-side via verifyOtp —
 * deliberately not `generateLink().action_link`, whose implicit flow does not
 * survive this app's PKCE browser client.
 *
 * Idempotent: an existing user is left untouched and no email is sent, so
 * Stripe retries and repeat purchases never spam the buyer. Every outcome that
 * leaves a buyer without an email returns an `error`, so the webhook logs it
 * rather than stranding them silently.
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
  emailSent: boolean;
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
 * Mint a fresh recovery token for an existing auth user and email the house
 * set-password link. Shared by provisioning and the self-service resend route
 * (/api/auth/resend-set-password) so both hand out the same device-independent
 * `token_hash` link — a PKCE `code` link only works in the browser that asked
 * for it, which breaks the laptop-requests / phone-opens case.
 */
export async function sendSetPasswordLink(args: {
  email: string;
  fullName?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const supabase = getAdminAuthClient();
  const email = args.email.toLowerCase().trim();

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  if (linkError || !link?.properties?.hashed_token) {
    return { sent: false, error: linkError?.message ?? 'no token in link' };
  }

  const sent = await sendSetPasswordEmail({
    toEmail: email,
    toName: args.fullName,
    setPasswordUrl: setPasswordUrl(SITE_URL, link.properties.hashed_token, email),
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
  /**
   * Send the set-password link once the account exists. False before the
   * access window opens: the account is created so launch day is nothing but
   * an email, but the buyer is told to practise only when they actually can.
   */
  sendLink?: boolean;
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
      // An existing account keeps its password, so we deliberately send nothing.
      // Still an error: the caller has recorded no send for this buyer, and a
      // silent skip is exactly how the stranded-buyer case stayed invisible.
      return {
        created: false,
        alreadyExisted: true,
        emailSent: false,
        userId: await findUserIdByEmail(supabase, email),
        error: 'account_already_exists',
      };
    }
    return {
      created: false,
      alreadyExisted: false,
      emailSent: false,
      userId: null,
      error: createError.message,
    };
  }

  if (args.sendLink === false) {
    // Not an error: nothing was owed yet. The caller stamps `provisioned_at`
    // and leaves `set_password_sent_at` null, which is what marks this buyer
    // as still owed a link when the window opens.
    return {
      created: true,
      alreadyExisted: false,
      emailSent: false,
      userId: created?.user?.id ?? null,
    };
  }

  const result = await sendSetPasswordLink({ email, fullName: args.fullName });
  return {
    created: true,
    alreadyExisted: false,
    emailSent: result.sent,
    userId: created?.user?.id ?? null,
    error: result.error,
  };
}

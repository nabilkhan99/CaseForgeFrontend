import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { sendSetPasswordEmail } from '@/lib/email/accountEmail';
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
  created: boolean;
  emailSent: boolean;
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

export async function provisionAccountForPurchase(args: {
  email: string;
  fullName?: string | null;
}): Promise<ProvisionResult> {
  const supabase = getAdminAuthClient();
  const email = args.email.toLowerCase().trim();

  const { error: createError } = await supabase.auth.admin.createUser({
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
      return { created: false, emailSent: false, error: 'account_already_exists' };
    }
    return { created: false, emailSent: false, error: createError.message };
  }

  const result = await sendSetPasswordLink({ email, fullName: args.fullName });
  return { created: true, emailSent: result.sent, error: result.error };
}

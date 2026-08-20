import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { sendSetPasswordEmail } from '@/lib/email/accountEmail';

/**
 * Purchase → account provisioning (self-service from 1 Sept 2026).
 *
 * Called from the Stripe webhook once a NEW paid order is recorded: creates
 * the auth user under the buying email (buying email = account email, by
 * product decision) and sends a set-password email. The link carries a
 * recovery `token_hash`, which /auth/set-password verifies client-side via
 * verifyOtp — deliberately not `generateLink().action_link`, whose implicit
 * flow does not survive this app's PKCE browser client.
 *
 * Idempotent: an existing user is left untouched and no email is sent, so
 * Stripe retries and repeat purchases never spam the buyer.
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

export async function provisionAccountForPurchase(args: {
  email: string;
  fullName?: string | null;
  origin: string;
}): Promise<ProvisionResult> {
  const supabase = getAdminAuthClient();
  const email = args.email.toLowerCase();

  const { error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: args.fullName ? { full_name: args.fullName } : undefined,
  });

  if (createError) {
    // An existing account keeps its password; nothing to send.
    const alreadyExists =
      createError.code === 'email_exists' || /already/i.test(createError.message);
    if (alreadyExists) return { created: false, emailSent: false };
    return { created: false, emailSent: false, error: createError.message };
  }

  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  if (linkError || !link?.properties?.hashed_token) {
    return { created: true, emailSent: false, error: linkError?.message ?? 'no token in link' };
  }

  const sent = await sendSetPasswordEmail({
    toEmail: email,
    toName: args.fullName,
    setPasswordUrl: setPasswordUrl(args.origin, link.properties.hashed_token, email),
  });
  return { created: true, emailSent: sent.sent, error: sent.sent ? undefined : sent.skipped };
}

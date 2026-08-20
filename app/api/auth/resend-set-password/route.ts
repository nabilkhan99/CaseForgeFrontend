import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSetPasswordLink } from '@/lib/auth/provisioning';

/**
 * "Email me a fresh link" for a buyer whose set-password link has expired.
 *
 * Server-side on purpose. The browser client's `resetPasswordForEmail` mints a
 * PKCE link whose `code_verifier` lives in the requesting browser, so a link
 * requested on a laptop and opened on a phone fails with "code verifier should
 * be non-empty" — an infinite loop of dead links. This route re-sends exactly
 * what provisioning sends: an admin-generated recovery `token_hash` that works
 * in any browser.
 *
 * Only addresses with a paid purchase are served (checked with the service
 * role), but the response never says so: the same generic body comes back
 * whether or not the address exists, so this can't be used to enumerate
 * customers. Genuine failures still return 500 so the UI can say something
 * truthful instead of a silent "check your inbox".
 */

const GENERIC_OK = {
  ok: true,
  message: "If that address has a purchase with us, an email is on its way.",
};

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  let email: string;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: purchase, error: lookupError } = await supabase
    .from('preorders')
    .select('id, full_name')
    .eq('email', email)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error('[resend-set-password] purchase lookup failed', { error: lookupError });
    return NextResponse.json({ error: 'Could not send the email. Please try again.' }, { status: 500 });
  }

  // No purchase: answer exactly as if there were one. Nothing is sent.
  if (!purchase) return NextResponse.json(GENERIC_OK);

  const result = await sendSetPasswordLink({ email, fullName: purchase.full_name });
  if (!result.sent) {
    console.error('[resend-set-password] send failed', { error: result.error });
    return NextResponse.json({ error: 'Could not send the email. Please try again.' }, { status: 500 });
  }

  return NextResponse.json(GENERIC_OK);
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Has this trial session already had its email verified?
 *
 * The feedback page used to answer this from localStorage alone, which made
 * "verified" mean "this browser did it" rather than "this person did it":
 * switch device, clear storage, or open the link on a phone and the whole
 * questionnaire was demanded again for a session that was already verified.
 * The server holds the real answer, so the page asks here instead.
 *
 * Only a boolean is returned. Guest trial sessions are already reachable by
 * anyone holding the session id, and the localStorage flag it replaces was
 * trivially forgeable, so this is strictly stronger than what it replaces.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')?.trim();
  if (!sessionId) {
    return NextResponse.json({ verified: false }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('trial_leads')
      .select('email_verified_at, phone, phone_verified_at, phone_verification_skipped_at')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('[gate-status] lookup failed', error);
      // Fail closed: show the gate rather than opening the report on an error.
      return NextResponse.json({ verified: false }, { status: 200 });
    }

    // Verified = email confirmed AND the phone step is settled: verified,
    // skipped (SMS couldn't be sent — fail open), or absent entirely
    // (legacy leads captured before the phone field existed).
    const phoneSettled =
      !data?.phone || Boolean(data?.phone_verified_at) || Boolean(data?.phone_verification_skipped_at);
    return NextResponse.json({
      verified: Boolean(data?.email_verified_at) && phoneSettled,
    });
  } catch (error: unknown) {
    console.error('[gate-status] unexpected error', error);
    return NextResponse.json({ verified: false }, { status: 200 });
  }
}

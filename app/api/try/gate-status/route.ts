import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { candidateRun } from '@/lib/clinical-master/candidateRun';
import { toVerdictSummary } from '@/lib/trial/verdictSummary';

/**
 * Has this trial session already had its email verified — and, if it has been
 * marked, what does the verdict say?
 *
 * The feedback page used to answer the first question from localStorage alone,
 * which made "verified" mean "this browser did it" rather than "this person did
 * it": switch device, clear storage, or open the link on a phone and the whole
 * questionnaire was demanded again for a session that was already verified. The
 * server holds the real answer, so the page asks here instead.
 *
 * The second question is new. Roughly a quarter of people who finish the free
 * consultation abandon at the gate having seen nothing of their own result, so
 * the verdict, the score and the one-line summary are now shown above it.
 *
 * ## The boundary
 *
 * Two rules keep that from widening into "any session's report by id":
 *
 * 1. **Only the summary.** `toVerdictSummary` is an allowlist of four fields.
 *    Domains, evidence, focus areas and the "one change" never leave this
 *    route, verified or not — they are what the email is being asked for.
 * 2. **Only trial sessions.** A guest session (`user_id is null`) or one that
 *    carries a `trial_leads` row. This is exactly the boundary generate-feedback
 *    already applies, and it is what stops a paying user's verdict being
 *    readable by anyone who can guess a session id. Guest sessions themselves
 *    remain open to whoever holds the id — unchanged, and the reason the reveal
 *    can work before there is an account to authenticate against.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')?.trim();
  if (!sessionId) {
    return NextResponse.json({ verified: false }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const [{ data: lead, error }, { data: session }] = await Promise.all([
      supabase
        .from('trial_leads')
        .select('email_verified_at, phone, phone_verified_at, phone_verification_skipped_at')
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('clinical_sessions')
        .select('user_id, status, transcript')
        .eq('id', sessionId)
        .maybeSingle(),
    ]);

    if (error) {
      console.error('[gate-status] lookup failed', error);
      // Fail closed: show the gate rather than opening the report on an error.
      return NextResponse.json({ verified: false }, { status: 200 });
    }

    // Verified = email confirmed AND the phone step is settled: verified,
    // skipped (SMS couldn't be sent — fail open), or absent entirely
    // (legacy leads captured before the phone field existed).
    const phoneSettled =
      !lead?.phone || Boolean(lead?.phone_verified_at) || Boolean(lead?.phone_verification_skipped_at);
    const verified = Boolean(lead?.email_verified_at) && phoneSettled;

    // Rule 2. A session that is neither a guest run nor attached to a lead is
    // somebody's private consultation, and this route says nothing about it.
    const isTrialSession = Boolean(session) && (session?.user_id === null || Boolean(lead));
    if (!isTrialSession) {
      return NextResponse.json({ verified });
    }

    // The Azure guard refused this run as too short to grade. No result is ever
    // coming, so the page shows the short-run state instead of polling on.
    if (session?.status === 'unmarkable') {
      return NextResponse.json({
        verified,
        status: 'unmarkable',
        candidateSeconds: candidateRun(session.transcript).seconds,
        summary: null,
      });
    }

    // select('*') + the allowlist below: the generated types still describe the
    // legacy columns, and naming columns here would be a second, silently
    // divergent copy of what may cross the gate.
    const { data: result } = await supabase
      .from('session_results')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    const summary = toVerdictSummary(result);

    return NextResponse.json({
      verified,
      status: summary ? 'ready' : (session?.status ?? 'processing'),
      summary,
    });
  } catch (error: unknown) {
    console.error('[gate-status] unexpected error', error);
    return NextResponse.json({ verified: false }, { status: 200 });
  }
}

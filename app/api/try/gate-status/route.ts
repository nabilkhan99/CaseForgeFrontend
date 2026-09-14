import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { candidateRun } from '@/lib/clinical-master/candidateRun';
import { toVerdictSummary } from '@/lib/trial/verdictSummary';
import { isUnfinishedRun } from '@/lib/trial/unfinishedRun';
import { GUEST_COOKIE, cookieOwnsSession, readGuestCookie } from '@/lib/trial/guestSession';

/** PostgREST returns an embedded one-to-one as an object or a one-element array. */
function stationDuration(embedded: unknown): unknown {
  const station = Array.isArray(embedded) ? embedded[0] : embedded;
  return (station as { consultation_duration_seconds?: unknown } | null | undefined)
    ?.consultation_duration_seconds;
}

/**
 * Has this trial session's lead verified its email, and, for the person whose
 * consultation it is, where has the mark got to?
 *
 * ## The minimal answer: `{ verified }`
 *
 * Main's shape, and all that anybody holding only a session id gets. Whether a
 * lead has verified is what decides between the report and the email gate on
 * an old report link, and it says nothing about the consultation itself.
 *
 * ## The detailed answer: status, verdict, score, summary
 *
 * Only for a request that proves the consultation is its own:
 *
 * 1. the signed `ff_guest` cookie carries this session id (the browser that ran
 *    it, which is the only caller of the sign-up while marking page), or
 * 2. the signed-in user owns the session.
 *
 * A session id is a UUID in a URL. Links get forwarded, sit in founders' alert
 * emails and are opened on shared machines, so a verdict and a score must not
 * be readable by whoever happens to hold one. This used to answer anyone.
 *
 * Within the detailed answer the old two rules still hold: `toVerdictSummary`
 * is an allowlist of four fields (domains, evidence and focus areas never leave
 * this route), and only trial sessions answer at all (a guest session, or one
 * with a `trial_leads` row).
 *
 * Verified means the email is verified. Main also waited for an SMS step to
 * settle; nothing texts anybody any more, so a stored but unconfirmed mobile no
 * longer holds a verified lead at the gate.
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
        .select('email_verified_at')
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('clinical_sessions')
        .select('user_id, status, transcript, started_at, stations (consultation_duration_seconds)')
        .eq('id', sessionId)
        .maybeSingle(),
    ]);

    if (error) {
      console.error('[gate-status] lookup failed', error);
      // Fail closed: show the gate rather than opening the report on an error.
      return NextResponse.json({ verified: false }, { status: 200 });
    }

    const verified = Boolean(lead?.email_verified_at);

    // A session that is neither a guest run nor attached to a lead is
    // somebody's private consultation, and this route says nothing about it.
    const isTrialSession = Boolean(session) && (session?.user_id === null || Boolean(lead));
    if (!isTrialSession) {
      return NextResponse.json({ verified });
    }

    if (!(await requestOwnsSession(req, sessionId, session?.user_id ?? null))) {
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

    // Nobody ended this consultation, so nothing ever saved a transcript and
    // nothing ever asked for a mark. Asked AFTER the result, so a mark that did
    // somehow land is still the answer; see lib/trial/unfinishedRun.
    const unfinished =
      !summary &&
      isUnfinishedRun({
        status: session?.status,
        startedAt: session?.started_at,
        durationSeconds: stationDuration(session?.stations),
        transcriptTurns: Array.isArray(session?.transcript) ? session.transcript.length : 0,
        nowMs: Date.now(),
      });

    return NextResponse.json({
      verified,
      status: summary ? 'ready' : unfinished ? 'unfinished' : (session?.status ?? 'processing'),
      summary,
    });
  } catch (error: unknown) {
    console.error('[gate-status] unexpected error', error);
    return NextResponse.json({ verified: false }, { status: 200 });
  }
}

/**
 * Does this request prove the consultation is its own? The signed guest cookie
 * for this session, or a signed-in user who owns it. Fails closed.
 */
async function requestOwnsSession(
  req: NextRequest,
  sessionId: string,
  ownerId: string | null,
): Promise<boolean> {
  if (cookieOwnsSession(readGuestCookie(req.cookies?.get(GUEST_COOKIE)?.value), sessionId)) {
    return true;
  }
  // An unowned session has no user to match, so there is no auth call to make.
  if (!ownerId) return false;
  try {
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    return user?.id === ownerId;
  } catch (error: unknown) {
    console.error('[gate-status] could not read the signed-in user', error);
    return false;
  }
}

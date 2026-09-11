import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { rejectIfSignedIn } from '@/lib/trial/guestOnly';
import { GUEST_IP_LIMIT_BODY, withinGuestOpenLimit } from '@/lib/trial/guestRateLimit';
import { freeStationId } from '@/lib/trial/guestStation';
import {
  GUEST_COOKIE,
  canOpenGuestSession,
  guestCookieOptions,
  guestResumeRefusal,
  logGuestRefusal,
  readGuestCookie,
  signGuestCookie,
  withGuestSession,
} from '@/lib/trial/guestSession';

/**
 * Opens a guest consultation from the read-the-brief path.
 *
 * `/try/talk` is the default door and does all of this itself; this route is
 * what `/try/station/[stationId]` calls when someone chooses to read the full
 * brief with its exam-style clock first. Both leave the same two things behind:
 * a `clinical_sessions` row nobody owns, and the signed guest cookie that
 * `/api/try/realtime-token` requires before it will spend an Azure minute.
 *
 * **The 409 is gone and stays gone.** "You have already used your free mock
 * station" read `trial_leads` to decide, and nothing looks there any more. The
 * offer is five cases over five days in a real account; an old anonymous mock
 * is history that does not count against it. It was honest-user enforcement in
 * any case — first runs were anonymous, so the only person it ever caught was
 * one who volunteered the same address twice.
 *
 * **The `is_free_trial` filter is back, deliberately** (contract C2). The
 * September version dropped it so a public case page could say "practise this
 * case free" about any of the 200 — which made an unauthenticated endpoint that
 * spends Azure realtime minutes reachable for the whole paid bank. A case page
 * outside the five says "Try 5 free cases" instead.
 *
 * A station outside the five is REFUSED here rather than quietly swapped for
 * one inside it. `/try/talk` substitutes, because it chooses the case itself
 * and nobody has been promised anything; this route has been handed an explicit
 * id by a page already showing that brief, so a silent swap would open a
 * session on a different station and the very next call — the mint, which
 * checks the row against the body — would refuse it as `guest_station_mismatch`.
 *
 * The cookie and the mint rules in lib/trial/guestSession.ts are the other half
 * of the control, not a replacement for this one.
 *
 * ⚠️ **The idempotent branch is not a cookie oracle.** It used to re-sign the
 * cookie for ANY unowned session id in the body, which made this route a way to
 * mint the very proof the rest of the lane rests on: POST a session id you do
 * not hold, get back a signed cookie carrying it, and rule 2 of the mint (and
 * contract C3's password proof) are both satisfied for somebody else's
 * consultation. A resume now re-signs only what the caller's cookie ALREADY
 * holds, and only while the row is still startable and inside its half hour —
 * `guestResumeRefusal`. A browser that genuinely lost its cookie starts a new
 * consultation, which is one click and costs it nothing.
 */
export async function POST(req: NextRequest) {
  // Guests only. A signed-in caller would otherwise create a consultation
  // owned by nobody, outside their own entitlement and invisible from their
  // dashboard.
  const signedIn = await rejectIfSignedIn();
  if (signedIn) return signedIn;

  // Shares its budget with /try/talk: two doors onto the same act, and a limit
  // either could dodge by using the other is not a limit.
  if (!withinGuestOpenLimit(req)) {
    console.warn('[try/create-session] guest per-IP open limit reached');
    return NextResponse.json(GUEST_IP_LIMIT_BODY, { status: 429 });
  }

  const { sessionId, stationId } = await req.json();

  if (!sessionId || !stationId) {
    return NextResponse.json({ error: 'sessionId and stationId are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const cookie = readGuestCookie(req.cookies.get(GUEST_COOKIE)?.value);

  // C2: free AND active. Deliberately `is_active` and not
  // `visibleStationStates()` — the guest funnel shows the live bank only, so a
  // staged station cannot be started anonymously on a preview deployment.
  const station = await freeStationId(supabase, stationId);

  if (!station) {
    return NextResponse.json({ error: 'This case is not available' }, { status: 400 });
  }

  // Idempotent: the station page can be re-submitted, and `/try/talk` hands its
  // own session id to that page when someone opens the full brief mid-flow.
  // `status` and `started_at` come back because the resume rules read them.
  const { data: existing } = await supabase
    .from('clinical_sessions')
    .select('id, user_id, status, started_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (existing) {
    if (existing.user_id) {
      return NextResponse.json({ error: 'This consultation belongs to an account' }, { status: 403 });
    }
    // Rules 2, 7 and 8. Knowing the id is not the same as having been given it,
    // so the cookie has to carry this session already for the re-sign to happen
    // at all — see the oracle note at the top of this file.
    const refusal = guestResumeRefusal({ cookie, sessionId, session: existing, nowMs: Date.now() });
    if (refusal) {
      logGuestRefusal('try/create-session', sessionId, refusal);
      return NextResponse.json({ error: refusal.error, code: refusal.code }, { status: refusal.status });
    }
    const resigned = signGuestCookie(withGuestSession(cookie, sessionId, nowSeconds));
    if (!resigned) return unsignable();
    return withCookie(NextResponse.json({ status: 'exists', sessionId }), resigned);
  }

  // Three guest consultations per browser per day — the creation-time half of
  // the rule the mint enforces again. See lib/trial/guestSession.ts.
  if (!canOpenGuestSession(cookie, nowSeconds)) {
    console.warn('[try/create-session] guest daily limit reached');
    return NextResponse.json(
      { error: 'That is three consultations today. Make an account for five cases over five days.', code: 'guest_daily_limit' },
      { status: 429 },
    );
  }

  // Signed BEFORE the row is written, and the write abandoned if it cannot be.
  // A session whose cookie never got signed is a row that can never mint — the
  // trainee grants their microphone and the call silently never connects — so
  // this fails here instead, the same way `/try/talk` does.
  const signed = signGuestCookie(withGuestSession(cookie, sessionId, nowSeconds));
  if (!signed) return unsignable();

  const { error } = await supabase
    .from('clinical_sessions')
    .insert({
      id: sessionId,
      user_id: null,
      // The id the lookup returned, not the one the body carried: they are the
      // same string, but only one of them has been checked.
      station_id: station,
      status: 'reading',
      started_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return withCookie(NextResponse.json({ status: 'created', sessionId }), signed);
}

function withCookie(response: NextResponse, signed: string): NextResponse {
  response.cookies.set(GUEST_COOKIE, signed, guestCookieOptions());
  return response;
}

/** No `TRIAL_GUEST_COOKIE_SECRET` and no service-role key: nothing can be opened. */
function unsignable(): NextResponse {
  console.error('[try/create-session] no signing secret — refusing to open a consultation');
  return NextResponse.json(
    {
      error: 'Free consultations are unavailable right now. Please try again shortly.',
      code: 'guest_cookie_unsignable',
    },
    { status: 503 },
  );
}

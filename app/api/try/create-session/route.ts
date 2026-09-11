import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { rejectIfSignedIn } from '@/lib/trial/guestOnly';
import { freeStationId } from '@/lib/trial/guestStation';
import {
  GUEST_COOKIE,
  canOpenGuestSession,
  guestCookieOptions,
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
 */
export async function POST(req: NextRequest) {
  // Guests only. A signed-in caller would otherwise create a consultation
  // owned by nobody, outside their own entitlement and invisible from their
  // dashboard.
  const signedIn = await rejectIfSignedIn();
  if (signedIn) return signedIn;

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
  const { data: existing } = await supabase
    .from('clinical_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (existing) {
    if (existing.user_id) {
      return NextResponse.json({ error: 'This consultation belongs to an account' }, { status: 403 });
    }
    // Re-sign rather than skip: a browser that already holds this session keeps
    // its cookie, and one that lost it (a reload on a fresh cookie jar) gets it
    // back for a session it demonstrably knows the id of.
    return withCookie(NextResponse.json({ status: 'exists', sessionId }), cookie, sessionId, nowSeconds);
  }

  // Three guest consultations per browser per day — the creation-time half of
  // the rule the mint enforces again. See lib/trial/guestSession.ts.
  if (!canOpenGuestSession(cookie, nowSeconds)) {
    console.warn('[try/create-session] guest daily limit reached');
    return NextResponse.json(
      { error: 'That is three consultations today. Make an account for five stations over five days.', code: 'guest_daily_limit' },
      { status: 429 },
    );
  }

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

  return withCookie(NextResponse.json({ status: 'created', sessionId }), cookie, sessionId, nowSeconds);
}

function withCookie(
  response: NextResponse,
  cookie: ReturnType<typeof readGuestCookie>,
  sessionId: string,
  nowSeconds: number,
): NextResponse {
  const signed = signGuestCookie(withGuestSession(cookie, sessionId, nowSeconds));
  if (signed) response.cookies.set(GUEST_COOKIE, signed, guestCookieOptions());
  return response;
}

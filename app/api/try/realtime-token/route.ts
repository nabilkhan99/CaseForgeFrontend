import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { mintEphemeralKey, unreliableEchoCancellation } from '@/lib/clinical-master/realtimeToken';
import { voiceForStation } from '@/lib/clinical-master/realtimeSession';
import { rejectIfSignedIn } from '@/lib/trial/guestOnly';
import {
  GUEST_COOKIE,
  guestCookieOptions,
  guestMintRefusal,
  logGuestRefusal,
  readGuestCookie,
  signGuestCookie,
  withMint,
} from '@/lib/trial/guestSession';


/**
 * Vercel's default is 10s, and the mint is a network round-trip to Azure that
 * can hang rather than refuse. On 31 Aug 2026 the eastus2 realtime outage
 * produced 25 kills at exactly that wall between 07:30 and 09:37 UTC, and a
 * killed mint means the consultation never starts at all.
 *
 * This matters more now the standby-region fallback exists: a primary that
 * hangs burns most of the budget before the fallback is even attempted, so at
 * 10s the safety net could not reliably deploy. 20s gives it room. The Hobby
 * plan caps this at 60.
 */
export const maxDuration = 20;

/**
 * Mint an Azure gpt-realtime ephemeral key for a guest consultation.
 *
 * This is the only endpoint in the product that spends money with no
 * authentication — a guest has none by definition — so it is defended twice
 * over: by WHICH case may be run, and by WHO may run it.
 *
 * WHICH: one of the five flagged `is_free_trial`, and active (contract C2).
 * This filter was dropped in September, on the argument that the cookie rules
 * below were control enough; they are not, because they bound how OFTEN an
 * anonymous browser may spend and say nothing about how much each spend is
 * worth. Without it, editing a query string reaches all 200 paid stations.
 *
 * WHO: the signed guest cookie, and the nine rules in
 * lib/trial/guestSession.ts, which is where they are documented in full. In
 * short:
 *
 *   * the session id must have come out of `/try/talk` or `create-session`,
 *     proven by an httpOnly HMAC-signed cookie this browser cannot forge;
 *   * the row must exist, be unowned, be on the station asked for, be in
 *     `reading` or `live`, and be under 30 minutes old;
 *   * one mint per session per 2 minutes, three guest sessions per browser
 *     per day.
 *
 * Two consequences worth stating plainly. This route NO LONGER INSERTS a
 * `clinical_sessions` row — an id it does not recognise is a refusal, not a new
 * consultation. And every refusal is logged with its rule's code, so "the gate
 * said no, and which one" is visible in request logs rather than nowhere.
 */
export async function POST(req: NextRequest) {
  // Guests only — this is the route that actually spends money. Signed-in
  // callers have /api/realtime-token, which checks their entitlement.
  const signedIn = await rejectIfSignedIn();
  if (signedIn) return signedIn;

  const { sessionId, stationId } = await req.json();
  if (!sessionId || !stationId) {
    return NextResponse.json({ error: 'sessionId and stationId are required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const cookie = readGuestCookie(req.cookies.get(GUEST_COOKIE)?.value);

  const { data: session } = await admin
    .from('clinical_sessions')
    .select('user_id, status, started_at, station_id')
    .eq('id', sessionId)
    .maybeSingle();

  const refusal = guestMintRefusal({
    cookie,
    sessionId,
    session,
    requestedStationId: stationId,
    nowMs: Date.now(),
  });
  if (refusal) {
    logGuestRefusal('try/realtime-token', sessionId, refusal);
    return NextResponse.json(
      { error: refusal.error, code: refusal.code, retryAfterSeconds: refusal.retryAfterSeconds },
      { status: refusal.status },
    );
  }

  // The row's station, not the body's — they were just checked to agree, and
  // the row is the one the server wrote.
  //
  // `is_free_trial` is asked again here even though the door already asked it.
  // Cheap, and it is the last gate before the money: a station un-flagged since
  // the session was opened stops being free at the moment it stops being free,
  // and a row written by some earlier version of this lane cannot buy a mint on
  // a paid case.
  const { data: station, error: stationErr } = await admin
    .from('stations')
    .select('*')
    .eq('id', session?.station_id ?? stationId)
    .eq('is_free_trial', true)
    .eq('is_active', true)
    .maybeSingle();
  if (stationErr || !station) {
    return NextResponse.json({ error: 'This case is not available' }, { status: 403 });
  }

  try {
    const result = await mintEphemeralKey(station, voiceForStation(station), {
      unreliableAec: unreliableEchoCancellation(req.headers.get('user-agent')),
    });

    await admin.from('clinical_sessions').update({ status: 'live' }).eq('id', sessionId);

    const durationSeconds = Number(station.consultation_duration_seconds) || 480;
    // `result` carries `origin` ('primary' | 'fallback') — which slot minted
    // the key — and `lane`, the Azure resource that slot pointed at. The client
    // logs both to the flight recorder; keep them in the response.
    const response = NextResponse.json({ ...result, durationSeconds });

    // The cooldown clock starts on a mint that actually happened. A mint Azure
    // refused costs nothing and must not lock the trainee out of retrying.
    const stamped = signGuestCookie(withMint(cookie!, sessionId, Math.floor(Date.now() / 1000)));
    if (stamped) response.cookies.set(GUEST_COOKIE, stamped, guestCookieOptions());
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start realtime session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

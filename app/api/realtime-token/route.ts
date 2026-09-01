import { NextRequest, NextResponse } from 'next/server';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { mintEphemeralKey, unreliableEchoCancellation } from '@/lib/clinical-master/realtimeToken';
import { voiceForStation } from '@/lib/clinical-master/realtimeSession';
import { visibleStationStates } from '@/lib/stations/visibility';


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
 * Mint an Azure gpt-realtime ephemeral key for an authenticated consultation.
 * Replaces the former /api/livekit-token route. Verifies the Supabase JWT,
 * loads the station to build the patient prompt, marks the session live, and
 * returns the ephemeral key + WebRTC calls URL for the browser.
 */
export async function POST(req: NextRequest) {
  // Server-side auth + entitlement: this is the endpoint that spends Azure
  // realtime minutes, so a signed-in account without a live plan must not
  // reach it even though the middleware never sees an API call.
  const { user, allowed, entitlement } = await getServerEntitlement();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // `state` rides along so the caller can pick renew-vs-buy without guessing.
  if (!allowed) {
    return NextResponse.json(
      { error: 'no_active_plan', state: entitlement.state, pending: entitlement.state === 'none' && Boolean(entitlement.plan) },
      { status: 403 },
    );
  }

  const { sessionId, stationId } = await req.json();
  if (!sessionId || !stationId) {
    return NextResponse.json({ error: 'sessionId and stationId are required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Load the full station for prompt building
  const { data: station, error: stationErr } = await admin
    .from('stations')
    .select('*')
    .eq('id', stationId)
    .in('is_active', visibleStationStates())
    .maybeSingle();
  if (stationErr || !station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 });
  }

  // Ensure the session exists and belongs to this user, then mark it live
  const { data: existing } = await admin
    .from('clinical_sessions')
    .select('id, user_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (existing && existing.user_id && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await mintEphemeralKey(station, voiceForStation(station), {
      unreliableAec: unreliableEchoCancellation(req.headers.get('user-agent')),
    });

    if (existing) {
      await admin.from('clinical_sessions').update({ status: 'live' }).eq('id', sessionId);
    } else {
      await admin.from('clinical_sessions').insert({
        id: sessionId,
        user_id: user.id,
        station_id: stationId,
        status: 'live',
        started_at: new Date().toISOString(),
      });
    }

    const durationSeconds = Number(station.consultation_duration_seconds) || 480;
    // `result` carries `origin` ('primary' | 'fallback') — which Azure region
    // minted the key. The client logs it to the flight recorder; keep it in the
    // response.
    return NextResponse.json({ ...result, durationSeconds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start realtime session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

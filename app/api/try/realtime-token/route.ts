import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { mintEphemeralKey, unreliableEchoCancellation } from '@/lib/clinical-master/realtimeToken';
import { voiceForStation } from '@/lib/clinical-master/realtimeSession';
import { rejectIfSignedIn } from '@/lib/trial/guestOnly';

/**
 * Mint an Azure gpt-realtime ephemeral key for a guest (free-trial) consultation.
 * Replaces the former /api/try/livekit-token route. No JWT — validates that the
 * station is an active free-trial case, marks the guest session live, and returns
 * the ephemeral key + WebRTC calls URL.
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

  // Validate that this station is an active free-trial station, and load it fully
  const { data: station, error: stationErr } = await admin
    .from('stations')
    .select('*')
    .eq('id', stationId)
    .eq('is_free_trial', true)
    .eq('is_active', true)
    .maybeSingle();
  if (stationErr || !station) {
    return NextResponse.json({ error: 'This station is not available for free trial' }, { status: 403 });
  }

  // Ensure the guest session exists (user_id null), then mark it live
  const { data: existing } = await admin
    .from('clinical_sessions')
    .select('id')
    .eq('id', sessionId)
    .maybeSingle();

  try {
    const result = await mintEphemeralKey(station, voiceForStation(station), {
      unreliableAec: unreliableEchoCancellation(req.headers.get('user-agent')),
    });

    if (existing) {
      await admin.from('clinical_sessions').update({ status: 'live' }).eq('id', sessionId);
    } else {
      await admin.from('clinical_sessions').insert({
        id: sessionId,
        user_id: null,
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

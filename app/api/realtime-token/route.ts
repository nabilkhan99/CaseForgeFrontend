import { NextRequest, NextResponse } from 'next/server';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { cohortAllowsStation } from '@/lib/commerce/cohortAccess';
import {
  TRIAL_OPEN_SESSION_MINUTES,
  countOpenTrialSessions,
  startTrialWindowFor,
  trialRefusal,
} from '@/lib/commerce/trialAccess';
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
  const { user, allowed, entitlement, cohort, cohortOnly, trial, trialOnly } =
    await getServerEntitlement();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Checked here as well as in create-session, not instead of it: this is the
  // endpoint that spends Azure realtime minutes, and a session row could exist
  // already — created before the fifth mark landed, or by a client that skipped
  // straight here. The five-station cap is only as good as this refusal.
  //
  // `!entitlement.plan` for the same reason create-session has it: a lapsed
  // customer is told to renew, not shown the trial wall.
  const refusal = entitlement.plan ? null : trialRefusal(trial);
  if (!allowed && refusal) {
    return NextResponse.json({ ...refusal, state: entitlement.state }, { status: 403 });
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

  // Checked here as well as in create-session, not instead of it: this is the
  // endpoint that spends Azure realtime minutes, and a session row for a
  // locked case could exist already (created before the cohort's allowlist was
  // narrowed, or by a client that skipped straight here).
  if (cohortOnly && cohort && !cohortAllowsStation(cohort, stationId)) {
    return NextResponse.json(
      { error: 'not_in_cohort', state: entitlement.state, cohort: true },
      { status: 403 },
    );
  }

  const admin = getSupabaseAdmin();

  // ONE CONSULTATION AT A TIME, for a trial account only.
  //
  // The five-station cap is enforced from a DERIVED count of marked sessions,
  // and a mark lands ~90 seconds after a consultation that itself runs up to 12
  // minutes. For that quarter of an hour a started consultation is invisible to
  // the count, so without this a client could fire N mints in parallel, every
  // one of them reading the same low `used`, and spend N lots of Azure realtime
  // minutes against a five-station grant. Sequential enforcement is not
  // enforcement.
  //
  // Deliberately here and not in create-session: this is the endpoint that
  // spends, and create-session merely records that a brief was opened.
  // `sessionId` is excluded from the count so a reconnect — the browser
  // re-minting a key for the same consultation after a dropped connection — is
  // never mistaken for a second one.
  if (trialOnly) {
    const open = await countOpenTrialSessions(admin, user.id, sessionId);
    if (open > 0) {
      return NextResponse.json(
        {
          error: 'trial_session_in_progress',
          trial: true,
          state: entitlement.state,
          retryAfterMinutes: TRIAL_OPEN_SESSION_MINUTES,
        },
        { status: 409 },
      );
    }
  }

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

    // The first consultation starts the five-day clock — here as well as in
    // create-session, not instead of it. This endpoint inserts a session row of
    // its own when it does not find one, so a client that only ever called it
    // would spend Azure minutes against a grant whose window never opened, and
    // a window that never opens never ends. The stamp is a compare-and-set, so
    // the normal flow (create-session first) is unaffected.
    await startTrialWindowFor(admin, trialOnly, user.id);

    const durationSeconds = Number(station.consultation_duration_seconds) || 480;
    // `result` carries `origin` ('primary' | 'fallback') — which slot minted
    // the key — and `lane`, the Azure resource that slot pointed at. The client
    // logs both to the flight recorder; keep them in the response.
    return NextResponse.json({ ...result, durationSeconds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start realtime session';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

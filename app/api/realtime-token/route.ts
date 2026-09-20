import { NextRequest, NextResponse } from 'next/server';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { cohortAllowsStation } from '@/lib/commerce/cohortAccess';
import {
  TRIAL_OPEN_SESSION_MINUTES,
  countOpenTrialSessions,
  startTrialWindowFor,
  trialStationRefusal,
} from '@/lib/commerce/trialAccess';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isStartableStatus } from '@/lib/clinical-master/sessionLifecycle';
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
  // `state` rides along so the caller can pick renew-vs-buy without guessing.
  // An ENDED trial lands here too: it is an expired plan like any other, and
  // this refusal is what makes its five days real at the endpoint that spends.
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

  // The five cases, checked here as well as in create-session and for the same
  // reason the cohort allowlist is: a session row for a locked case could
  // already exist — created before the flags were changed, or by a client that
  // skipped the brief page entirely — and this is the endpoint that spends
  // money. Unlimited attempts means unlimited attempts AT THESE FIVE.
  const stationLock = trialOnly ? trialStationRefusal(trial, stationId) : null;
  if (stationLock) {
    return NextResponse.json({ ...stationLock, state: entitlement.state }, { status: 403 });
  }

  const admin = getSupabaseAdmin();

  // ONE CONSULTATION AT A TIME, for a trial account only.
  //
  // The one quantity limit left on a trial. Attempts at the five cases are
  // unlimited BY DESIGN, which is exactly why this has to hold: without it a
  // client could fire fifty mints at the same free station in parallel and
  // spend fifty lots of Azure realtime minutes. One person sits one
  // consultation at a time.
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
    .select('id, user_id, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (existing && existing.user_id && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // A CONSULTATION THAT IS OVER CANNOT BE STARTED AGAIN.
  //
  // The guest lane has always refused this (rule 7, lib/trial/guestSession.ts);
  // this lane did not, and that is the whole of the resurrection bug. Opening a
  // finished consultation's URL — Back from the report, a refresh, an old link,
  // the retry button after a graceful end — looked exactly like opening a fresh
  // one, because the page reads only the station and never the session row. The
  // patient was dialled a second time and the `live` write below demoted a row
  // the marking engine had already completed.
  //
  // It sits BEFORE the mint on purpose. Guarding only the write would still
  // spend the Azure minutes, still start the call, and then lose it in silence:
  // save-transcript writes only while the row is `live`, so the second
  // conversation would be dropped with no error anywhere. Refusing here is the
  // fix; the `.in()` on the update is defence in depth.
  //
  // `live` stays startable — a mid-call reconnect re-mints against its own row.
  if (existing && !isStartableStatus(existing.status)) {
    return NextResponse.json(
      { error: 'session_finished', code: 'session_finished', sessionStatus: existing.status },
      { status: 409 },
    );
  }

  try {
    const result = await mintEphemeralKey(station, voiceForStation(station), {
      unreliableAec: unreliableEchoCancellation(req.headers.get('user-agent')),
    });

    if (existing) {
      // Defence in depth behind the refusal above: a row that finished between
      // that read and this write can never be demoted back to `live`. Same
      // shape as abandon-session, which has always guarded this way.
      await admin
        .from('clinical_sessions')
        .update({ status: 'live' })
        .eq('id', sessionId)
        .in('status', ['reading', 'live']);
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
    await startTrialWindowFor(admin, trialOnly, user.id, trial);

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

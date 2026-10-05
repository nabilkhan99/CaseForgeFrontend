import { NextRequest, NextResponse } from 'next/server';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { cohortAllowsStation } from '@/lib/commerce/cohortAccess';
import { startTrialWindowFor, trialStationRefusal } from '@/lib/commerce/trialAccess';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  caseVersionGateFailure,
  isAdminEmail,
  loadStationRunDecision,
} from '@/lib/stations/caseVersionsServer';

export async function POST(req: NextRequest) {
  const { supabase, user, allowed, entitlement, cohort, cohortOnly, trial, trialOnly } =
    await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The middleware only guards the page; without this an expired or
  // never-paid account could start sessions straight from the API. An ENDED
  // trial is an expired plan like any other and is refused here, the same way.
  // `state` rides along so the caller can send them to the same renew-vs-buy
  // prompt the middleware would have chosen, rather than guessing.
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

  // A trainer-pilot seat buys a named handful of cases, not the bank. The
  // library greys the rest out and the brief page swaps Start for an upsell,
  // but both are decoration — this is the check that actually holds, because
  // the station id arrives in the request body and nothing before this point
  // has looked at it.
  if (cohortOnly && cohort && !cohortAllowsStation(cohort, stationId)) {
    return NextResponse.json(
      { error: 'not_in_cohort', state: entitlement.state, cohort: true },
      { status: 403 },
    );
  }

  // A trial buys FIVE NAMED CASES, unlimited times — not the bank. The library
  // dashes out the rest and the brief page swaps Begin for an upsell, but both
  // are decoration: this is the check that actually holds, because the station
  // id arrives in the request body and nothing before this point has looked at
  // it. Same shape as the cohort check above, and gated on `trialOnly` for the
  // same reason it is gated on `cohortOnly` — a trialist who has since bought
  // must not be narrowed to five cases by a grant they are no longer using.
  const stationLock = trialOnly ? trialStationRefusal(trial, stationId) : null;
  if (stationLock) {
    return NextResponse.json({ ...stationLock, state: entitlement.state }, { status: 403 });
  }

  // WHICH VERSION OF THIS CASE, after every access check above and never in
  // place of one: a plan, a cohort seat or a trial decides WHETHER someone may
  // practise; this decides which version of a replaced case they practise.
  // A keeper of an old case runs the old case and never its replacement;
  // everyone else runs the replacement; drafts are admins only. The refusal
  // carries the version they DO see, so the brief page can forward them there
  // instead of leaving them at a dead end.
  //
  // It also answers an unknown id with a clean 404. Before this, a made-up
  // station id got as far as the insert below, where the foreign key on
  // clinical_sessions.station_id refused it and the route answered a 500 with
  // Postgres's error text.
  //
  // If the keeper read fails, the gate answers 503 "try again" rather than
  // guessing (a guess either way would hand someone the wrong version).
  //
  // Today every case is live and replaces nothing, so this is one station read
  // and an `allowed` for everybody.
  const version = await loadStationRunDecision(getSupabaseAdmin(), stationId, {
    userId: user.id,
    isAdmin: isAdminEmail(user.email),
  });
  if (!version.found) {
    return version.failed
      ? NextResponse.json({ error: 'Could not check this case. Try again.' }, { status: 500 })
      : NextResponse.json({ error: 'Station not found', code: 'station_not_found' }, { status: 404 });
  }
  if (!version.gate.allowed) {
    const failure = caseVersionGateFailure(version.gate);
    return NextResponse.json(failure.body, { status: failure.status });
  }

  // Check if session already exists (idempotent)
  const { data: existing } = await supabase
    .from('clinical_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (existing) {
    // Stamped on this path too, not only on a fresh insert. A client that
    // retries create-session after a transient failure would otherwise reach a
    // session row whose window never started, and an unstarted window is a
    // trial that never expires. The stamp is a compare-and-set, so doing it
    // twice is free.
    await startTrialWindowFor(getSupabaseAdmin(), trialOnly, user.id, trial);
    return NextResponse.json({ status: 'exists', sessionId });
  }

  // Create the session record
  const { error } = await supabase
    .from('clinical_sessions')
    .insert({
      id: sessionId,
      user_id: user.id,
      station_id: stationId,
      status: 'reading',
      started_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // After the insert, never before: the five days must run from a consultation
  // that actually exists, so a request that fell over on the way in cannot
  // start somebody's clock.
  await startTrialWindowFor(getSupabaseAdmin(), trialOnly, user.id, trial);

  return NextResponse.json({ status: 'created', sessionId });
}

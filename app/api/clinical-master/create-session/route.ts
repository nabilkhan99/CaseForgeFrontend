import { NextRequest, NextResponse } from 'next/server';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { cohortAllowsStation } from '@/lib/commerce/cohortAccess';
import { startTrialWindowFor, trialRefusal } from '@/lib/commerce/trialAccess';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const { supabase, user, allowed, entitlement, cohort, cohortOnly, trial, trialOnly } =
    await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // A spent trial answers before the generic refusal below, with its own code.
  // `no_active_plan` would be true but useless here: it sends the client to
  // renew-vs-buy, and the right destination for somebody who has just used
  // their five stations is the two-plan wall. The two reasons are separated
  // (`trial_allowance_used` / `trial_expired`) because the wall says different
  // things about stations that ran out and days that did.
  //
  // `!entitlement.plan` matches the rule the middleware applies to the same
  // pair of facts: somebody who once bought and lapsed has a purchase to renew,
  // and the API must not name a different wall from the one a page navigation
  // would have sent them to.
  const refusal = entitlement.plan ? null : trialRefusal(trial);
  if (!allowed && refusal) {
    return NextResponse.json({ ...refusal, state: entitlement.state }, { status: 403 });
  }

  // The middleware only guards the page; without this an expired or
  // never-paid account could start sessions straight from the API.
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
    await startTrialWindowFor(getSupabaseAdmin(), trialOnly, user.id);
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
  await startTrialWindowFor(getSupabaseAdmin(), trialOnly, user.id);

  return NextResponse.json({ status: 'created', sessionId });
}

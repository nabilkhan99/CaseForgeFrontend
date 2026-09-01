import { NextRequest, NextResponse } from 'next/server';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { cohortAllowsStation } from '@/lib/commerce/cohortAccess';

export async function POST(req: NextRequest) {
  const { supabase, user, allowed, entitlement, cohort, cohortOnly } =
    await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  return NextResponse.json({ status: 'created', sessionId });
}

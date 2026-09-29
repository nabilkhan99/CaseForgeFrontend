import { NextResponse } from 'next/server';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { loadCoachingJoinDetails } from '@/lib/commerce/coachingJoinServer';
import { NO_JOIN_DETAILS, type CoachingJoinDetails } from '@/lib/commerce/coachingJoin';

export type CoachingDetailsResponse = CoachingJoinDetails;

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The joining link and coach for the signed-in student's coaching session,
 * for the dashboard card. Set by an admin on /admin/coaching.
 *
 * Only a Complete customer with a booked session is asked about at all; for
 * everyone else the answer is "nothing set" without a database read. Never
 * errors past the 401: a failed lookup is the same as no link yet, which the
 * card already explains.
 */
export async function GET() {
  const { user, entitlement } = await getServerEntitlement();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  }

  const holdsCoaching = entitlement.plan === 'complete' || entitlement.plan === 'intensive';
  const body: CoachingDetailsResponse =
    holdsCoaching && entitlement.coachingDay && user.email
      ? await loadCoachingJoinDetails(user.email, entitlement.coachingDay)
      : NO_JOIN_DETAILS;

  return NextResponse.json(body, { headers: NO_STORE });
}

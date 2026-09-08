import { NextResponse } from 'next/server';
import { retiredGuestRoute } from '@/lib/trial/retiredGuestRoute';

/**
 * Gone: the anonymous Azure ephemeral-key mint. See lib/trial/retiredGuestRoute.
 *
 * This was the only place in the product that spent Azure gpt-realtime minutes
 * for a caller with no account, and the nine cookie rules around it existed to
 * bound that. Free stations run in a free account now, so the authenticated
 * `/api/realtime-token` — which checks entitlement and the trial allowance — is
 * the only mint left.
 *
 * The route stays and answers 410 so a tab left open on the old call screen
 * fails with a sentence rather than a 404.
 */

// Nothing but the handler may be exported from a route file — Next validates
// the module's shape at build time. The body lives in lib/trial/retiredGuestRoute.

export async function POST(): Promise<NextResponse> {
  return retiredGuestRoute();
}

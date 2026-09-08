import { NextResponse } from 'next/server';
import { retiredGuestRoute } from '@/lib/trial/retiredGuestRoute';

/**
 * Gone: the anonymous consultation opener. See lib/trial/retiredGuestRoute.
 *
 * The file stays so an old tab, a cached bundle or a bookmarked script fails
 * with something that says what happened, instead of a 404 that reads as an
 * outage. Nothing in the app calls it: /free/start makes an account, and the
 * authenticated `/api/clinical-master/create-session` opens the session.
 */

// Nothing but the handler may be exported from a route file — Next validates
// the module's shape at build time. The body lives in lib/trial/retiredGuestRoute.

export async function POST(): Promise<NextResponse> {
  return retiredGuestRoute();
}

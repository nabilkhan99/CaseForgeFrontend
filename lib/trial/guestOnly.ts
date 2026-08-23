import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * The free-station funnel is for people who do not have an account.
 *
 * The middleware already turns signed-in visitors away from the /try PAGES,
 * but the pages are not the expensive part: `/api/try/create-session` and
 * `/api/try/realtime-token` are anonymous by design (they run on the service
 * role precisely because a guest has no session), so anyone signed in could
 * still POST at them directly and spend an Azure gpt-realtime consultation
 * outside their entitlement — and land the result in a `clinical_sessions` row
 * owned by nobody, invisible from the dashboard they are paying for.
 *
 * So the API says no too. A signed-in caller belongs in the real product; the
 * message says where their consultations actually live rather than a bare 403,
 * because the only human who will ever see it is a customer who took a wrong
 * turn.
 *
 * NOT applied to the gate routes (`send-code`, `verify-code`): /try/feedback is
 * deliberately reachable while signed in, so a buyer can still open an old
 * guest report link, and blocking the gate there would strand them.
 */

const SIGNED_IN = {
  error: 'signed_in',
  message: "You're signed in — your consultations live in your dashboard.",
};

/** A 403 response when the caller holds a session, otherwise null. */
export async function rejectIfSignedIn(): Promise<NextResponse | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? NextResponse.json(SIGNED_IN, { status: 403 }) : null;
  } catch (error: unknown) {
    // Fail OPEN: a guest with no cookies at all is the normal caller here, and
    // an auth lookup that breaks must not take the free funnel down with it.
    console.error('[try] signed-in check failed — treating caller as a guest', { error });
    return null;
  }
}

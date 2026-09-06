import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { mintRecoveryTokenHash } from '@/lib/auth/provisioning';
import { ensureTrialAccount } from '@/lib/auth/trialAccount';
import { verifyTrialLink } from '@/lib/auth/trialLink';
import { doorForSource, type TrialDoor } from '@/lib/trial/trialEvents';
import { clientIp, createHitLog, withinLimit } from '@/lib/http/rateLimit';

/**
 * Redeeming a link: account, claim, grant, session. Door (c).
 *
 * The page at /auth/start is a thin shell that POSTs here and then navigates.
 * All the work is on the server for one reason: a ROUTE HANDLER can set
 * cookies, so `verifyOtp` here leaves the browser holding a real Supabase
 * session before the page moves. Doing it client-side would work too — that is
 * what /auth/set-password does — but it would mean shipping the account, claim
 * and grant calls to a second round trip after it, and this way the page has
 * exactly one failure mode to render.
 *
 * ## Two kinds of token land here
 *
 * `token` — our own signed link (lib/auth/trialLink): an HMAC over address,
 * door and expiry, minted by scripts/trial-links/mint.ts or by
 * /api/try/dashboard-link. Redeeming it does the full account-claim-grant run,
 * because the holder may never have had an account.
 *
 * `tokenHash` — a GoTrue recovery hash, minted by /api/try/verify-code for an
 * account it has JUST created and already granted. Nothing to do but establish
 * the session. This is the path that works with no `TRIAL_LINK_SECRET` set
 * anywhere, which is why the sign-up and guest-reveal doors do not wait on it.
 *
 * ## ⚠️ Bearer credential
 *
 * Either token, in either form, makes the holder that account. Short expiry,
 * one address per link, never logged — the same rules the set-password link
 * has, for the same reason. Nothing in this file writes a token to a log line.
 */

/**
 * Per-IP brake. Not the security boundary — the MAC and GoTrue's own token
 * checks are — but this route calls GoTrue on every attempt, and an
 * unauthenticated endpoint that does that deserves a ceiling.
 */
const IP_LIMIT = 20;
const IP_WINDOW_MS = 10 * 60 * 1000;
const ipHits = createHitLog();

/** Why a link could not be redeemed. The page renders one sentence per value. */
export type StartFailure = 'invalid' | 'expired' | 'unavailable' | 'throttled';

interface StartSuccess {
  ok: true;
  /** True when the auth user was created by this redemption. */
  created: boolean;
  /** Which door, in the analytics vocabulary, or null for a plain sign-in. */
  door: TrialDoor | null;
}

interface StartFailureBody {
  ok: false;
  reason: StartFailure;
}

export async function POST(request: Request) {
  let token = '';
  let tokenHash = '';
  try {
    const body = (await request.json()) as { token?: unknown; tokenHash?: unknown };
    token = typeof body.token === 'string' ? body.token.trim() : '';
    tokenHash = typeof body.tokenHash === 'string' ? body.tokenHash.trim() : '';
  } catch {
    return fail('invalid');
  }

  if (!token && !tokenHash) return fail('invalid');

  if (!withinLimit(ipHits, clientIp(request), IP_LIMIT, IP_WINDOW_MS)) {
    return fail('throttled', 429);
  }

  // The simple path: the grant already happened, this is only a sign-in.
  if (!token) return await establishSession(tokenHash, { created: false, door: null });

  const verified = verifyTrialLink(token);
  if (!verified.ok) {
    if (verified.reason === 'expired') return fail('expired');
    if (verified.reason === 'no_secret') {
      // Not the holder's fault and not a forgery: TRIAL_LINK_SECRET is missing
      // from this deployment, so no link can be checked at all. Loud, because
      // every link in flight is dead until it is set.
      console.error('[auth/start] TRIAL_LINK_SECRET is not set — links cannot be redeemed');
      return fail('unavailable');
    }
    return fail('invalid');
  }

  const { email, source } = verified.payload;

  // `mintSignIn: false` — this route establishes the session itself a moment
  // from now, and minting a recovery token INVALIDATES the previous one, so
  // asking for two would race our own verifyOtp against it.
  const ensured = await ensureTrialAccount(getSupabaseAdmin(), {
    email,
    source,
    mintSignIn: false,
  });
  if (!ensured.userId) return fail('unavailable');

  const { tokenHash: fresh, error } = await mintRecoveryTokenHash({ email });
  if (!fresh) {
    console.error('[auth/start] could not mint a session for a valid link', { error });
    return fail('unavailable');
  }

  return await establishSession(fresh, {
    created: ensured.created,
    door: doorForSource(source),
  });
}

/**
 * Turn a recovery hash into cookies on this response.
 *
 * `createClient()` writes through `next/headers`, which a route handler is
 * allowed to do — this is the whole reason the redemption lives on the server.
 */
async function establishSession(
  tokenHash: string,
  outcome: Omit<StartSuccess, 'ok'>,
): Promise<NextResponse<StartSuccess | StartFailureBody>> {
  if (!tokenHash) return fail('invalid');

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    if (error) {
      // Single-use and short-lived, so "already spent" and "too old" both land
      // here and both read the same to the person holding it.
      return fail('expired');
    }
  } catch (error: unknown) {
    console.error('[auth/start] verifyOtp threw', { error });
    return fail('unavailable');
  }

  return NextResponse.json({ ok: true, ...outcome });
}

function fail(reason: StartFailure, status = 200): NextResponse<StartFailureBody> {
  // 200 by default: this is a page telling somebody their link did not work,
  // not an API contract violation, and a 4xx here only makes the browser
  // console noisier without telling the caller anything `reason` does not.
  return NextResponse.json({ ok: false, reason }, { status });
}

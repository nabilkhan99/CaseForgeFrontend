import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSetPasswordLink } from '@/lib/auth/provisioning';

/**
 * "Email me a fresh link" for a buyer whose set-password link has expired.
 *
 * Server-side on purpose. The browser client's `resetPasswordForEmail` mints a
 * PKCE link whose `code_verifier` lives in the requesting browser, so a link
 * requested on a laptop and opened on a phone fails with "code verifier should
 * be non-empty" — an infinite loop of dead links. This route re-sends exactly
 * what provisioning sends: an admin-generated recovery `token_hash` that works
 * in any browser.
 *
 * Only addresses with a paid purchase are served (checked with the service
 * role), but the response never says so. Past the two request-shape 400s, every
 * path returns the SAME generic body: no purchase, purchase, lookup failure,
 * cooled down, send failure. That is deliberate and it is why the send is
 * detached rather than awaited — see below.
 */

const GENERIC_OK = {
  ok: true,
  message: "If that address has a purchase with us, an email is on its way.",
};

/**
 * Best-effort abuse brake on an unauthenticated, service-role-backed mailer.
 *
 * The limiter is in-module Maps, so the window is PER SERVERLESS INSTANCE and
 * resets on a cold start — someone determined, spraying across instances, gets
 * more than the nominal budget. It is still worth having, because the threat it
 * actually stops is the cheap one: a script POSTing a known customer's address
 * in a loop. Every iteration mints a fresh recovery token, which INVALIDATES the
 * previous one, so an unthrottled attacker doesn't just mailbomb the victim —
 * they deny them account setup entirely, since every link the victim opens has
 * already been superseded. It also caps the Brevo spend and GoTrue calls a
 * single hot instance can run up. (This route deliberately bypasses GoTrue's
 * own `resetPasswordForEmail` rate limits by using the service role, so none of
 * those protections apply here.)
 *
 * Swap for a KV/Upstash counter when the app has one; the two `withinLimit`
 * calls below are the only thing that would change.
 */
const EMAIL_LIMIT = 1;
const EMAIL_WINDOW_MS = 5 * 60 * 1000;
const IP_LIMIT = 5;
const IP_WINDOW_MS = 60 * 60 * 1000;

/** key -> timestamps of the attempts counted against it. */
const emailHits = new Map<string, number[]>();
const ipHits = new Map<string, number[]>();

/**
 * Record an attempt against `key` and report whether it fits in the window.
 *
 * Prunes the WHOLE map on access, not just this key, so a long-lived instance
 * doesn't accumulate every address it has ever been asked about.
 */
function withinLimit(
  hits: Map<string, number[]>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): boolean {
  for (const [seen, times] of hits) {
    const live = times.filter((t) => now - t < windowMs);
    if (live.length === 0) hits.delete(seen);
    else hits.set(seen, live);
  }

  const live = hits.get(key) ?? [];
  // Only an allowed attempt is recorded, which both keeps the budget a plain
  // "N per window" and bounds each entry at `limit` timestamps — a rejected
  // flood cannot grow the array it is being rejected by.
  if (live.length >= limit) return false;
  hits.set(key, [...live, now]);
  return true;
}

/** Vercel puts the client address at the head of `x-forwarded-for`. */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  let email: string;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  // Counted BEFORE we know whether the address has a purchase, and answered
  // with the same generic body: if only real customers consumed budget, the
  // presence or absence of a cooldown would itself be the enumeration oracle
  // this route exists to avoid.
  const now = Date.now();
  const ipOk = withinLimit(ipHits, clientIp(request), IP_LIMIT, IP_WINDOW_MS, now);
  const emailOk = withinLimit(emailHits, email, EMAIL_LIMIT, EMAIL_WINDOW_MS, now);
  if (!ipOk || !emailOk) return NextResponse.json(GENERIC_OK);

  const supabase = getSupabaseAdmin();
  const { data: purchase, error: lookupError } = await supabase
    .from('preorders')
    .select('id, full_name')
    .eq('email', email)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle();

  // This select is awaited: it is one indexed lookup against our own database,
  // fast and roughly constant whether it hits or misses. The upstream calls
  // below are what leak, so those are the ones that get detached.
  if (lookupError) {
    console.error('[resend-set-password] purchase lookup failed', { error: lookupError });
    return NextResponse.json(GENERIC_OK);
  }

  // No purchase: answer exactly as if there were one. Nothing is sent.
  if (!purchase) return NextResponse.json(GENERIC_OK);

  // The pre-launch refusal that used to sit here is gone with the one in
  // provisionBuyer: access is open, so a paid buyer asking for a link is owed
  // one, and the refusal had become the reason a tester could not get a link at
  // all. Everything else about this route is unchanged — the generic body, and
  // the detached send below.

  // Detached on purpose, and the response never depends on how it goes.
  // Awaiting it leaked twice over: a hit did two upstream round-trips (GoTrue
  // `generateLink`, then Brevo) while a miss returned immediately, so response
  // TIME separated customers from strangers; and a failure surfaced as a 500
  // whose dominant real cause is "paid buyer whose auth account was never
  // created", which is an even sharper signal than the timing. Both are exactly
  // what the generic body is there to hide.
  //
  // The cost of detaching is that a send can be lost if the instance is frozen
  // before it settles. That is acceptable here: nothing is owed to the caller,
  // the failure is logged, and the buyer can simply ask again.
  void sendSetPasswordLink({ email, fullName: purchase.full_name })
    .then(async (result) => {
      if (!result.sent) {
        console.error('[resend-set-password] send failed', { error: result.error });
        return;
      }
      // The Stripe webhook decides whether a buyer is still owed a link off
      // this stamp, so a link sent from here has to close that obligation. Left
      // unstamped, a webhook retry days later mails a SECOND link and rotates
      // the recovery token out from under the one the buyer just used.
      const { error: stampError } = await supabase
        .from('preorders')
        .update({ set_password_sent_at: new Date().toISOString() })
        .eq('id', purchase.id);
      if (stampError) {
        console.error('[resend-set-password] stamp failed', { error: stampError });
      }
    })
    .catch((error: unknown) => {
      console.error('[resend-set-password] send threw', { error });
    });

  return NextResponse.json(GENERIC_OK);
}

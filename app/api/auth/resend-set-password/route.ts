import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendSetPasswordLink } from '@/lib/auth/provisioning';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';

/**
 * "Email me a fresh link" for someone whose set-password link has expired.
 *
 * Server-side on purpose. The browser client's `resetPasswordForEmail` mints a
 * PKCE link whose `code_verifier` lives in the requesting browser, so a link
 * requested on a laptop and opened on a phone fails with "code verifier should
 * be non-empty" — an infinite loop of dead links. This route re-sends exactly
 * what provisioning sends: an admin-generated recovery `token_hash` that works
 * in any browser.
 *
 * TWO WAYS TO BE OWED A LINK (both checked with the service role):
 *   - a paid purchase in `preorders`;
 *   - membership of any trainer cohort — a pilot seat is a real account with no
 *     purchase behind it, so the preorders check alone told every cohort
 *     student "an email is on its way" and then sent nothing. This is their
 *     only self-serve recovery: their accounts are hand-provisioned, so a dead
 *     link otherwise means emailing the founder.
 *
 * The response never says which (or neither). Past the two request-shape 400s,
 * every path returns the SAME generic body: no account, purchase, cohort seat,
 * lookup failure, cooled down, send failure. That is deliberate and it is why
 * the send is detached rather than awaited — see below.
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

/**
 * Is this address a trainer-cohort seat?
 *
 * Two hops, because there is no email on `cohort_members`: `profiles` (written
 * one row per auth user by the `on_auth_user_created` trigger, so it is a
 * complete email → id map, and the same route provisioning takes) and then the
 * membership row, which is keyed by `user_id` and indexed on it.
 *
 * FAILS CLOSED, exactly like the purchase lookup above it: a lookup error is
 * "not eligible", never "send anyway". The cost of a false negative here is one
 * person told to ask us; the cost of a false positive is an unauthenticated
 * mailer that will mint a recovery token for any address at all.
 *
 * Matched case-insensitively with the wildcards escaped, as every other email
 * match in this codebase is — a hand-seeded `Sarah@Nhs.net` must still resolve.
 *
 * Only reached when there is NO purchase, so a paying customer's path is
 * unchanged: one indexed lookup, as before.
 */
async function isCohortMember(supabase: SupabaseClient, email: string): Promise<boolean> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', exactEmailPattern(email))
    .maybeSingle();

  if (profileError) {
    console.error('[resend-set-password] profile lookup failed', { error: profileError });
    return false;
  }
  const userId = (profile as { id?: string } | null)?.id;
  if (!userId) return false;

  const { data: membership, error: memberError } = await supabase
    .from('cohort_members')
    .select('user_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    console.error('[resend-set-password] cohort lookup failed', { error: memberError });
    return false;
  }
  return Boolean(membership);
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

  // No purchase is no longer the end of it: a trainer-cohort seat is a real
  // account with no `preorders` row, and this route is its only self-serve
  // recovery. Checked second, and only on the miss, so nothing about the
  // purchase path changes.
  //
  // It does add a round trip to the no-purchase path — but the comparison that
  // matters is cohort member vs. stranger, and both of those pay for the
  // `profiles` lookup, so the shape of the timing is unchanged where it could
  // actually leak. Neither ever reaches the two upstream calls, which stay
  // detached below precisely because those are the ones that separate people.
  if (!purchase && !(await isCohortMember(supabase, email))) {
    // Not owed a link: answer exactly as if they were. Nothing is sent.
    return NextResponse.json(GENERIC_OK);
  }

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
  void sendSetPasswordLink({ email, fullName: purchase?.full_name ?? null })
    .then(async (result) => {
      if (!result.sent) {
        console.error('[resend-set-password] send failed', { error: result.error });
        return;
      }
      // Nothing to stamp for a cohort seat: the stamp lives on the purchase
      // row, and there isn't one. No webhook is watching a cohort member
      // either, so there is no obligation to close.
      if (!purchase) return;
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

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { authLinkOrigin } from '@/lib/auth/provisioning';
import { mintTrialLink, trialLinkUrl } from '@/lib/auth/trialLink';
import { sendDashboardLinkEmail } from '@/lib/auth/dashboardLinkEmail';
import { clientIp, createHitLog, withinLimit } from '@/lib/http/rateLimit';

/**
 * "Open your dashboard" — mints a door-(c) link for a verified trial lead and
 * emails it to them.
 *
 * USER-INITIATED, always. It is reached from the button on someone's own
 * report (components/try/OpenDashboardButton) and from the "send me a fresh
 * one" fallback on /auth/start. Nothing calls it in a loop, and the mint script
 * for the existing leads deliberately does not go through it — that one writes
 * a CSV and stops.
 *
 * ## Only verified leads
 *
 * A link is a bearer credential for an account, so it is only ever sent to an
 * address that has already proved it can receive our mail (`email_verified_at`
 * on `trial_leads`). Two ways in:
 *
 *  - `sessionId` — the report page, which knows the session but not the
 *    address. The email comes off the lead row, never off the request, so a
 *    guessed session id cannot redirect somebody else's link.
 *  - `email` — the /auth/start fallback, where the expired link is all the
 *    person has. Verified-only for the same reason.
 *
 * ## Why every answer is identical
 *
 * Past the request-shape 400, every path returns the SAME body: no lead,
 * unverified lead, cooled down, mint failed, send failed, sent. This is an
 * unauthenticated endpoint over customer addresses, and any difference between
 * those answers is an oracle for "does this person have an account with you".
 * The send is detached for the same reason — a hit made two upstream round
 * trips while a miss returned at once, so response TIME said what the body
 * would not.
 */

const GENERIC_OK = {
  ok: true,
  message: "If that address has a consultation with us, a link is on its way.",
};

/**
 * One link per address per five minutes, twenty per IP per hour.
 *
 * Tighter on the address than the IP because the damage is asymmetric: a loop
 * on one known address mailbombs a real person, where a loop from one client
 * across many addresses is caught by the verified-lead requirement first.
 */
const EMAIL_LIMIT = 1;
const EMAIL_WINDOW_MS = 5 * 60 * 1000;
const IP_LIMIT = 20;
const IP_WINDOW_MS = 60 * 60 * 1000;
const emailHits = createHitLog();
const ipHits = createHitLog();

export async function POST(request: Request) {
  let sessionId = '';
  let email = '';
  try {
    const body = (await request.json()) as { sessionId?: unknown; email?: unknown };
    sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!sessionId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A session or a valid email is required' }, { status: 400 });
  }

  // Counted before we know whether the address exists, and answered with the
  // same generic body: if only real leads consumed budget, the presence of a
  // cooldown would itself be the oracle this route exists to avoid.
  const now = Date.now();
  const ipOk = withinLimit(ipHits, clientIp(request), IP_LIMIT, IP_WINDOW_MS, now);
  if (!ipOk) return NextResponse.json(GENERIC_OK);

  const supabase = getSupabaseAdmin();
  const query = supabase.from('trial_leads').select('email, first_name, email_verified_at');
  const { data: lead, error } = await (sessionId
    ? query.eq('session_id', sessionId)
    : query.eq('email', email)
  ).maybeSingle();

  if (error) {
    console.error('[dashboard-link] lead lookup failed', { error });
    return NextResponse.json(GENERIC_OK);
  }
  // Unverified is treated exactly as missing. An unverified lead row is an
  // unproven claim on an address — anyone can type any address into the gate —
  // and mailing it would turn this into a way to send our branded mail to a
  // stranger.
  if (!lead?.email || !lead.email_verified_at) return NextResponse.json(GENERIC_OK);

  if (!withinLimit(emailHits, lead.email, EMAIL_LIMIT, EMAIL_WINDOW_MS, now)) {
    return NextResponse.json(GENERIC_OK);
  }

  const token = mintTrialLink({ email: lead.email, source: 'link' });
  if (!token) {
    // TRIAL_LINK_SECRET is missing from this deployment. Loud, because the
    // button now silently does nothing for everybody who presses it.
    console.error('[dashboard-link] no link minted — is TRIAL_LINK_SECRET set?');
    return NextResponse.json(GENERIC_OK);
  }

  // Detached on purpose; see the note above. Nothing is owed to the caller, the
  // failure is logged, and they can simply ask again.
  const url = trialLinkUrl(authLinkOrigin(), token);
  void sendDashboardLinkEmail({
    toEmail: lead.email,
    toName: lead.first_name,
    dashboardUrl: url,
  })
    .then((result) => {
      if (!result.sent) console.error('[dashboard-link] send failed', { skipped: result.skipped });
    })
    .catch((sendError: unknown) => {
      console.error('[dashboard-link] send threw', { sendError });
    });

  return NextResponse.json(GENERIC_OK);
}

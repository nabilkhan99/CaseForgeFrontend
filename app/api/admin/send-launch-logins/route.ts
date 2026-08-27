import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/guard';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { provisionBuyerAccount } from '@/lib/auth/provisionBuyer';

/**
 * Launch-day send: the set-password link for everyone who bought before the
 * course opened.
 *
 * Pre-launch purchases deliberately get no login email — see the gate in
 * `provisionBuyerAccount`. `set_password_sent_at is null` on a paid row is
 * therefore the list of buyers still owed one, and this hands that list back
 * to the same function the webhook uses, so the compare-and-swap on the send
 * stamp, the "account already exists" recovery and the launch check are all
 * the ones already in production rather than a second implementation that can
 * drift from them.
 *
 * Consequences of that reuse worth knowing: running this before the window
 * opens sends nothing (every buyer fails the gate), and running it twice sends
 * nothing the second time (the stamp is claimed).
 *
 * POST {} lists who would be emailed. POST { "apply": true } sends.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let apply = false;
  try {
    const body = await req.json();
    apply = body?.apply === true;
  } catch {
    /* no body: dry run */
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('preorders')
    .select('id, email, full_name, plan, created_at')
    .eq('status', 'paid')
    .is('set_password_sent_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[send-launch-logins] lookup failed', error);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }

  const owed = data ?? [];
  if (!apply) {
    return NextResponse.json({
      dryRun: true,
      count: owed.length,
      buyers: owed.map((row) => ({ email: row.email, plan: row.plan, bought: row.created_at })),
    });
  }

  // Sequential on purpose. This is a handful of buyers once, and each one is a
  // GoTrue link mint plus a Brevo send; a burst of parallel calls buys nothing
  // and risks rate limits on both.
  let attempted = 0;
  for (const row of owed) {
    attempted += 1;
    await provisionBuyerAccount(admin, {
      preorderId: row.id,
      email: row.email,
      name: row.full_name ?? null,
      sessionId: 'launch-logins',
    });
  }

  // Re-read rather than trusting the loop: provisionBuyerAccount is
  // deliberately silent about its outcome, and the stamp is the only honest
  // record of who actually got an email.
  const { data: after } = await admin
    .from('preorders')
    .select('email')
    .eq('status', 'paid')
    .is('set_password_sent_at', null);
  const stillOwed = (after ?? []).map((row) => row.email);

  return NextResponse.json({
    dryRun: false,
    attempted,
    sent: attempted - stillOwed.length,
    stillOwed,
  });
}

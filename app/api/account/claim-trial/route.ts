import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { claimTrialSessionsForUser } from '@/lib/auth/claimTrialSessions';

/**
 * "Anything I did before I had an account is mine now."
 *
 * Provisioning already claims a buyer's guest free mock at the moment their
 * account is created, but that only covers accounts minted from a purchase
 * going forward. It misses everyone provisioned by hand, everyone whose
 * verified trial lead landed after their account existed, and the whole
 * historical backlog. This is the catch-all, and it runs from the one place
 * every signed-in person passes through: the dashboard.
 *
 * Owner is ALWAYS the caller. There is no body and no id parameter — nothing a
 * client sends can widen what gets claimed, so the worst a hostile caller can
 * do is claim their own sessions, which is the entire feature. The real
 * matching rules (verified lead, never reassign an owned session) live in
 * {@link claimTrialSessionsForUser}.
 *
 * Deliberately NOT folded into `getServerEntitlement` or `/api/subscription`:
 * both are on the hot path of every gated navigation and every dashboard load.
 * The caller fires this once per browser session, and it costs one indexed
 * lookup that almost always returns nothing.
 */

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    // Service role: the sessions being claimed have `user_id null`, so the
    // caller's own RLS cannot see them — that is the point of claiming.
    const claimed = await claimTrialSessionsForUser(getSupabaseAdmin(), user.id, user.email);
    return NextResponse.json({ claimed });
  } catch (error: unknown) {
    console.error('[claim-trial] failed', { userId: user.id, error });
    // Nothing is owed to the caller here — the dashboard renders identically
    // whether or not anything was claimed — so this stays a quiet zero rather
    // than an error the UI would have to explain.
    return NextResponse.json({ claimed: 0 });
  }
}

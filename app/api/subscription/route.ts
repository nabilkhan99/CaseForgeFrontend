import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ACCESS_OPENS } from '@/lib/commerce/plans';

const DAY_MS = 86_400_000;

/** 3 calendar months from launch day, last instant of the final day. */
function preorderExpiry(purchasedAt: string): Date {
  const launch = new Date(`${ACCESS_OPENS}T00:00:00Z`);
  const start = new Date(purchasedAt) < launch ? launch : new Date(purchasedAt);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, start.getUTCDate()));
  end.setUTCDate(end.getUTCDate() - 1);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/**
 * Hotfix (22 Aug 2026): the retired `subscriptions` table is empty, so every
 * signed-in buyer read as "free tier". Recognise a paid `preorders` row under
 * the account's email. The full entitlement engine replaces this at the
 * develop → main merge on 1 Sept.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.email) {
    const { data: preorder } = await supabase
      .from('preorders')
      .select('plan, status, created_at')
      .ilike('email', user.email.replace(/[%_\\]/g, '\\$&'))
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (preorder) {
      const expiresAt = preorderExpiry(preorder.created_at);
      return NextResponse.json({
        subscription: {
          plan: preorder.plan,
          status: 'active',
          expires_at: expiresAt.toISOString(),
          purchased_at: preorder.created_at,
          days_remaining: Math.ceil((expiresAt.getTime() - Date.now()) / DAY_MS),
        },
      });
    }
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, expires_at, purchased_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ subscription: null });
  }

  const daysRemaining = Math.ceil(
    (new Date(subscription.expires_at).getTime() - Date.now()) / DAY_MS
  );

  return NextResponse.json({
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      expires_at: subscription.expires_at,
      purchased_at: subscription.purchased_at,
      days_remaining: daysRemaining,
    },
  });
}

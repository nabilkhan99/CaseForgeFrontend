import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status, expires_at, purchased_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .single();

  if (!subscription) {
    return NextResponse.json({ subscription: null });
  }

  const daysRemaining = Math.ceil(
    (new Date(subscription.expires_at).getTime() - Date.now()) / 86_400_000
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

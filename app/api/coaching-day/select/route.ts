import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import { normalizeEmail } from '@/lib/commerce/referrals';
import type { CoachingDayAvailability } from '@/lib/commerce/plans';

interface SelectBody {
  coachingDay?: string; // ISO date, e.g. "2026-09-12"
}

/**
 * Books the coaching day for a Complete customer who does not have one yet.
 *
 * Why this endpoint exists: Complete used to be bought only through checkout,
 * where the coaching day is chosen before paying. A Customer Portal upgrade
 * from Self-Study to Complete cannot ask for one — Stripe's page has no idea
 * the class exists — so the webhook lands a `complete` row with a null
 * `coaching_day`, and the customer picks their day here afterwards.
 *
 * Owner-checked and single-use: it only ever fills a NULL coaching_day on a
 * paid `complete` row belonging to the signed-in account. It cannot move an
 * existing booking (that is a support conversation, since places are capped at
 * six and someone else may be holding the seat) and it cannot touch anyone
 * else's order.
 */
export async function POST(request: Request) {
  const { user } = await getServerEntitlement();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let day: string | undefined;
  try {
    const body = (await request.json()) as SelectBody;
    day = body?.coachingDay;
  } catch {
    day = undefined;
  }
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: 'A coaching day is required' }, { status: 400 });
  }

  const email = normalizeEmail(user.email);
  const supabase = getSupabaseAdmin();

  try {
    // 1. The order this booking attaches to. Oldest-first so a customer with
    //    more than one Complete row fills the one they have held longest.
    const { data: orders, error: orderError } = await supabase
      .from('preorders')
      .select('id, coaching_day')
      .ilike('email', exactEmailPattern(email))
      .eq('plan', 'complete')
      .eq('status', 'paid')
      .order('created_at', { ascending: true });
    if (orderError) throw orderError;

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'A coaching day comes with the Complete plan — upgrade first.' },
        { status: 403 },
      );
    }
    const pending = orders.find((o) => !o.coaching_day);
    if (!pending) {
      return NextResponse.json(
        {
          error:
            'Your coaching day is already booked. Email hello@fourteenfisherman.com to move it.',
        },
        { status: 409 },
      );
    }

    // 2. The day still has to be open. Same validation as checkout, because a
    //    place in a class of six is the same scarce thing however it is bought.
    const { data: availability, error: dayError } = await supabase
      .from('coaching_day_availability')
      .select('day, label, capacity, places_left, cutoff_at, status')
      .eq('day', day)
      .maybeSingle();
    if (dayError) throw dayError;

    const chosen = availability as CoachingDayAvailability | null;
    if (!chosen || chosen.status === 'closed') {
      return NextResponse.json(
        { error: 'Bookings for this coaching day have closed — please choose another date' },
        { status: 409 },
      );
    }
    if (chosen.status === 'sold_out' || chosen.places_left <= 0) {
      return NextResponse.json(
        { error: `${chosen.label} is sold out — please choose another date` },
        { status: 409 },
      );
    }

    // 3. Book it. The `is('coaching_day', null)` filter makes this safe to
    //    retry and safe against two tabs: the second write matches no row.
    const { data: booked, error: bookError } = await supabase
      .from('preorders')
      .update({ coaching_day: chosen.day })
      .eq('id', pending.id)
      .is('coaching_day', null)
      .select('id');
    if (bookError) throw bookError;

    if (!booked || booked.length === 0) {
      return NextResponse.json(
        { error: 'Your coaching day was booked a moment ago — reload to see it.' },
        { status: 409 },
      );
    }

    return NextResponse.json({ coachingDay: chosen.day, label: chosen.label });
  } catch (error: unknown) {
    console.error('[coaching-day-select] failed', { email, day, error });
    return NextResponse.json(
      { error: 'Could not book your coaching day — please try again.' },
      { status: 500 },
    );
  }
}

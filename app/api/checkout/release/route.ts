import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/commerce/stripe';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * A hold with no Stripe session yet is only released once it is at least this
 * old. Younger than that, the checkout that claimed it may still be talking to
 * Stripe, and freeing the slot underneath it would let a second buyer in.
 */
const UNLINKED_HOLD_MIN_AGE_MS = 2 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReleaseBody {
  holdId?: unknown;
}

interface HoldRow {
  id: string;
  stripe_session_id: string | null;
  created_at: string;
}

function released(value: boolean) {
  return NextResponse.json({ released: value });
}

async function readHoldId(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as ReleaseBody;
    return typeof body?.holdId === 'string' && UUID_PATTERN.test(body.holdId) ? body.holdId : null;
  } catch {
    return null;
  }
}

/**
 * Releases a coaching slot hold when the buyer comes back from Stripe without
 * paying (checkout's `cancel_url` carries the hold id to the booking page, which
 * calls this). Frees the slot at once instead of when the hold runs out.
 *
 * POST /api/checkout/release  { holdId } -> 200 { released: boolean }
 *
 * No sign-in: a signed-out buyer holds slots too. The hold id is the capability.
 * It is an unguessable uuid that only ever travels in the cancel url of the
 * buyer's own checkout, and the worst it can do is give back a slot nobody has
 * paid for.
 *
 * Never releases a slot that may still be paid for:
 *  - session open: expire it at Stripe first, so it cannot complete, then free
 *    the slot. If Stripe will not expire it, the hold stays.
 *  - session expired: free the slot.
 *  - session complete: leave it. The webhook records the order and retires the
 *    hold itself.
 *  - no session linked yet: free it only once the hold is old enough that no
 *    checkout can still be creating its session.
 *
 * Always answers 200; failures are logged, never thrown at the client.
 */
export async function POST(request: Request) {
  const holdId = await readHoldId(request);
  if (!holdId) return released(false);

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('checkout_holds')
      .select('id, stripe_session_id, created_at')
      .eq('id', holdId)
      .maybeSingle();
    if (error) {
      console.error('[checkout-release] hold lookup failed', { holdId, error });
      return released(false);
    }
    const hold = data as HoldRow | null;
    if (!hold) return released(false);

    if (!hold.stripe_session_id) {
      const cutoff = new Date(Date.now() - UNLINKED_HOLD_MIN_AGE_MS).toISOString();
      // Conditions re-checked in the delete itself, so a checkout that links
      // its session between the read above and this write keeps its hold.
      const { data: deleted, error: deleteError } = await supabase
        .from('checkout_holds')
        .delete()
        .eq('id', hold.id)
        .is('stripe_session_id', null)
        .lt('created_at', cutoff)
        .select('id');
      if (deleteError) {
        console.error('[checkout-release] unlinked hold delete failed', { holdId, error: deleteError });
        return released(false);
      }
      return released((deleted?.length ?? 0) > 0);
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(hold.stripe_session_id);

    if (session.status !== 'open' && session.status !== 'expired') {
      // 'complete': paid, or about to be recorded as paid, and the webhook owns
      // this hold. Anything else is a state we cannot vouch for, so the hold
      // is left to expire on its own.
      return released(false);
    }

    if (session.status === 'open') {
      // Throws if Stripe refuses (for instance the session completed a moment
      // ago), which lands in the catch below and leaves the hold in place.
      await stripe.checkout.sessions.expire(session.id);
    }

    const { error: deleteError } = await supabase
      .from('checkout_holds')
      .delete()
      .eq('id', hold.id);
    if (deleteError) {
      // The session is expired either way, so the webhook's
      // `checkout.session.expired` delivery will retry this delete.
      console.error('[checkout-release] hold delete failed', { holdId, error: deleteError });
      return released(false);
    }
    return released(true);
  } catch (error: unknown) {
    console.error('[checkout-release] release failed', { holdId, error });
    return released(false);
  }
}

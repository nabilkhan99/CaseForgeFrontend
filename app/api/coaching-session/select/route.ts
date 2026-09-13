import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import { normalizeEmail } from '@/lib/commerce/referrals';
import {
  coachingSessionLabel,
  isCoachingSlotKey,
  isIsoDate,
  type CoachingSlotKey,
} from '@/lib/commerce/coachingSlots';

interface SelectBody {
  /** ISO date, e.g. "2026-11-07". */
  coachingDate?: unknown;
  /** 'morning' | 'afternoon'. */
  coachingSlot?: unknown;
}

interface SelectedSession {
  coachingDate: string;
  coachingSlot: CoachingSlotKey;
}

const SESSION_REQUIRED_MESSAGE = 'Please choose a date and time for your coaching session.';
const NO_COMPLETE_MESSAGE =
  'A coaching session comes with the Complete SCA Course. Upgrade to Complete first.';
const ALREADY_BOOKED_MESSAGE =
  'Your coaching session is already booked. Email hello@fourteenfisherman.com to move it.';
const SLOT_TAKEN_MESSAGE = 'That slot has just been booked. Please choose another.';
const SLOT_CLOSED_MESSAGE = 'Bookings for that date have closed. Please choose another.';

async function readSelection(request: Request): Promise<SelectedSession | null> {
  try {
    const body = (await request.json()) as SelectBody;
    if (!isIsoDate(body?.coachingDate) || !isCoachingSlotKey(body?.coachingSlot)) return null;
    return { coachingDate: body.coachingDate, coachingSlot: body.coachingSlot };
  } catch {
    return null;
  }
}

function conflict(code: 'already_booked' | 'slot_taken' | 'slot_closed') {
  const error =
    code === 'already_booked'
      ? ALREADY_BOOKED_MESSAGE
      : code === 'slot_taken'
        ? SLOT_TAKEN_MESSAGE
        : SLOT_CLOSED_MESSAGE;
  return NextResponse.json({ error, code }, { status: 409 });
}

/**
 * Books the one to one coaching session for a Complete customer who does not
 * have one yet.
 *
 * Why this endpoint exists: most Complete buyers choose their session before
 * paying, at checkout. A customer who moved up to Complete any other way (a plan
 * change handled by hand, a comp account) lands with a paid `complete` row and
 * no session, and picks one here afterwards.
 *
 * POST /api/coaching-session/select  { coachingDate, coachingSlot }
 *   200 { coachingDate, coachingSlot, label }
 *   401 not signed in; 403 no paid Complete order; 409 { error, code } for
 *   'already_booked' | 'slot_taken' | 'slot_closed'.
 *
 * Owner-checked and single-use: it only ever fills an EMPTY booking on a paid
 * `complete` row belonging to the signed-in account, the oldest one first. It
 * cannot move an existing booking (that is a support conversation, because
 * each slot takes one booking and someone else may want the slot being left)
 * and it cannot touch anyone else's order. The booking itself goes through
 * `book_coaching_slot_for_order`, which takes the same date lock and applies
 * the same occupancy rule as a checkout claim, so the two paths cannot both
 * sell one slot.
 */
export async function POST(request: Request) {
  const { user } = await getServerEntitlement();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const selection = await readSelection(request);
  if (!selection) {
    return NextResponse.json({ error: SESSION_REQUIRED_MESSAGE }, { status: 400 });
  }

  const email = normalizeEmail(user.email);
  const supabase = getSupabaseAdmin();

  try {
    // 1. The order this booking attaches to. Oldest first, so a customer with
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
      return NextResponse.json({ error: NO_COMPLETE_MESSAGE }, { status: 403 });
    }
    const pending = orders.find((o) => !o.coaching_day);
    if (!pending) return conflict('already_booked');

    // 2. Book it, atomically: the order row and the date row are locked, the
    //    slot is re-checked under the lock, and only an empty booking is filled.
    const { data: outcome, error: bookError } = await supabase.rpc('book_coaching_slot_for_order', {
      p_order_id: pending.id,
      p_day: selection.coachingDate,
      p_slot: selection.coachingSlot,
    });
    if (bookError) throw bookError;

    switch (outcome) {
      case 'booked':
        return NextResponse.json({
          coachingDate: selection.coachingDate,
          coachingSlot: selection.coachingSlot,
          label: coachingSessionLabel(selection.coachingDate, selection.coachingSlot),
        });
      case 'already_booked':
        // Another tab booked this order between the read above and the lock.
        return conflict('already_booked');
      case 'taken':
        return conflict('slot_taken');
      case 'closed':
        return conflict('slot_closed');
      case 'not_found':
        // The order stopped being a paid Complete one (refunded) since step 1.
        return NextResponse.json({ error: NO_COMPLETE_MESSAGE }, { status: 403 });
      case 'invalid':
        return NextResponse.json({ error: SESSION_REQUIRED_MESSAGE }, { status: 400 });
      default:
        throw new Error(`Unexpected booking outcome: ${String(outcome)}`);
    }
  } catch (error: unknown) {
    console.error('[coaching-session-select] failed', { email, selection, error });
    return NextResponse.json(
      { error: 'We could not book your coaching session. Please try again.' },
      { status: 500 },
    );
  }
}

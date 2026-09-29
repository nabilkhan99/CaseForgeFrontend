import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/guard';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { joinDetailsFromRow } from '@/lib/commerce/coachingJoin';
import { isCoachingSlotKey } from '@/lib/commerce/coachingSlots';
import { loadCoachingOrder } from '@/lib/commerce/adminCoaching';
import { sendCoachingSessionEmail } from '@/lib/email/coachingSessionEmail';

export const maxDuration = 30;

export interface AdminCoachingSendResponse {
  sentAt: string;
}

/**
 * POST: email the student their coaching confirmation and joining link.
 *
 * Only ever on an admin's explicit press (the page asks them to confirm the
 * recipient first). Re-sendable: a changed link or coach is a reason to send
 * again, and the .ics carries a stable UID so the calendar entry updates.
 *
 * The stamp is written only after Brevo accepts the message, so "Sent" on the
 * admin page never describes an email that did not go.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderId } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const row = await loadCoachingOrder(supabase, orderId);
    if (!row || !row.coaching_day) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (!isCoachingSlotKey(row.coaching_slot)) {
      return NextResponse.json(
        { error: 'This booking has no time slot, so it cannot be confirmed automatically.' },
        { status: 409 },
      );
    }

    const { meetingUrl, coachName } = joinDetailsFromRow(row);
    if (!meetingUrl || !coachName) {
      return NextResponse.json({ error: 'Save the coach and meeting link first.' }, { status: 409 });
    }

    const result = await sendCoachingSessionEmail({
      orderId: row.id,
      toEmail: row.email,
      toName: row.full_name,
      day: row.coaching_day,
      slot: row.coaching_slot,
      coachName,
      meetingUrl,
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: `The email did not send (${result.error}). Nothing was recorded; try again.` },
        { status: 502 },
      );
    }

    const sentAt = new Date().toISOString();
    const { error: stampError } = await supabase
      .from('preorders')
      .update({ coaching_details_sent_at: sentAt })
      .eq('id', row.id);
    if (stampError) {
      // The email went; only the record of it failed. Say so rather than
      // inviting a resend of something the student already has.
      console.error('[admin-coaching] sent but stamp failed', { orderId: row.id, stampError });
    }

    const body: AdminCoachingSendResponse = { sentAt };
    return NextResponse.json(body);
  } catch (error: unknown) {
    console.error('[admin-coaching] send failed', { orderId, error });
    return NextResponse.json({ error: 'Could not send the confirmation' }, { status: 500 });
  }
}

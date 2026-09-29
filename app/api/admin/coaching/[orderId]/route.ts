import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/guard';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { parseJoiningDetailsInput } from '@/lib/commerce/coachingJoin';
import {
  deriveBookings,
  LINK_FAILED_WARNING,
  loadCoachingOrder,
  type AdminCoachingBooking,
} from '@/lib/commerce/adminCoaching';
import { ensureCoachSeesStudent } from '@/lib/trainer/coachCohort';

export interface AdminCoachingSaveResponse {
  booking: AdminCoachingBooking;
  warnings: string[];
}

/**
 * PUT: set the coach and joining link for one booking, then make sure the
 * coach can see the student on their Students tab.
 *
 * The two halves are deliberately not atomic. The details are what the student
 * sees and are saved first; a failure linking the cohort is reported as a
 * warning with the details kept, because saving again is the fix and it is
 * idempotent.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderId } = await params;

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    /* parsed as empty below */
  }
  const parsed = parseJoiningDetailsInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const row = await loadCoachingOrder(supabase, orderId);
    if (!row) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const { meetingUrl, coachName, coachEmail } = parsed.value;
    const { error: updateError } = await supabase
      .from('preorders')
      .update({
        coaching_meeting_url: meetingUrl,
        coaching_coach_name: coachName,
        coaching_coach_email: coachEmail,
      })
      .eq('id', row.id);
    if (updateError) throw updateError;

    const warnings: string[] = [];
    try {
      const linked = await ensureCoachSeesStudent(supabase, {
        coachEmail,
        coachName,
        studentEmail: row.email,
      });
      warnings.push(...linked.warnings);
    } catch (error: unknown) {
      console.error('[admin-coaching] cohort link failed', { orderId: row.id, error });
      warnings.push(LINK_FAILED_WARNING);
    }

    const [booking] = await deriveBookings(supabase, [
      {
        ...row,
        coaching_meeting_url: meetingUrl,
        coaching_coach_name: coachName,
        coaching_coach_email: coachEmail,
      },
    ]);
    const response: AdminCoachingSaveResponse = { booking, warnings };
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[admin-coaching] save failed', { orderId, error });
    return NextResponse.json({ error: 'Could not save the joining details' }, { status: 500 });
  }
}

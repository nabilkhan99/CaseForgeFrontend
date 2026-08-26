import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { validatePartialAnswers } from '@/lib/trial/questionnaire';
import { leadFieldsFrom } from '@/lib/trial/leadRow';

/**
 * Save the lead while they are still answering, not once they have finished.
 *
 * `send-code` writes `trial_leads` only when the last question is answered, but
 * the email is typed on the first one. Everyone who typed an address and then
 * abandoned the questionnaire left nothing behind at all — no row, no way to
 * reach them, and a PostHog step event as the only evidence they existed. This
 * writes the row as soon as there is an address to write, and enriches it as
 * each further answer lands.
 *
 * Deliberately quiet. It never blocks the gate, never returns an error the UI
 * acts on, and never touches the verification columns — `send-code` still owns
 * the code, the throttle and `email_verified_at`, so the gate behaves exactly
 * as it did. The worst case here is that a row is not saved early, which is
 * precisely today's behaviour.
 *
 * Abuse surface is bounded by requiring a real guest session id: the write is
 * one row per existing unmarked session, not an open inbox.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown> & { sessionId?: string };
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ saved: false, reason: 'no_session' }, { status: 400 });
    }

    const parsed = validatePartialAnswers(body);
    if (!parsed.ok) {
      // Not an error worth showing: they are mid-way through typing an address.
      return NextResponse.json({ saved: false, reason: 'incomplete' }, { status: 200 });
    }
    const answers = parsed.value;

    const supabase = getSupabaseAdmin();

    const { data: session, error: sessionError } = await supabase
      .from('clinical_sessions')
      .select('id, user_id, station_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('[save-lead] session lookup failed', sessionError);
      return NextResponse.json({ saved: false, reason: 'lookup_failed' }, { status: 200 });
    }
    if (!session || session.user_id !== null) {
      return NextResponse.json({ saved: false, reason: 'not_a_guest_session' }, { status: 404 });
    }

    // Same two unique keys send-code contends with: session_id, and a unique
    // index on lower(email).
    const [{ data: leadBySession }, { data: leadByEmail }] = await Promise.all([
      supabase
        .from('trial_leads')
        .select('id, email_verified_at')
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('trial_leads')
        .select('id, session_id, email_verified_at')
        .eq('email', answers.email)
        .maybeSingle(),
    ]);

    // A verified row is someone's finished gate. Moving it to this session
    // would unverify the session it belongs to and hand this browser a report
    // it has not earned, so a partial save never touches one — send-code, which
    // knows the whole picture, decides what happens to it.
    if (leadByEmail?.email_verified_at && leadByEmail.session_id !== sessionId) {
      return NextResponse.json({ saved: false, reason: 'verified_elsewhere' }, { status: 200 });
    }
    if (leadBySession?.email_verified_at) {
      return NextResponse.json({ saved: false, reason: 'already_verified' }, { status: 200 });
    }

    const fields = leadFieldsFrom(answers, session.station_id ?? null);

    let writeError = null;
    if (leadByEmail && leadByEmail.session_id !== sessionId) {
      // An abandoned unverified attempt under this address. Move it here rather
      // than leave it blocking the unique email index, exactly as send-code does.
      if (leadBySession && leadBySession.id !== leadByEmail.id) {
        await supabase.from('trial_leads').delete().eq('id', leadBySession.id);
      }
      ({ error: writeError } = await supabase
        .from('trial_leads')
        .update({ ...fields, session_id: sessionId, email: answers.email })
        .eq('id', leadByEmail.id));
    } else if (leadBySession) {
      ({ error: writeError } = await supabase
        .from('trial_leads')
        .update({ ...fields, email: answers.email })
        .eq('id', leadBySession.id));
    } else {
      ({ error: writeError } = await supabase
        .from('trial_leads')
        .insert({ ...fields, session_id: sessionId, email: answers.email }));
    }

    if (writeError) {
      // Logged, not surfaced. A lead we failed to save early is today's
      // behaviour; a gate that errors because of it would be worse than that.
      console.error('[save-lead] write failed', writeError);
      return NextResponse.json({ saved: false, reason: 'write_failed' }, { status: 200 });
    }

    return NextResponse.json({ saved: true }, { status: 200 });
  } catch (error: unknown) {
    console.error('[save-lead] unexpected error', error);
    return NextResponse.json({ saved: false, reason: 'error' }, { status: 200 });
  }
}

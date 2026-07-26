import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendVerificationEmail } from '@/lib/email/verificationEmail';
import { validateAnswers } from '@/lib/trial/questionnaire';
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_SECONDS,
  generateVerificationCode,
  hashVerificationCode,
} from '@/lib/trial/verification';

/**
 * State 1 of the trial feedback gate: records the lead's details against
 * their guest session and emails them a 6-digit verification code.
 * Re-submitting (resend, or an edited email) replaces the previous code,
 * invalidating it; resends are throttled per session.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown> & { sessionId?: string };
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'A valid session is required' }, { status: 400 });
    }

    // Same validator the form uses, so the allowlists cannot drift and a
    // hand-rolled POST cannot write values outside the published options.
    const parsed = validateAnswers(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const answers = parsed.value;
    const normalizedEmail = answers.email;

    const supabase = getSupabaseAdmin();

    // The session must exist and be a guest trial session.
    const { data: session, error: sessionError } = await supabase
      .from('clinical_sessions')
      .select('id, user_id, station_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error('[send-code] session lookup failed', sessionError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }
    if (!session || session.user_id !== null) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // trial_leads carries TWO unique keys: session_id, and a unique index on
    // lower(email). A returning visitor arrives with a fresh session but a
    // known email, so upserting on session_id alone tried to INSERT and tripped
    // the email index — a 500 that dead-ended someone who had just spent 12
    // minutes on a consultation. One lead per person is the intent, so the
    // existing row is found and moved to the new session instead.
    const [{ data: leadBySession }, { data: leadByEmail }] = await Promise.all([
      supabase
        .from('trial_leads')
        .select('id, verification_last_sent_at')
        .eq('session_id', sessionId)
        .maybeSingle(),
      supabase
        .from('trial_leads')
        .select('id, session_id, verification_last_sent_at')
        .eq('email', normalizedEmail)
        .maybeSingle(),
    ]);

    // A repeat email is NOT refused here. By this point the consultation has
    // already happened, so refusing only withholds a report the person has
    // earned — it prevents nothing. The one-free-station limit belongs before
    // the 12 minutes are spent, and can only be enforced per-browser anyway
    // (create-session cannot know who they are: the email is collected after
    // the consultation, not before it). So the lead row is reused and moved to
    // this session; the marketing dedupe of one row per address still holds.

    // Throttle against whichever row this send will actually write.
    const existingLead = leadByEmail ?? leadBySession;

    if (existingLead?.verification_last_sent_at) {
      const elapsedMs = Date.now() - new Date(existingLead.verification_last_sent_at).getTime();
      const remaining = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
      if (remaining > 0) {
        return NextResponse.json(
          { error: 'Please wait before requesting another code', retryAfter: remaining },
          { status: 429 },
        );
      }
    }

    const code = generateVerificationCode();
    const now = new Date();

    const leadRow = {
      session_id: sessionId,
      station_id: session.station_id ?? null,
      email: normalizedEmail,
      first_name: answers.firstName,
      training_stage: answers.trainingStage,
      training_start_month: answers.trainingStartMonth || null,
      training_start_year: answers.trainingStartYear || null,
      akt_status: answers.aktStatus || null,
      akt_sitting: answers.aktSitting || null,
      sca_status: answers.scaStatus || null,
      sca_sitting: answers.scaSitting || null,
      not_in_training_role: answers.notInTrainingRole || null,
      expected_start_month: answers.expectedStartMonth || null,
      expected_start_year: answers.expectedStartYear || null,
      verification_code_hash: hashVerificationCode(code, normalizedEmail),
      verification_expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
      verification_attempts: 0,
      verification_last_sent_at: now.toISOString(),
      email_verified_at: null,
    };

    let upsertError = null;
    if (leadByEmail && leadByEmail.session_id !== sessionId) {
      // Only unverified rows reach here — a verified one was turned away above.
      // This is an abandoned attempt (details entered, code never confirmed),
      // so it is moved to the current session rather than left to block the
      // person behind the unique email index.
      if (leadBySession && leadBySession.id !== leadByEmail.id) {
        await supabase.from('trial_leads').delete().eq('id', leadBySession.id);
      }
      ({ error: upsertError } = await supabase
        .from('trial_leads')
        .update(leadRow)
        .eq('id', leadByEmail.id));
    } else {
      ({ error: upsertError } = await supabase
        .from('trial_leads')
        .upsert(leadRow, { onConflict: 'session_id' }));
    }

    if (upsertError) {
      console.error('[send-code] lead upsert failed', upsertError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }

    const emailResult = await sendVerificationEmail({
      toEmail: normalizedEmail,
      firstName: answers.firstName,
      code,
    });
    if (!emailResult.sent) {
      // Undo the throttle stamp so a failed send can be retried immediately.
      await supabase
        .from('trial_leads')
        .update({ verification_last_sent_at: null, verification_code_hash: null })
        .eq('session_id', sessionId);
      return NextResponse.json(
        { error: "We couldn't send the code — check the address and try again" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, resendCooldown: RESEND_COOLDOWN_SECONDS });
  } catch (error: unknown) {
    console.error('[send-code] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}

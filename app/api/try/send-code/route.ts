import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendVerificationEmail } from '@/lib/email/verificationEmail';
import { SCA_SIT_DATES, TRAINING_STAGES, findOption } from '@/lib/trial/leadFields';
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_SECONDS,
  generateVerificationCode,
  hashVerificationCode,
} from '@/lib/trial/verification';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LENGTH = 60;

/**
 * State 1 of the trial feedback gate: records the lead's details against
 * their guest session and emails them a 6-digit verification code.
 * Re-submitting (resend, or an edited email) replaces the previous code,
 * invalidating it; resends are throttled per session.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, email, firstName, trainingStage, scaSitDate } = (await req.json()) as {
      sessionId?: string;
      email?: string;
      firstName?: string;
      trainingStage?: string;
      scaSitDate?: string;
    };

    const normalizedEmail = email?.trim().toLowerCase() ?? '';
    if (!sessionId || !EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }
    const name = firstName?.trim() ?? '';
    if (!name || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: 'Please enter your first name' }, { status: 400 });
    }
    const stage = findOption(TRAINING_STAGES, trainingStage);
    if (!stage) {
      return NextResponse.json({ error: 'Please select your stage of training' }, { status: 400 });
    }
    const sitDate = findOption(SCA_SIT_DATES, scaSitDate);
    if (!sitDate) {
      return NextResponse.json(
        { error: 'Please select when you plan to sit the SCA' },
        { status: 400 },
      );
    }

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

    // Resend throttle, per session.
    const { data: existingLead } = await supabase
      .from('trial_leads')
      .select('verification_last_sent_at')
      .eq('session_id', sessionId)
      .maybeSingle();

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

    const { error: upsertError } = await supabase.from('trial_leads').upsert(
      {
        session_id: sessionId,
        station_id: session.station_id ?? null,
        email: normalizedEmail,
        first_name: name,
        training_stage: stage.value,
        sca_sit_date: sitDate.value,
        verification_code_hash: hashVerificationCode(code, normalizedEmail),
        verification_expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
        verification_attempts: 0,
        verification_last_sent_at: now.toISOString(),
        email_verified_at: null,
      },
      { onConflict: 'session_id' },
    );

    if (upsertError) {
      console.error('[send-code] lead upsert failed', upsertError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }

    const emailResult = await sendVerificationEmail({
      toEmail: normalizedEmail,
      firstName: name,
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

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendVerificationSms } from '@/lib/sms/verificationSms';
import { sendGateLeadAlert } from '@/lib/trial/gateLeadAlert';
import { toE164 } from '@/lib/trial/phone';
import { isValidPhone } from '@/lib/trial/questionnaire';
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_SECONDS,
  generateVerificationCode,
  hashVerificationCode,
} from '@/lib/trial/verification';

/**
 * State 3 of the trial gate: texts a 6-digit code to the lead's phone.
 * Only reachable once the email is verified. Accepts an optional replacement
 * phone (the "wrong number?" edit) before verification.
 *
 * Fail-open by design: if the SMS cannot be sent (no Brevo SMS credits,
 * provider outage), the report must still unlock — the lead has earned it —
 * so the step is marked skipped, the founder alert goes out flagged
 * "unverified", and the client is told to proceed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { sessionId?: string; phone?: string };
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'A valid session is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: lead, error: leadError } = await supabase
      .from('trial_leads')
      .select(
        'id, email, first_name, phone, training_stage, sca_sitting, sca_sit_date, station_id, email_verified_at, phone_verified_at, phone_verification_last_sent_at',
      )
      .eq('session_id', sessionId)
      .maybeSingle();

    if (leadError) {
      console.error('[send-phone-code] lead lookup failed', leadError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }
    if (!lead || !lead.email_verified_at) {
      return NextResponse.json({ error: 'Verify your email first' }, { status: 403 });
    }
    if (lead.phone_verified_at) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    // "Wrong number?" edit — replace the phone before a code is confirmed.
    let phone = lead.phone;
    if (typeof body.phone === 'string' && body.phone.trim()) {
      if (!isValidPhone(body.phone)) {
        return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
      }
      phone = toE164(body.phone) ?? phone;
    }
    const e164 = phone ? toE164(phone) : null;
    if (!e164) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
    }

    // SMS-pumping guard: codes are only ever texted to UK numbers. A rare
    // non-UK trainee isn't blocked from their report — they take the
    // fail-open path below and the founder alert flags the number unverified.
    if (!e164.startsWith('+44')) {
      await supabase
        .from('trial_leads')
        .update({ phone: e164, phone_verification_skipped_at: new Date().toISOString() })
        .eq('id', lead.id);
      await sendGateLeadAlert(supabase, sessionId, { ...lead, phone: e164 }, false);
      return NextResponse.json({ ok: true, smsUnavailable: true });
    }

    if (lead.phone_verification_last_sent_at) {
      const elapsedMs = Date.now() - new Date(lead.phone_verification_last_sent_at).getTime();
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
    const { error: updateError } = await supabase
      .from('trial_leads')
      .update({
        phone: e164,
        phone_verification_code_hash: hashVerificationCode(code, e164),
        phone_verification_expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
        phone_verification_attempts: 0,
        phone_verification_last_sent_at: now.toISOString(),
      })
      .eq('id', lead.id);

    if (updateError) {
      console.error('[send-phone-code] update failed', updateError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }

    const smsResult = await sendVerificationSms({ toPhone: e164, code });
    if (!smsResult.sent) {
      // Fail open: never hold the report hostage to an SMS provider.
      console.error('[send-phone-code] SMS send failed — failing open', {
        sessionId,
        error: smsResult.error ?? smsResult.skipped,
      });
      await supabase
        .from('trial_leads')
        .update({
          phone_verification_code_hash: null,
          phone_verification_expires_at: null,
          phone_verification_last_sent_at: null,
          phone_verification_skipped_at: now.toISOString(),
        })
        .eq('id', lead.id);
      await sendGateLeadAlert(supabase, sessionId, { ...lead, phone: e164 }, false);
      return NextResponse.json({ ok: true, smsUnavailable: true });
    }

    return NextResponse.json({ ok: true, resendCooldown: RESEND_COOLDOWN_SECONDS, phone: e164 });
  } catch (error: unknown) {
    console.error('[send-phone-code] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}

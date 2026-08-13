import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { sendGateLeadAlert } from '@/lib/trial/gateLeadAlert';
import {
  CODE_LENGTH,
  MAX_VERIFY_ATTEMPTS,
  verificationCodeMatches,
} from '@/lib/trial/verification';

/**
 * Final state of the trial gate: checks the SMS code from
 * /api/try/send-phone-code. On success the phone is marked verified and the
 * founder lead alert goes out — only numbers that received a code reach it.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, code } = (await req.json()) as {
      sessionId?: string;
      code?: string;
    };

    const trimmedCode = code?.trim() ?? '';
    if (!sessionId || !new RegExp(`^\\d{${CODE_LENGTH}}$`).test(trimmedCode)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: lead, error: leadError } = await supabase
      .from('trial_leads')
      .select(
        'id, email, first_name, phone, training_stage, sca_sitting, sca_sit_date, station_id, email_verified_at, phone_verified_at, phone_verification_code_hash, phone_verification_expires_at, phone_verification_attempts',
      )
      .eq('session_id', sessionId)
      .maybeSingle();

    if (leadError) {
      console.error('[verify-phone-code] lead lookup failed', leadError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }
    if (!lead || !lead.email_verified_at) {
      return NextResponse.json({ error: 'Verify your email first' }, { status: 403 });
    }
    if (lead.phone_verified_at) {
      return NextResponse.json({ ok: true });
    }
    if (!lead.phone || !lead.phone_verification_code_hash || !lead.phone_verification_expires_at) {
      return NextResponse.json({ error: 'Request a new code' }, { status: 410 });
    }
    if (new Date(lead.phone_verification_expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'That code has expired — resend a new one' },
        { status: 410 },
      );
    }
    if (lead.phone_verification_attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many attempts — resend a new code' },
        { status: 429 },
      );
    }

    if (!verificationCodeMatches(trimmedCode, lead.phone, lead.phone_verification_code_hash)) {
      await supabase
        .from('trial_leads')
        .update({ phone_verification_attempts: lead.phone_verification_attempts + 1 })
        .eq('id', lead.id);
      const remaining = MAX_VERIFY_ATTEMPTS - lead.phone_verification_attempts - 1;
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? "That code isn't right — check the text and try again"
              : 'Too many attempts — resend a new code',
        },
        { status: 401 },
      );
    }

    const { error: updateError } = await supabase
      .from('trial_leads')
      .update({
        phone_verified_at: new Date().toISOString(),
        phone_verification_code_hash: null,
        phone_verification_expires_at: null,
      })
      .eq('id', lead.id);

    if (updateError) {
      console.error('[verify-phone-code] verified update failed', updateError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }

    await sendGateLeadAlert(supabase, sessionId, lead, true);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[verify-phone-code] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}

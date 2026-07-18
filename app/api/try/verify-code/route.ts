import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { pushTrialLeadToBrevo } from '@/lib/marketing/trialLead';
import { SCA_SIT_DATES, TRAINING_STAGES, findOption } from '@/lib/trial/leadFields';
import {
  CODE_LENGTH,
  MAX_VERIFY_ATTEMPTS,
  verificationCodeMatches,
} from '@/lib/trial/verification';

/**
 * State 2 of the trial feedback gate: checks the 6-digit code against the
 * lead recorded by /api/try/send-code. On success the lead is marked
 * verified and pushed to Brevo — only verified addresses reach the list.
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
        'id, email, first_name, training_stage, sca_sit_date, station_id, verification_code_hash, verification_expires_at, verification_attempts, email_verified_at',
      )
      .eq('session_id', sessionId)
      .maybeSingle();

    if (leadError) {
      console.error('[verify-code] lead lookup failed', leadError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }
    if (!lead) {
      return NextResponse.json({ error: 'Request a code first' }, { status: 404 });
    }
    if (lead.email_verified_at) {
      return NextResponse.json({ ok: true });
    }
    if (!lead.verification_code_hash || !lead.verification_expires_at) {
      return NextResponse.json({ error: 'Request a new code' }, { status: 410 });
    }
    if (new Date(lead.verification_expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'That code has expired — resend a new one' },
        { status: 410 },
      );
    }
    if (lead.verification_attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many attempts — resend a new code' },
        { status: 429 },
      );
    }

    if (!verificationCodeMatches(trimmedCode, lead.email, lead.verification_code_hash)) {
      await supabase
        .from('trial_leads')
        .update({ verification_attempts: lead.verification_attempts + 1 })
        .eq('id', lead.id);
      const remaining = MAX_VERIFY_ATTEMPTS - lead.verification_attempts - 1;
      return NextResponse.json(
        {
          error:
            remaining > 0
              ? "That code isn't right — check the email and try again"
              : 'Too many attempts — resend a new code',
        },
        { status: 401 },
      );
    }

    const { error: updateError } = await supabase
      .from('trial_leads')
      .update({
        email_verified_at: new Date().toISOString(),
        verification_code_hash: null,
        verification_expires_at: null,
      })
      .eq('id', lead.id);

    if (updateError) {
      console.error('[verify-code] verified update failed', updateError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }

    // Only verified leads reach the marketing list.
    let stationTitle: string | null = null;
    if (lead.station_id) {
      const { data: station } = await supabase
        .from('stations')
        .select('title')
        .eq('id', lead.station_id)
        .maybeSingle();
      stationTitle = station?.title ?? null;
    }
    await pushTrialLeadToBrevo({
      email: lead.email,
      firstName: lead.first_name,
      stationTitle,
      score: null,
      trainingStage: findOption(TRAINING_STAGES, lead.training_stage)?.label ?? lead.training_stage,
      scaSitDate: findOption(SCA_SIT_DATES, lead.sca_sit_date)?.label ?? lead.sca_sit_date,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[verify-code] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}

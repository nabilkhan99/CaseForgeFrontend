import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { pushTrialLeadToBrevo } from '@/lib/marketing/trialLead';
import { ensureTrialAccount } from '@/lib/auth/trialAccount';
import type { TrialSource, TrialState } from '@/lib/commerce/trialAccess';
import {
  AKT_TARGETS,
  EXAM_STATUSES,
  MONTHS,
  NOT_IN_TRAINING_ROLES,
  SCA_TARGETS,
  TRAINING_STAGES,
  findOption,
} from '@/lib/trial/leadFields';
import {
  CODE_LENGTH,
  MAX_VERIFY_ATTEMPTS,
  verificationCodeMatches,
} from '@/lib/trial/verification';

/**
 * State 2 of the trial gate: checks the 6-digit code against the lead recorded
 * by /api/try/send-code — and then turns that verified address into an account
 * with five stations on it.
 *
 * ## Two doors, one verification
 *
 * `sessionId` = the GUEST reveal: they have just sat a consultation and are
 * unlocking their report. The grant is recorded as `guest_reveal`.
 * `email` alone = the SIGN-UP door on /free, where there is no consultation
 * yet. The grant is recorded as `signup`.
 *
 * ## Why the account is created HERE
 *
 * This is the only moment in the funnel where an address is PROVEN — they typed
 * a code we sent to it. Everything the account gives them (the claim on their
 * guest consultation, the grant, the dashboard) rests on that proof, so doing
 * it anywhere else would either happen before the proof or need a second round
 * trip after it. The three writes are each idempotent, so a retried verify
 * repeats them harmlessly — see lib/auth/trialAccount.
 *
 * Provisioning failure is NOT fatal to this request. The code was right, the
 * lead is verified, and the guest reveal must still open the report they earned;
 * `account: null` says "no account happened" and the caller falls back to the
 * report-only path.
 *
 * ⚠️ This route never routes through /auth/sign-up, which the middleware keeps
 * shut behind SIGNUP_INVITE_CODE. It provisions server-side with the service
 * role, so that gate stays exactly as closed as it was.
 */

/** What the caller needs to sign the new trialist in. Null when provisioning failed. */
export interface TrialVerifyAccount {
  userId: string;
  /** We created the auth user on this call. False for a returning address. */
  created: boolean;
  /**
   * A one-time URL that leaves the browser signed in and lands on /dashboard,
   * on any device. Null only when minting it failed — the account and the grant
   * are still real, and every trial email carries the same kind of link.
   */
  signInUrl: string | null;
}

export interface TrialVerifyTrial {
  state: TrialState;
  /** A grant is now in the table for this account — new, or already there. */
  granted: boolean;
}

interface VerifyResponse {
  ok: true;
  account: TrialVerifyAccount | null;
  trial: TrialVerifyTrial;
}

const NO_TRIAL_RESPONSE: TrialVerifyTrial = { state: 'none', granted: false };

/** The lead columns both doors read. */
const LEAD_COLUMNS =
  'id, email, first_name, phone, training_stage, sca_sit_date, training_start_month, training_start_year, akt_status, akt_sitting, sca_status, sca_sitting, not_in_training_role, station_id, verification_code_hash, verification_expires_at, verification_attempts, email_verified_at';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, email, code } = (await req.json()) as {
      sessionId?: string;
      email?: string;
      code?: string;
    };

    const trimmedCode = code?.trim() ?? '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    // One of the two identifies the lead. `sessionId` wins when both arrive, so
    // a guest reveal is never re-pointed at another address by a stray field.
    if ((!sessionId && !normalizedEmail) || !new RegExp(`^\\d{${CODE_LENGTH}}$`).test(trimmedCode)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });
    }

    const source: TrialSource = sessionId ? 'guest_reveal' : 'signup';

    const supabase = getSupabaseAdmin();

    const query = supabase.from('trial_leads').select(LEAD_COLUMNS);
    const { data: lead, error: leadError } = await (sessionId
      ? query.eq('session_id', sessionId)
      : query.eq('email', normalizedEmail)
    ).maybeSingle();

    if (leadError) {
      console.error('[verify-code] lead lookup failed', leadError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }
    if (!lead) {
      return NextResponse.json({ error: 'Request a code first' }, { status: 404 });
    }
    if (lead.email_verified_at) {
      // Already verified — the code step is done, but the account work may not
      // be (a reload, a second tab, or a lead verified before this shipped). It
      // is idempotent, so run it rather than returning a bare ok that would
      // strand them without a grant.
      return NextResponse.json(
        await settleTrialAccount(lead.email, lead.first_name, source),
      );
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
    // AKT_TARGETS / SCA_TARGETS are supersets of the booked lists, so one
    // lookup resolves both the "aiming for" and "booked onto" answers.
    const scaSittingLabel = findOption(SCA_TARGETS, lead.sca_sitting)?.label ?? null;
    const startMonth = findOption(MONTHS, lead.training_start_month)?.label ?? null;
    const gpStartLabel =
      startMonth && lead.training_start_year
        ? `${startMonth} ${lead.training_start_year}`
        : null;

    await pushTrialLeadToBrevo({
      email: lead.email,
      firstName: lead.first_name,
      phone: lead.phone,
      stationTitle,
      score: null,
      trainingStage: findOption(TRAINING_STAGES, lead.training_stage)?.label ?? lead.training_stage,
      // SCA_SIT_DATE stays populated (now from the questionnaire's sitting
      // answer) so existing Brevo segments keep working.
      scaSitDate: scaSittingLabel ?? lead.sca_sit_date,
      aktStatus: findOption(EXAM_STATUSES, lead.akt_status)?.label ?? null,
      aktSitting: findOption(AKT_TARGETS, lead.akt_sitting)?.label ?? null,
      scaStatus: findOption(EXAM_STATUSES, lead.sca_status)?.label ?? null,
      scaSitting: scaSittingLabel,
      gpTrainingStart: gpStartLabel,
      notInTrainingRole:
        findOption(NOT_IN_TRAINING_ROLES, lead.not_in_training_role)?.label ?? null,
    });

    // The founder lead alert now fires from the phone-verification step
    // (verify-phone-code, or send-phone-code's fail-open path) so it only
    // ever carries a number that has actually received a text.

    return NextResponse.json(await settleTrialAccount(lead.email, lead.first_name, source));
  } catch (error: unknown) {
    console.error('[verify-code] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}

/**
 * Account, claim, grant, sign-in link — and the body the caller reads them off.
 *
 * Its own function because both exits above need it: the freshly-verified path
 * and the already-verified reload. Never throws; a failure here still answers
 * `ok: true`, because the code WAS right and that is what the caller asked.
 */
async function settleTrialAccount(
  email: string,
  firstName: string | null,
  source: TrialSource,
): Promise<VerifyResponse> {
  try {
    const ensured = await ensureTrialAccount(getSupabaseAdmin(), { email, firstName, source });
    return {
      ok: true,
      account: ensured.userId
        ? { userId: ensured.userId, created: ensured.created, signInUrl: ensured.signInUrl }
        : null,
      trial: { state: ensured.state, granted: ensured.granted },
    };
  } catch (error: unknown) {
    console.error('[verify-code] account provisioning threw', error);
    return { ok: true, account: null, trial: NO_TRIAL_RESPONSE };
  }
}

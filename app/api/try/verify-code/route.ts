import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { pushTrialLeadToBrevo } from '@/lib/marketing/trialLead';
import { signInWithMagicLink } from '@/lib/auth/accountSignUp';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/passwordPolicy';
import { ensureTrialAccount } from '@/lib/auth/trialAccount';
import { toE164 } from '@/lib/trial/phone';
import { GUEST_COOKIE, cookieOwnsSession, readGuestCookie } from '@/lib/trial/guestSession';
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
 * State 2 of the code step: checks the 6 digits against the lead recorded by
 * /api/try/send-code — and then turns that verified address into an account
 * with five stations on it, SIGNED IN, on this same response.
 *
 * ## Two doors, one verification
 *
 * `sessionId` = the GUEST reveal: a consultation was sat before there was an
 * account, and this turns it into one. Recorded as `guest_reveal`.
 * `email` (+ a `password` from /free/start) = the ACCOUNT-FIRST door, where
 * there is no consultation yet. Recorded as `signup`.
 *
 * ## Why a guest may set a password, and only sometimes (contract C3)
 *
 * A bare session id proves nothing — it is a UUID in a URL, and the guest
 * report has always been readable by whoever holds it. A `password` arriving
 * with one could therefore be a field nobody typed, on somebody else's
 * consultation. What DOES prove this browser ran the consultation is the signed
 * httpOnly `ff_guest` cookie the server wrote when it opened the session
 * (lib/trial/guestSession), so `password` and `phone` are honoured on the guest
 * branch exactly when {@link cookieOwnsSession} says that cookie carries this
 * session id, and ignored otherwise. With the proof, the account is born with
 * the password (no `password_pending`, no trip to /auth/set-password), the
 * mobile is stored, and the five-day window starts FROM THE CONSULTATION rather
 * than from whenever they next open a station. Without it, the branch does
 * exactly what it did before.
 *
 * ## Why the account is created HERE
 *
 * This is the only moment in the funnel where an address is PROVEN — they typed
 * a code we sent to it. Everything the account gives them (the claim on any
 * guest consultation, the grant, the dashboard) rests on that proof, so doing it
 * anywhere else would either happen before the proof or need a second round trip
 * after it. The writes are each idempotent, so a retried verify repeats them
 * harmlessly — see lib/auth/trialAccount.
 *
 * ## Why the SIGN-IN is here too, and no email is sent
 *
 * A route handler may write cookies, so the session is established inside this
 * request (lib/auth/accountSignUp) and the browser navigates to `redirectTo`
 * already signed in. The old shape mailed a one-time link and asked people to
 * go and find it — a second inbox trip immediately after the first one, at the
 * exact moment they were ready to talk to a patient. Nothing on this path sends
 * mail of any kind, and nothing sends an SMS: the mobile is stored, never texted.
 *
 * Provisioning failure is NOT fatal to this request. The code was right, the
 * lead is verified, and the guest reveal must still open the report they earned;
 * `account: null` says "no account happened" and the caller falls back.
 *
 * ⚠️ This route never routes through /auth/sign-up, which the middleware keeps
 * shut behind SIGNUP_INVITE_CODE. It provisions server-side with the service
 * role, so that gate stays exactly as closed as it was.
 */

/** Where a trainee lands when no station was carried through the flow. */
const DASHBOARD = '/dashboard';

/**
 * A station id, or nothing.
 *
 * `redirectTo` is composed from a client-supplied value, so it is rebuilt from a
 * matched uuid rather than interpolated — anything else and "carry the station
 * through the sign-up" would be an open redirect with a friendly name.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function redirectFor(station: unknown): string {
  const value = typeof station === 'string' ? station.trim() : '';
  return UUID_RE.test(value) ? `/clinical-master/station/${value.toLowerCase()}` : DASHBOARD;
}

/**
 * The report of the consultation they have just sat, inside the dashboard.
 *
 * Only for a proven guest: the claim has just made the session theirs and the
 * cookies on this response sign them in, so the dashboard's own ownership check
 * passes. Rebuilt from a matched uuid for the same reason {@link redirectFor}
 * is — the id came off the request.
 */
function reportFor(sessionId: string): string {
  return UUID_RE.test(sessionId)
    ? `/clinical-master/feedback/${sessionId.toLowerCase()}`
    : DASHBOARD;
}

/** What the caller needs to know about the account. Null when provisioning failed. */
export interface TrialVerifyAccount {
  userId: string;
  /** We created the auth user on this call. False for a returning address. */
  created: boolean;
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
  /** This response carries session cookies. False leaves the caller a sign-in path. */
  signedIn: boolean;
  /** Where to go next: the station they picked, or the dashboard. */
  redirectTo: string;
}

const NO_TRIAL_RESPONSE: TrialVerifyTrial = { state: 'none', granted: false };

/** The lead columns both doors read. */
const LEAD_COLUMNS =
  'id, email, first_name, phone, training_stage, sca_sit_date, training_start_month, training_start_year, akt_status, akt_sitting, sca_status, sca_sitting, not_in_training_role, station_id, verification_code_hash, verification_expires_at, verification_attempts, email_verified_at';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      email?: string;
      code?: string;
      password?: string;
      phone?: string;
      station?: string;
    };
    const { sessionId, email, code } = body;

    const trimmedCode = code?.trim() ?? '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    // One of the two identifies the lead. `sessionId` wins when both arrive, so
    // a guest reveal is never re-pointed at another address by a stray field.
    if ((!sessionId && !normalizedEmail) || !new RegExp(`^\\d{${CODE_LENGTH}}$`).test(trimmedCode)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });
    }

    const source: TrialSource = sessionId ? 'guest_reveal' : 'signup';

    // Contract C3's proof: the signed cookie this server wrote when it opened
    // the consultation carries this session id, so this browser is the one that
    // sat it. Forged, absent, or holding a different session — all the same
    // answer, and all of them fall back to the branch as it was.
    const guestProven =
      Boolean(sessionId) &&
      cookieOwnsSession(readGuestCookie(req.cookies?.get(GUEST_COOKIE)?.value), sessionId ?? '');

    // The account-first door always may; the guest door only with the proof
    // above. Everything else gets neither field, whatever it sends.
    const mayCollect = source === 'signup' || guestProven;
    const password = mayCollect && typeof body.password === 'string' ? body.password : '';
    const phone = mayCollect && typeof body.phone === 'string' ? body.phone.trim() : '';
    // E.164 where we can parse one, so the founder's call works straight off
    // the row and the auth user's metadata carries the same string the lead
    // does. NOTHING TEXTS IT — there is no SMS step on either door.
    const normalizedPhone = phone ? (toE164(phone) ?? phone) : '';

    // A proven guest goes straight to the report of the consultation they just
    // sat; everyone else to the station they carried, or the dashboard.
    const redirectTo = guestProven ? reportFor(sessionId ?? '') : redirectFor(body.station);
    if (password && password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Use ${MIN_PASSWORD_LENGTH} characters or more` },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const found = await (sessionId
      ? supabase.from('trial_leads').select(LEAD_COLUMNS).eq('session_id', sessionId)
      : supabase.from('trial_leads').select(LEAD_COLUMNS).eq('email', normalizedEmail)
    ).maybeSingle();
    let lead = found.data;
    let leadError = found.error;

    // A returning trainee's SECOND guest consultation has no lead pointing at
    // it. `send-code` leaves a verified lead on the session it was verified
    // against — re-pointing it would disown that first consultation — so the row
    // has to be found by address instead.
    //
    // Only behind the cookie proof, and only when the session lookup found
    // nothing. With the proof this request comes from the browser that ran the
    // consultation, which is the same standing the account-first door has when
    // it verifies an address and a code together; without it, a bare session id
    // still cannot reach any lead but its own.
    if (!leadError && !lead && sessionId && guestProven && normalizedEmail) {
      const byEmail = await supabase
        .from('trial_leads')
        .select(LEAD_COLUMNS)
        .eq('email', normalizedEmail)
        .maybeSingle();
      lead = byEmail.data;
      leadError = byEmail.error;
    }

    if (leadError) {
      console.error('[verify-code] lead lookup failed', leadError);
      return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
    }
    if (!lead) {
      return NextResponse.json({ error: 'Request a code first' }, { status: 404 });
    }
    // ⚠️ THE CODE IS CHECKED FIRST, ALWAYS — including for a lead that is
    // already verified.
    //
    // The already-verified shortcut used to sit above this block and return
    // `settleTrialAccount` without ever comparing the digits. That was survivable
    // while the branch only re-granted a trial; since contract C3 it provisions a
    // PASSWORD and signs the caller in, so an unchecked path meant anyone holding
    // a verified lead's session id (or, on the other door, their address) could
    // set a password on their account and walk into it. Whatever the row says,
    // this request has to prove it knows the code.
    if (!lead.verification_code_hash || !lead.verification_expires_at) {
      // A verified lead with nothing pending lands here too: there is no code to
      // check, so there is nothing to accept. `send-code` issues a fresh one.
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

    // The code was right. NOW an already-verified lead can be settled — the
    // account work may still be outstanding (a reload, a second tab, a lead
    // verified before any of this shipped), and every step of it is idempotent,
    // so running it again is safer than a bare ok that strands a trialist
    // without a grant or a session. The pending code is deliberately left in
    // place: it is what makes a double-submit of the SAME still-valid code work,
    // and clearing it would answer the second one with a 410.
    if (lead.email_verified_at) {
      return NextResponse.json(
        await settleTrialAccount({
          email: lead.email,
          firstName: lead.first_name,
          source,
          password,
          phone: normalizedPhone,
          redirectTo,
          windowSessionId: guestProven ? (sessionId ?? null) : null,
          claimSessionId: guestProven ? (sessionId ?? null) : null,
        }),
      );
    }

    // The mobile rides along with the verification, on the row this product
    // already keeps its leads in.
    const storedPhone = normalizedPhone || null;

    const { error: updateError } = await supabase
      .from('trial_leads')
      .update({
        email_verified_at: new Date().toISOString(),
        verification_code_hash: null,
        verification_expires_at: null,
        // Only when they gave one: blanking a number we already hold would cost
        // the founder the call they were going to make.
        ...(storedPhone ? { phone: storedPhone } : {}),
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
      phone: storedPhone ?? lead.phone,
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

    return NextResponse.json(
      await settleTrialAccount({
        email: lead.email,
        firstName: lead.first_name,
        source,
        password,
        phone: storedPhone ?? '',
        redirectTo,
        windowSessionId: guestProven ? (sessionId ?? null) : null,
        claimSessionId: guestProven ? (sessionId ?? null) : null,
      }),
    );
  } catch (error: unknown) {
    console.error('[verify-code] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }
}

interface SettleInput {
  email: string;
  firstName: string | null;
  source: TrialSource;
  /** Empty on every door but the account-first form. */
  password: string;
  /** E.164 where we could parse it, else what they typed. Empty when none. */
  phone: string;
  redirectTo: string;
  /**
   * The consultation whose `started_at` the five days should run from, or null
   * to leave the clock for the first station they open.
   *
   * Only ever set for a guest whose cookie proved the session is theirs — see
   * the C3 note at the top. Null on the account-first door, which has no
   * consultation to date the window from.
   */
  windowSessionId: string | null;
  /**
   * The consultation to attach to the account by id, on top of whatever the
   * leads table links to this address.
   *
   * A returning trainee's second guest consultation is not named by any lead —
   * `send-code` keeps a verified lead on the session it verified against — so
   * without this it would stay ownerless and invisible from the dashboard.
   * Set only for a proven guest, and the claim still refuses a session that
   * already has an owner.
   */
  claimSessionId: string | null;
}

/**
 * When the consultation began, for the window stamp.
 *
 * Falls back to NOW rather than to "do not start the clock": a proven guest has
 * just finished a consultation, so the five days have to begin, and a row we
 * could not read is a reason to be a few minutes generous, not to hand out a
 * trial that never ends.
 *
 * A `started_at` in the future is treated as now for the same reason — the only
 * way to get one is a clock skew, and honouring it would push the expiry out.
 */
async function consultationStart(sessionId: string): Promise<Date> {
  const now = new Date();
  try {
    const { data } = await getSupabaseAdmin()
      .from('clinical_sessions')
      .select('started_at')
      .eq('id', sessionId)
      .maybeSingle();
    const parsed = data?.started_at ? Date.parse(data.started_at) : NaN;
    if (!Number.isFinite(parsed) || parsed > now.getTime()) return now;
    return new Date(parsed);
  } catch (error: unknown) {
    console.error('[verify-code] could not read the consultation start', error);
    return now;
  }
}

/**
 * Account, claim, grant, clock, session — and the body the caller reads them off.
 *
 * Its own function because both exits above need it: the freshly-verified path
 * and the already-verified reload. Never throws; a failure here still answers
 * `ok: true`, because the code WAS right and that is what the caller asked.
 *
 * `mintSignIn: false` on purpose. The session is established here, and minting a
 * recovery token as well would rotate a credential nobody is going to use.
 */
async function settleTrialAccount(input: SettleInput): Promise<VerifyResponse> {
  try {
    const windowStartsAt = input.windowSessionId
      ? await consultationStart(input.windowSessionId)
      : null;

    const ensured = await ensureTrialAccount(getSupabaseAdmin(), {
      email: input.email,
      firstName: input.firstName,
      source: input.source,
      password: input.password || null,
      phone: input.phone || null,
      mintSignIn: false,
      windowStartsAt,
      claimSessionId: input.claimSessionId,
    });

    // Only for an account that exists: signing in an address with nothing behind
    // it is not a thing GoTrue can do, and asking would only log a confusing
    // error over a failure the caller already knows about from `account: null`.
    const signedIn = ensured.userId ? await signInWithMagicLink(input.email) : false;

    return {
      ok: true,
      account: ensured.userId ? { userId: ensured.userId, created: ensured.created } : null,
      trial: { state: ensured.state, granted: ensured.granted },
      signedIn,
      redirectTo: input.redirectTo,
    };
  } catch (error: unknown) {
    console.error('[verify-code] account provisioning threw', error);
    return {
      ok: true,
      account: null,
      trial: NO_TRIAL_RESPONSE,
      signedIn: false,
      redirectTo: input.redirectTo,
    };
  }
}

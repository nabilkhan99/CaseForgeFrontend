import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { findAccountByEmail } from '@/lib/auth/accountSignUp';
import { sendVerificationEmail } from '@/lib/email/verificationEmail';
import {
  validateAnswers,
  validatePartialAnswers,
  validateSignupAnswers,
} from '@/lib/trial/questionnaire';
import { leadFieldsFrom } from '@/lib/trial/leadRow';
import { toE164 } from '@/lib/trial/phone';
import { clientIp, createHitLog, withinLimit } from '@/lib/http/rateLimit';
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
 *
 * Two doors arrive here now.
 *
 * The GUEST door (`sessionId`, the original) requires a real guest
 * `clinical_sessions` row, and the lead is written against that session. It
 * comes in two shapes now:
 *
 *   * the LEGACY GATE (no `mode`) still validates the whole questionnaire,
 *     because that form asks every question and a gap there is a bug;
 *   * `mode: 'guest_signup'` — the post-consultation page at
 *     /try/feedback/[sessionId], which asks for an address, a mobile and a
 *     password and nothing else — validates what it was given and keeps it,
 *     through the same `findOption` allowlists, so a hand-rolled POST still
 *     cannot write a value outside the published options. The exam questions
 *     are asked later, on the dashboard, while the first mark runs.
 *
 * The relaxation is ONLY of the questionnaire. The session check — a real,
 * unowned `clinical_sessions` row — is what bounds this door's abuse surface,
 * and it applies to both shapes identically.
 *
 * The SIGN-UP door (`mode: 'signup'`, from /free) has no consultation yet, so
 * there is no session to look up and nothing but an email and a first name to
 * validate. It is a genuinely weaker request, so it gets its own guards rather
 * than a hole in the existing ones — see {@link sendSignupCode}.
 */

/**
 * Per-IP budget for the sign-up door.
 *
 * The guest door is gated by something expensive to obtain: a real guest
 * session, which costs a consultation to create. The sign-up door has no such
 * floor — an anonymous POST with any address mails that address — so the brake
 * is the only thing standing between us and being a free mailer. Per-address
 * throttling is already handled by `verification_last_sent_at`, and would not
 * help here anyway: the abuse case is many different addresses from one client.
 */
const SIGNUP_IP_LIMIT = 8;
const SIGNUP_IP_WINDOW_MS = 60 * 60 * 1000;
const signupIpHits = createHitLog();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown> & { sessionId?: string };
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';

    // The sign-up door is opted into explicitly, and only when there is no
    // session id. Written this way round on purpose: `mode` alone must never be
    // able to turn OFF the session check on a request that carries a session,
    // or the guest path's guard becomes one client-supplied string away from
    // being skipped.
    if (!sessionId && body.mode === 'signup') {
      return await sendSignupCode(req, body);
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'A valid session is required' }, { status: 400 });
    }

    // Same validators the two forms use, so the allowlists cannot drift and a
    // hand-rolled POST cannot write values outside the published options.
    // `guest_signup` is opted into explicitly rather than inferred from a
    // missing field, so the legacy gate can never silently lose its guard.
    const guestSignup = body.mode === 'guest_signup';
    const parsed = guestSignup ? validatePartialAnswers(body) : validateAnswers(body);
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

    // The legacy gate NULLS what its branching did not ask, because it asked
    // everything and an unasked question is genuinely unanswered. The post-call
    // form OMITS instead — nulling there would wipe answers a previous visit
    // collected, which is exactly what `leadFieldsFrom` exists to avoid.
    const answerColumns = guestSignup
      ? leadFieldsFrom(answers, session.station_id ?? null)
      : {
          station_id: session.station_id ?? null,
          first_name: answers.firstName,
          // Stored E.164 (+447…) so the SMS step and the founder's call both
          // work straight off the row.
          phone: toE164(answers.phone ?? '') ?? answers.phone,
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
        };

    const leadRow = {
      session_id: sessionId,
      email: normalizedEmail,
      ...answerColumns,
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
      // The post-call form has no name field; the email greets an unnamed lead
      // as "there", the same as the portfolio banner's one-field send.
      firstName: answers.firstName ?? null,
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

/**
 * The account-first door: an address, a code, nothing else on this call.
 *
 * Two surfaces post here. /free/start sends `intent: 'signup'` and is told
 * plainly when the address already has a finished account — it is a sign-up
 * form, and mailing a code to somebody who should be signing in wastes their
 * time and ours. /free/open and the portfolio banner send no intent and keep
 * the old behaviour: a code, whoever they are.
 *
 * ## Why it can reuse this route at all
 *
 * The verification machinery — the hashed code, the TTL, the attempt counter,
 * the resend cooldown, the Brevo send — is all keyed off the `trial_leads` row,
 * not off the session. Only the LOOKUP was session-shaped. So the sign-up door
 * needs a different way to find its row and a different validator, and gets to
 * keep everything else, including the one place a verification code is
 * generated and hashed.
 *
 * ## The placeholder session id
 *
 * `trial_leads.session_id` is `not null unique` (20260714_trial_leads.sql) and
 * this door has no consultation, so a new row takes a random uuid that matches
 * no `clinical_sessions` row. That is inert by construction: the column carries
 * no foreign key, and the only reader that follows it —
 * `claimTrialSessionsForUser` — updates `clinical_sessions` by id and simply
 * matches nothing. Making the column nullable would be the tidier answer, and
 * is a migration this build deliberately does not add on top of the one Nabil
 * already has to apply by hand.
 *
 * ## Why an existing lead is UPDATED IN PLACE, never moved
 *
 * The guest door moves a known address's lead row onto the new session, because
 * there the new session IS the thing they just did. Here there is no session,
 * so moving the row would point a verified lead at a placeholder and quietly
 * disconnect them from the consultation they actually sat — which is exactly
 * the row `claimTrialSessionsForUser` needs to hand them their own work. So the
 * sign-up door writes the verification fields and the name, and leaves
 * `session_id` and `station_id` exactly as it found them.
 */
async function sendSignupCode(
  req: NextRequest,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  if (!withinLimit(signupIpHits, clientIp(req), SIGNUP_IP_LIMIT, SIGNUP_IP_WINDOW_MS)) {
    return NextResponse.json(
      { error: 'Too many requests — please try again later' },
      { status: 429 },
    );
  }

  const parsed = validateSignupAnswers(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { email, firstName } = parsed.value;

  // Only the account-first form asks. /free/open and the portfolio banner are
  // for people coming BACK — telling them to sign in instead of mailing the
  // code they asked for would close the door they were using.
  if (body.intent === 'signup') {
    const existing = await findAccountByEmail(email);
    // `passwordPending` is a lead we provisioned who never chose a password:
    // finishing that on the form is the point, so they carry on. A finished
    // account cannot be finished twice, and its owner has a password already.
    if (existing && !existing.passwordPending) {
      return NextResponse.json(
        { error: 'You already have an account. Sign in instead.', accountExists: true },
        { status: 409 },
      );
    }
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupError } = await supabase
    .from('trial_leads')
    .select('id, verification_last_sent_at')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    console.error('[send-code] signup lead lookup failed', lookupError);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }

  if (existing?.verification_last_sent_at) {
    const elapsedMs = Date.now() - new Date(existing.verification_last_sent_at).getTime();
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
  const verification = {
    // Only written when it was actually given: the portfolio banner's one-field
    // form has no name to offer, and blanking a name we already hold would cost
    // every later email its greeting.
    ...(firstName ? { first_name: firstName } : {}),
    verification_code_hash: hashVerificationCode(code, email),
    verification_expires_at: new Date(now.getTime() + CODE_TTL_MS).toISOString(),
    verification_attempts: 0,
    verification_last_sent_at: now.toISOString(),
  };

  const { error: writeError } = existing
    ? // Deliberately does NOT clear `email_verified_at`. Someone who verified
      // months ago and is now signing up is the same person at the same
      // address; un-verifying them would strip the claim on their old
      // consultation for the length of one round trip, for no gain.
      await supabase.from('trial_leads').update(verification).eq('id', existing.id)
    : await supabase.from('trial_leads').insert({
        ...verification,
        session_id: randomUUID(),
        email,
        email_verified_at: null,
      });

  if (writeError) {
    console.error('[send-code] signup lead write failed', writeError);
    return NextResponse.json({ error: 'Something went wrong — please try again' }, { status: 500 });
  }

  const emailResult = await sendVerificationEmail({ toEmail: email, firstName: firstName || null, code });
  if (!emailResult.sent) {
    // Undo the throttle stamp so a failed send can be retried immediately, and
    // drop the hash so the dead code cannot be guessed at leisure.
    await supabase
      .from('trial_leads')
      .update({ verification_last_sent_at: null, verification_code_hash: null })
      .eq('email', email);
    return NextResponse.json(
      { error: "We couldn't send the code — check the address and try again" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, resendCooldown: RESEND_COOLDOWN_SECONDS });
}

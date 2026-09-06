import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import { examDateFromSitting } from '@/lib/commerce/trialWallPlans';
import { SCA_TARGETS, TRAINING_STAGES, findOption } from '@/lib/trial/leadFields';

/**
 * The two questions the sign-up door did NOT ask, answered on the dashboard
 * after the first station.
 *
 * Door (a) collects an email and a first name. The exam sitting and the
 * training stage are what the wall needs to choose which two plans to show, and
 * asking for them before the product has proved anything is how a free offer
 * turns back into a form. So they are asked here, during the ~90 seconds a
 * first mark takes to generate.
 *
 * ## Two writes, one authority each
 *
 * `trial_leads.sca_sitting` is the lead record and the fallback the wall reads
 * through `/api/subscription`'s exam hint. `profiles.exam_date` is the
 * AUTHORITY — it drives the dashboard countdown and outranks the hint — and it
 * is written by the browser through `saveExamDate`, the one place in the
 * codebase that writes it. This route deliberately does not duplicate that: it
 * owns the leads row, which is RLS deny-all and therefore cannot be written
 * from a browser at all.
 *
 * ## Scoped to the caller's own address
 *
 * The service role is used because `trial_leads` has no write policy, so the
 * filter is the whole boundary: the row is found by the SIGNED-IN user's email,
 * never by anything in the request body. A caller cannot name someone else's
 * lead. Options go through the same `findOption` allowlists the gate uses, so a
 * hand-rolled POST cannot write a value outside the published set.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let scaSitting = '';
  let trainingStage = '';
  try {
    const body = (await request.json()) as { scaSitting?: unknown; trainingStage?: unknown };
    scaSitting = typeof body.scaSitting === 'string' ? body.scaSitting.trim() : '';
    trainingStage = typeof body.trainingStage === 'string' ? body.trainingStage.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const sitting = findOption(SCA_TARGETS, scaSitting);
  const stage = findOption(TRAINING_STAGES, trainingStage);
  if (!sitting || !stage) {
    return NextResponse.json({ error: 'Both answers are required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const email = user.email.toLowerCase();

  // `.ilike` with an escaped exact pattern, not `.eq`: trial_leads is uniquely
  // indexed on lower(email), so a row written as `Sarah@Nhs.net` must still
  // match an account signing in as `sarah@nhs.net`. Same rule as every other
  // email match in this codebase.
  const { data: lead, error: lookupError } = await admin
    .from('trial_leads')
    .select('id')
    .ilike('email', exactEmailPattern(email))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    console.error('[trial-questionnaire] lead lookup failed', lookupError);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  const values = {
    sca_sitting: sitting.value,
    training_stage: stage.value,
    // Kept in step so the existing Brevo segments, which read the older
    // free-text column, keep working for anyone answering here.
    sca_sit_date: sitting.label,
  };

  const { error: writeError } = lead
    ? await admin.from('trial_leads').update(values).eq('id', lead.id)
    : // No lead row at all — a link or cohort trialist who never went through
      // the gate. Their answers are worth the same, so one is created. The
      // placeholder session id is the same inert value the sign-up door uses;
      // see app/api/try/send-code.
      await admin.from('trial_leads').insert({
        ...values,
        email,
        session_id: randomUUID(),
        email_verified_at: new Date().toISOString(),
      });

  if (writeError) {
    console.error('[trial-questionnaire] write failed', writeError);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  // Handed back so the caller can write `profiles.exam_date` itself, through
  // saveExamDate, rather than this route growing a second copy of that write.
  return NextResponse.json({ ok: true, examDate: examDateFromSitting(sitting.value) });
}

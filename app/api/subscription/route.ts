import { NextResponse } from 'next/server';
import { isMonthlyPlan, type EntitlementState } from '@/lib/commerce/entitlements';
import { getPlan } from '@/lib/commerce/plans';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { examDateFromSitting } from '@/lib/commerce/trialWallPlans';
import type { TrialEndReason, TrialState } from '@/lib/commerce/trialAccess';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/** What a trial account needs to render its strip and, when it is spent, its wall. */
export interface TrialSubscription {
  /** Never 'none' — the field is null instead, so a truthy `trial` means "this is a trial account". */
  state: Exclude<TrialState, 'none'>;
  /** Genuinely-marked consultations counted against the grant. */
  used: number;
  remaining: number;
  /** What the grant was worth, so the strip can say "3 of 5 left" without hardcoding the 5. */
  allowance: number;
  /** How long the window runs once it opens — the "5 days" in the strip's first line. */
  windowDays: number;
  /** ISO instant of the first consultation; null before it — the clock is not running yet. */
  startedAt: string | null;
  expiresAt: string | null;
  /** Why it ended, for the wall's copy and its `trial_wall_hit` event. Null while live. */
  reason: TrialEndReason | null;
  /**
   * The exam date behind their questionnaire answer (`trial_leads.sca_sitting`),
   * as `YYYY-MM-DD`, or null.
   *
   * A FALLBACK, not the authority: `profiles.exam_date` is, and the dashboard
   * already loads that with its stats. This exists because most trialists have
   * answered the questionnaire and never filled the dashboard's date field, and
   * the wall picks its two plans on that date. Resolved here rather than in the
   * browser because `trial_leads` is RLS deny-all.
   */
  examHint: string | null;
}

export interface SubscriptionResponse {
  /** Plan key of the purchase the access derives from, null when there is none. */
  plan: string | null;
  planName: string | null;
  /**
   * What was actually bought — never overwritten by a bypass, so the UI can
   * say "Ended" and "you still have access" at the same time without lying
   * about either. Pair with {@link bypass}.
   */
  state: EntitlementState;
  /**
   * Access granted without a live purchase: the ADMIN_EMAILS allowlist, a
   * staged deployment, or a fail-open when the lookup itself broke. Consumers
   * use it to suppress "buy a plan" nags, not to describe the plan.
   */
  bypass: boolean;
  /** May start a consultation right now — `state === 'active' || bypass`. */
  allowed: boolean;
  /** ISO date access ends; null for monthly, which runs until it is canceled. */
  expiresAt: string | null;
  /**
   * Monthly only: ISO date Stripe next charges. Display copy — a rolling plan
   * has no end date, so this must never be treated as an expiry.
   */
  renewsAt: string | null;
  isMonthly: boolean;
  /** Lectures are Complete-only; true for an active Complete plan or a bypass. */
  hasLectures: boolean;
  /** Complete's coaching day (ISO date), when one was booked. */
  coachingDay: string | null;
  /**
   * The trainer-pilot seat this access rests on, when it rests on one alone.
   *
   * Null for everybody else — including a cohort member who also bought a plan,
   * and an admin. `stationIds` is then the WHOLE of what the client may open,
   * which is what the library locks against. Null therefore reads as "no limit",
   * and a cohort member with an empty allowlist reads as "no cases", which are
   * the right defaults for both.
   */
  cohort: { id: string; stationIds: string[] } | null;
  /**
   * This account owns a cohort, so the Students tab exists for them.
   *
   * Independent of {@link cohort}, and true at the same time as it for the
   * pilot's trainer: he has no purchase, so he is cohort-limited to the same
   * five cases as his students AND sees the Students tab. The two fields answer
   * different questions — what may I open, and whose work may I see.
   *
   * A HINT, NOT A GATE. This is derived from the membership row the entitlement
   * path already loaded, so it costs nothing, and it decides one thing only:
   * whether the navbar draws the tab. Every route that actually hands over a
   * student's data re-derives the answer through `getTrainerCohort()`, which is
   * the authority.
   */
  isTrainer: boolean;
  /**
   * The five-station free trial, when this account is running on one.
   *
   * Null for everybody else — including a trialist who has since bought, and an
   * admin: for them the trial decides nothing, so drawing a countdown over a
   * plan they paid for would be a lie about what they own. A truthy value
   * therefore reads as "this is a trial account", which is exactly the question
   * the dashboard strip and the wall ask.
   *
   * Present for BOTH states: 'trial' draws the strip, 'trial_ended' draws the
   * wall. Squashing the second to null would leave the wall with nothing to
   * distinguish a spent trial from someone who never had one.
   */
  trial: TrialSubscription | null;
  /**
   * Access rests on a live grant alone. Equivalent to `trial?.state === 'trial'`
   * given the rule above, and carried separately because it is what the
   * entitlement layer actually decided — see AccessDecision.trialOnly.
   */
  trialOnly: boolean;
}

/**
 * The exam date behind a trialist's questionnaire answer, or null.
 *
 * Service role because `trial_leads` is RLS deny-all; scoped to the signed-in
 * user's own address, and it reads one column. Only ever called for accounts
 * that are actually on a trial, so nobody else pays a round trip for it — this
 * route is polled by the navbar on every page.
 *
 * Never throws: a missing hint costs the wall its plan choice (it falls back to
 * the £299 pair), which is not worth failing a subscription lookup over.
 */
async function examHintFor(email: string | null | undefined): Promise<string | null> {
  try {
    const address = email?.trim();
    if (!address) return null;
    const { data, error } = await getSupabaseAdmin()
      .from('trial_leads')
      .select('sca_sitting')
      .ilike('email', address)
      // Newest answer wins: somebody who came back through a second door
      // answered again, and the later answer is the current one.
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return examDateFromSitting((data as { sca_sitting: string | null } | null)?.sca_sitting);
  } catch (error: unknown) {
    console.error('[subscription] exam hint lookup failed', error);
    return null;
  }
}

/**
 * The signed-in user's plan and expiry, as the rest of the product sees it.
 *
 * Reads the same entitlement the gate reads (purchases in `preorders`), not
 * the retired `subscriptions` table, whose sprint/standard/mastery rows no
 * checkout has written since the preorder launch — which is why the banners
 * built on it had gone quiet.
 */
export async function GET() {
  const { user, entitlement, allowed, bypass, failedOpen, cohort, cohortOnly, trial, trialOnly } =
    await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The same test the entitlement layer applies: a trial decides nothing for
  // someone who has bought or who is on the admin allowlist, so it is not
  // reported to them at all. `bypass` covers the fail-open too, where nobody
  // waived anything and the trial must not be counted down against a lookup
  // that broke.
  // A LIVE trial is always reported: it is what is letting them practise, and
  // on a lapsed customer's dashboard it is the only line that explains why the
  // stations still open. A SPENT one is reported only when there is no purchase
  // to talk about instead — somebody who once bought has a plan name and a
  // renew path, and their own story outranks the grant's, here as everywhere.
  const trialGoverns =
    trial !== null &&
    trial.state !== 'none' &&
    entitlement.state !== 'active' &&
    !bypass &&
    !failedOpen &&
    (trial.state === 'trial' || !entitlement.plan);
  const trialBody: TrialSubscription | null = trialGoverns
    ? {
        state: trial.state as Exclude<TrialState, 'none'>,
        used: trial.used,
        remaining: trial.remaining,
        allowance: trial.allowance,
        windowDays: trial.windowDays,
        startedAt: trial.startedAt?.toISOString() ?? null,
        expiresAt: trial.expiresAt?.toISOString() ?? null,
        reason: trial.reason ?? null,
        // Only the wall needs it, so only the wall's state pays for it.
        examHint: trial.state === 'trial_ended' ? await examHintFor(user.email) : null,
      }
    : null;

  // Derived, not looked up. This route is polled by the navbar on every page,
  // so an extra service-role query here is a query on the hottest path in the
  // product — and it would have been asking something the entitlement path has
  // already answered: `cohort` carries the trainer_email of the cohort this
  // user belongs to, and the trainer is a member of his own cohort.
  //
  // The cost tradeoff, stated plainly: this is true for anyone whose cohort
  // names their address, and it does not re-verify against `cohorts` the way
  // `getTrainerCohort()` does. At pilot scale (one cohort, four members) that
  // is exactly equivalent, and it is only ever used to decide whether to render
  // a nav link — /api/trainer/overview, the recording endpoint and the feedback
  // route each run the real guard before releasing a single row.
  const isTrainer =
    cohort !== null &&
    cohort.trainerEmail.trim().toLowerCase() === (user.email ?? '').trim().toLowerCase();

  const plan = entitlement.plan ?? null;
  const body: SubscriptionResponse = {
    plan,
    planName: plan ? getPlan(plan)?.name ?? null : null,
    // The true state, not `allowed ? 'active' : ...`. Folding the bypass into
    // the state made an admin whose own purchase had lapsed render as
    // "Active · expires in -12 days". `bypass` carries that information on its
    // own, so the UI can stop nagging without the API misreporting the plan.
    state: entitlement.state,
    bypass: bypass || failedOpen,
    allowed,
    expiresAt: entitlement.expiresAt?.toISOString() ?? null,
    renewsAt: entitlement.renewsAt?.toISOString() ?? null,
    isMonthly: plan ? isMonthlyPlan(plan) : false,
    hasLectures: (entitlement.hasLectures && allowed) || bypass,
    coachingDay: entitlement.coachingDay ?? null,
    // `cohortOnly`, not `cohort !== null` — see AccessDecision. The distinction
    // is about PURCHASES, not roles: a cohort member who also bought, or an
    // admin, keeps the whole bank. The trainer is not an exception to that and
    // gets no exemption from it — with no purchase he is cohort-limited to the
    // same five cases as his students, which is the intended pilot design.
    cohort: cohortOnly && cohort ? { id: cohort.id, stationIds: cohort.stationIds } : null,
    isTrainer,
    trial: trialBody,
    trialOnly,
  };

  return NextResponse.json(body);
}

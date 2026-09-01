import { NextResponse } from 'next/server';
import { isMonthlyPlan, type EntitlementState } from '@/lib/commerce/entitlements';
import { getPlan } from '@/lib/commerce/plans';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { getTrainerCohort } from '@/lib/trainer/guard';

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
   * This account owns a cohort, so the Students tab exists for them. Separate
   * from {@link cohort}: the trainer is normally a cohort member AND a
   * purchaser, so their `cohort` is null while `isTrainer` is true.
   */
  isTrainer: boolean;
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
  const { user, entitlement, allowed, bypass, failedOpen, cohort, cohortOnly } =
    await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Every navbar render asks this route whether to show a lock, so it is also
  // the cheapest place to answer "is this account a trainer" — the alternative
  // was a second endpoint the navbar would have to call on every page anyway.
  const trainerCohort = await getTrainerCohort();

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
    // `cohortOnly`, not `cohort !== null` — see AccessDecision. A trainer sits
    // in their own cohort and must not have their library cut to five cases.
    cohort: cohortOnly && cohort ? { id: cohort.id, stationIds: cohort.stationIds } : null,
    isTrainer: trainerCohort !== null,
  };

  return NextResponse.json(body);
}

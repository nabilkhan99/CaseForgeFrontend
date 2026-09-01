import { NextResponse } from 'next/server';
import { isMonthlyPlan, type EntitlementState } from '@/lib/commerce/entitlements';
import { getPlan } from '@/lib/commerce/plans';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';

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
  };

  return NextResponse.json(body);
}

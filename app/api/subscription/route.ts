import { NextResponse } from 'next/server';
import { isMonthlyPlan, type EntitlementState } from '@/lib/commerce/entitlements';
import { getPlan } from '@/lib/commerce/plans';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';

export interface SubscriptionResponse {
  /** Plan key of the purchase the access derives from, null when there is none. */
  plan: string | null;
  planName: string | null;
  state: EntitlementState;
  /** ISO date access ends; null for monthly, which runs until it is canceled. */
  expiresAt: string | null;
  isMonthly: boolean;
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
  const { user, entitlement, allowed } = await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const plan = entitlement.plan ?? null;
  const body: SubscriptionResponse = {
    plan,
    planName: plan ? getPlan(plan)?.name ?? null : null,
    // `allowed` folds in the admin and staged-deployment bypass, so an admin
    // is never nagged to buy the product they run.
    state: allowed ? 'active' : entitlement.state,
    expiresAt: entitlement.expiresAt?.toISOString() ?? null,
    isMonthly: plan ? isMonthlyPlan(plan) : false,
  };

  return NextResponse.json(body);
}

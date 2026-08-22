import type { Entitlement } from './entitlements'

/**
 * Self-Study -> Complete, now a Stripe Customer Portal plan switch.
 *
 * The bespoke `complete_upgrade` pseudo-plan (a separate £300 Price, its own
 * `/dashboard/upgrade` page and a checkout branch) is gone. Every plan is a
 * subscription, so the upgrade is Stripe swapping the subscription's Price and
 * invoicing the proration — the customer pays only for the time left on their
 * term, which is why the copy no longer quotes a flat £300.
 *
 * What survives is the question of WHO may be offered it, because a CTA shown
 * to the wrong customer is still a broken product: someone who already holds
 * Complete has nothing to switch to, and someone whose access has lapsed needs
 * to renew, not upgrade.
 */

/** The plans there is something above. */
export const UPGRADEABLE_FROM: ReadonlySet<string> = new Set(['self_study', 'self_study_monthly'])

/**
 * Should this entitlement be offered the switch up to Complete?
 *
 * Takes the *folded* entitlement on purpose: a customer who already holds
 * Complete folds to `complete` (the fold ranks lectures above everything at the
 * same access level) and is refused here, so the upgrade CTA cannot appear
 * twice.
 *
 * `read_only` (a lapsed Self-Study) is deliberately excluded. There is nothing
 * left to switch — that customer needs to buy again, at the full price.
 *
 * Presentation only. The Portal itself is the enforcement: it can only offer
 * the prices its configuration lists, against a subscription the signed-in
 * customer owns.
 */
export function canSwitchPlan(entitlement: Entitlement): boolean {
  if (!entitlement.plan || !UPGRADEABLE_FROM.has(entitlement.plan)) return false
  // 'none' WITH a plan is a pre-launch purchase whose window hasn't opened.
  // They have bought Self-Study and may absolutely move up before 1 September.
  return entitlement.state === 'active' || entitlement.state === 'none'
}

import type { Entitlement } from './entitlements'

/**
 * Self-Study -> Complete, at the price difference.
 *
 * The upgrade is requested under its own pseudo-plan key so `/api/checkout` can
 * tell "buy Complete outright (£599)" from "top up to Complete (£300)". It is
 * NOT a `PlanKey`: it never reaches `preorders`, never reaches an entitlement,
 * and never appears in {@link PLANS}. The webhook records the resulting order as
 * a plain `complete` purchase, which is what makes the entitlement fold work —
 * the buyer ends up with Self-Study *and* Complete rows, and `complete` wins on
 * the lectures key.
 */
export const COMPLETE_UPGRADE_PLAN = 'complete_upgrade'

/** The plans the upgrade is priced against. */
export const UPGRADEABLE_FROM: ReadonlySet<string> = new Set(['self_study', 'self_study_monthly'])

/**
 * May this entitlement buy the £300 upgrade?
 *
 * Server-side gate — a £300 Price with no check would let anyone buy Complete
 * for half price. Takes the *folded* entitlement on purpose: a customer who
 * already holds Complete folds to `complete` (the fold ranks lectures above
 * everything at the same access level) and is refused here, so the upgrade
 * cannot be bought twice.
 *
 * `read_only` (a lapsed Self-Study) is deliberately excluded. There is nothing
 * left to upgrade — that customer needs to renew, and the renewal price is the
 * full one.
 */
export function canUpgradeToComplete(entitlement: Entitlement): boolean {
  if (!entitlement.plan || !UPGRADEABLE_FROM.has(entitlement.plan)) return false
  // 'none' WITH a plan is a pre-launch purchase whose window hasn't opened.
  // They have bought Self-Study and may absolutely top up before 1 September.
  return entitlement.state === 'active' || entitlement.state === 'none'
}

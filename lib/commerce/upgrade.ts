import type { Entitlement } from './entitlements'

/**
 * Self-Study -> Complete.
 *
 * There is no self-serve path any more, and the Portal cannot provide one: the
 * course plans went back to one-off `payment` sales on 2026-08-29, so a
 * Self-Study buyer has no subscription to switch, and a monthly subscriber
 * cannot be switched onto a one-off Price. Upgrades are quoted and taken by
 * hand (founder decision, 2026-08-29) — a flat £300 from Self-Study, and the
 * balance from monthly — which is fine at this volume.
 *
 * The set is kept, empty, rather than deleted: it is the single place to name
 * the plans a self-serve upgrade would apply to when one is built, and every
 * caller already reads through {@link canSwitchPlan}.
 */

/** Plans with a self-serve route to something above. None, by design. */
export const UPGRADEABLE_FROM: ReadonlySet<string> = new Set<string>()

/**
 * Should this entitlement be offered a self-serve switch up to Complete?
 *
 * Always false while {@link UPGRADEABLE_FROM} is empty — the logic below is
 * retained intact so that re-populating that set is the only change needed to
 * turn self-serve upgrades back on.
 *
 * Takes the *folded* entitlement on purpose: a customer who already holds
 * Complete folds to `complete` (the fold ranks lectures above everything at the
 * same access level) and is refused here, so the upgrade CTA cannot appear
 * twice.
 *
 * `read_only` (a lapsed Self-Study) is deliberately excluded. There is nothing
 * left to switch — that customer needs to buy again, at the full price.
 */
export function canSwitchPlan(entitlement: Entitlement): boolean {
  if (!entitlement.plan || !UPGRADEABLE_FROM.has(entitlement.plan)) return false
  // 'none' WITH a plan is a pre-launch purchase whose window hasn't opened.
  // They have bought Self-Study and may absolutely move up before 1 September.
  return entitlement.state === 'active' || entitlement.state === 'none'
}

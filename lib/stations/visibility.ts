/**
 * Which `is_active` states a signed-in surface may show: live only, on every
 * deployment.
 *
 * This used to widen to `[true, false]` when NEXT_PUBLIC_SHOW_STAGED_STATIONS
 * was set on a preview, so develop could look like the next launch. Since the
 * case-versions change (5 Oct 2026) `is_active = false` no longer means
 * "staged for launch": it means a draft under review or an old case that has
 * been replaced (`stations.lifecycle`, see lib/stations/caseVersions.ts).
 * Widening would list every archived case beside its replacement, so the
 * staged-preview mode is switched off for station lists, permanently. Drafts
 * reach admins, and old cases reach their keepers, through caseVersions —
 * never through here.
 *
 * Kept as a function rather than inlined because several callers still filter
 * through it; every one of them now means "live".
 */
export function visibleStationStates(): boolean[] {
    return [true];
}

/**
 * True on deployments meant to preview the post-launch state (develop preview,
 * local dev). It no longer widens any station list (see above); it survives
 * for `NEXT_PUBLIC_ACCESS_OPENS_OVERRIDE` in lib/commerce/launchDate.ts.
 * Hard-refused anywhere that isn't provably one of those: staged mode lets
 * that override bring the launch date forward, so a stray env var must never
 * be able to open the course early on the live site. It does NOT waive the
 * paywall — a preview gates exactly as production does.
 *
 * Deliberately an allowlist of safe environments, not a denylist of
 * `!== 'production'`. NEXT_PUBLIC_VERCEL_ENV only exists when Vercel's
 * "automatically expose System Environment Variables" is switched on; with it
 * off the variable is undefined on production too, and a denylist would read
 * that as "staged" — failing open on the one deployment that must fail closed.
 * Undefined therefore falls back to NODE_ENV, which Next always sets.
 */
export function isStagedDeployment(): boolean {
    if (process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS !== '1') return false;

    const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
    if (vercelEnv) return vercelEnv === 'preview' || vercelEnv === 'development';
    return process.env.NODE_ENV !== 'production';
}

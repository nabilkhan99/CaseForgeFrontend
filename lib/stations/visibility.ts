/**
 * Which `is_active` states a deployment may show.
 *
 * Staged stations (`is_active = false`) are hidden everywhere by default.
 * Setting NEXT_PUBLIC_SHOW_STAGED_STATIONS=1 on a deployment (develop
 * preview, local dev) makes that deployment list and run them too, so develop
 * can look like the next launch state while production keeps showing only the
 * live bank. Applies to logged-in surfaces only — the /try funnel and the
 * public /sca-cases pages always show the live bank. NEXT_PUBLIC_ because
 * some station queries run in the browser; the value is baked in
 * per-deployment at build time. Never set it on the Production environment:
 * activating a station for real is a DB flip (`is_active = true`), not this
 * switch.
 */
export function visibleStationStates(): boolean[] {
    return process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS === '1' ? [true, false] : [true];
}

/**
 * True on deployments that preview the post-launch state (develop preview,
 * local dev). Gates test-friendly behaviour beyond station visibility, e.g.
 * treating signed-in testers as fully entitled. Never set in Production.
 */
export function isStagedDeployment(): boolean {
    return process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS === '1';
}

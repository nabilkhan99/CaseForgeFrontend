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
    return isStagedDeployment() ? [true, false] : [true];
}

/**
 * True on deployments meant to preview the post-launch state (develop preview,
 * local dev). Hard-refused anywhere that isn't provably one of those: staged
 * mode also bypasses the entitlement gate, so a stray env var must never be
 * able to give the whole product away on the live site.
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

/**
 * Shared domain metadata — the tint used for a domain's chip/badge.
 *
 * Two rules, both learned the hard way:
 *
 * 1. **Stay in the house palette.** The chips used to run through a twelve-step
 *    rainbow (blue, purple, pink, red, teal…). None of those exist in the warm
 *    amber/stone system, and a red chip beside a domain name reads as a failure
 *    state rather than a category.
 * 2. **Key off the name, not the list position.** The old palette was indexed by
 *    `index % 12`, so a domain's colour changed whenever the library was
 *    reordered or a domain was added — the colour carried no information and
 *    could never be learned. Hashing the *name* makes a domain's tint stable
 *    for the life of the domain, wherever the chip is rendered (library,
 *    dashboard, history, station brief).
 *
 * The tints are deliberately close together: they are texture, not a legend.
 * Every text colour clears WCAG AA (≥ 7:1) on the cream surfaces.
 */

export interface DomainTint {
  bg: string;
  text: string;
}

/** Four steps of amber/stone. Deliberately no red and no green — those are reserved for verdicts. */
export const DOMAIN_TINTS: readonly DomainTint[] = [
  { bg: 'rgba(180,83,9,0.08)', text: '#92400E' },   // amber, the base chip
  { bg: 'rgba(245,158,11,0.14)', text: '#9A3412' }, // warmer amber
  { bg: 'rgba(120,113,108,0.10)', text: '#57534E' },// stone
  { bg: 'rgba(180,83,9,0.14)', text: '#7C2D12' },   // deepest amber
];

/**
 * FNV-1a over the normalised name. Stable across sessions, machines and
 * catalogue edits — the only thing that changes a domain's tint is renaming it.
 */
export function hashDomainName(domainName: string): number {
  const normalised = domainName.trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalised.length; i++) {
    hash ^= normalised.charCodeAt(i);
    // FNV prime, kept in 32-bit range via Math.imul.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * @param domainName drives the tint.
 * @param index accepted only so existing call sites keep compiling; it is
 *   deliberately ignored — the list position must never affect the colour again.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getDomainColor(domainName: string, index?: number): DomainTint {
  if (!domainName) return DOMAIN_TINTS[0];
  return DOMAIN_TINTS[hashDomainName(domainName) % DOMAIN_TINTS.length];
}

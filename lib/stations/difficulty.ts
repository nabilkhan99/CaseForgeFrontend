/**
 * Station difficulty, mapped onto something the library can actually render.
 *
 * The bank stores `intermediate` (185) and `advanced` (15) — it has never held
 * an `easy`/`medium`/`hard` row. The library's inline colour switch only knew
 * those three words, so both real values fell through to the "easy" branch and
 * every pill in the product rendered the same green, including the 15 advanced
 * ones. Green is also off-palette.
 *
 * So: normalise every spelling anyone has used onto three tiers, and colour
 * them in the house amber/stone ramp — quiet stone for the easiest, soft amber
 * for the middle, burnt amber for the hardest — so the pill reads as a scale
 * rather than as a traffic light.
 */

export type DifficultyTier = 'foundation' | 'intermediate' | 'advanced';

/**
 * Every value the column has held or plausibly could, folded onto a tier.
 * Unknown words deliberately return null rather than a guess: a pill that
 * asserts the wrong tier is worse than no pill.
 */
const TIER_BY_VALUE: Record<string, DifficultyTier> = {
    easy: 'foundation',
    basic: 'foundation',
    foundation: 'foundation',
    beginner: 'foundation',

    medium: 'intermediate',
    moderate: 'intermediate',
    standard: 'intermediate',
    intermediate: 'intermediate',

    hard: 'advanced',
    complex: 'advanced',
    difficult: 'advanced',
    advanced: 'advanced',
    expert: 'advanced',
};

const TIER_LABEL: Record<DifficultyTier, string> = {
    foundation: 'Foundation',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
};

/** Amber/stone ramp. Text colours are all >= 4.5:1 on the cream surfaces. */
const TIER_STYLE: Record<DifficultyTier, { background: string; color: string }> = {
    foundation: { background: 'rgba(120,113,108,0.10)', color: '#57534E' },
    intermediate: { background: 'rgba(180,83,9,0.08)', color: '#92400E' },
    advanced: { background: 'rgba(180,83,9,0.18)', color: '#7C2D12' },
};

export function difficultyTier(value?: string | null): DifficultyTier | null {
    if (!value) return null;
    return TIER_BY_VALUE[value.trim().toLowerCase()] ?? null;
}

export function difficultyLabel(value?: string | null): string | null {
    const tier = difficultyTier(value);
    return tier ? TIER_LABEL[tier] : null;
}

export function difficultyStyle(value?: string | null): { background: string; color: string } | null {
    const tier = difficultyTier(value);
    return tier ? TIER_STYLE[tier] : null;
}

/**
 * Whether a difficulty pill earns its place in a given list.
 *
 * 185 of 200 stations are `intermediate`, so most domains contain exactly one
 * tier. Stamping "INTERMEDIATE" on all ten rows of such a page carries zero
 * information and costs a line of mobile width — the pill only says something
 * when the list it sits in contains more than one tier.
 */
export function shouldShowDifficulty(values: Array<string | null | undefined>): boolean {
    const tiers = new Set<DifficultyTier>();
    for (const value of values) {
        const tier = difficultyTier(value);
        if (tier) tiers.add(tier);
        if (tiers.size > 1) return true;
    }
    return false;
}

import { STUDY_BUDGET_ARTICLES } from './content';

/**
 * Neighbouring deaneries for the "training in X instead?" cross-links
 * (DEV-HANDOFF §9: each spoke links the hub, 2-3 neighbours, the two support
 * pages and one soft pricing link).
 *
 * Neighbours are geographic so the prompt reads naturally to someone who has
 * landed on the wrong region.
 */
const NEIGHBOURS: Readonly<Record<string, readonly string[]>> = {
  london: ['kss', 'east-of-england', 'thames-valley'],
  kss: ['london', 'thames-valley', 'east-of-england'],
  'east-of-england': ['london', 'east-midlands', 'kss'],
  'thames-valley': ['wessex', 'london', 'south-west'],
  wessex: ['thames-valley', 'south-west', 'london'],
  'east-midlands': ['west-midlands', 'yorkshire-humber', 'east-of-england'],
  'west-midlands': ['east-midlands', 'north-west', 'wales'],
  'north-west': ['yorkshire-humber', 'west-midlands', 'north-east'],
  'yorkshire-humber': ['north-east', 'north-west', 'east-midlands'],
  'north-east': ['yorkshire-humber', 'north-west', 'scotland'],
  'south-west': ['wessex', 'wales', 'thames-valley'],
  scotland: ['north-east', 'northern-ireland', 'wales'],
  wales: ['west-midlands', 'south-west', 'northern-ireland'],
  'northern-ireland': ['scotland', 'wales', 'north-west'],
};

export interface RelatedLink {
  href: string;
  label: string;
}

function labelFor(slug: string): string {
  const article = STUDY_BUDGET_ARTICLES.find(
    (a) => a.slug === `/study-budget/${slug}/`,
  );
  if (!article) return slug;
  // "London GP study budget: what it covers for the SCA" -> "London"
  return article.h1.replace(/ GP study budget.*$/, '');
}

export function neighbourLinks(slug: string): RelatedLink[] {
  return (NEIGHBOURS[slug] ?? []).map((n) => ({
    href: `/study-budget/${n}/`,
    label: labelFor(n),
  }));
}

/** Support pages every deanery spoke should point at. */
export const SUPPORT_LINKS: readonly RelatedLink[] = [
  { href: '/study-budget/how-to-claim/', label: 'How to claim your study budget' },
  {
    href: '/study-budget/sca-exam-fee-reimbursement/',
    label: 'Is the SCA exam fee reimbursed?',
  },
  { href: '/study-budget/gp0001-explained/', label: 'GP0001 explained' },
];

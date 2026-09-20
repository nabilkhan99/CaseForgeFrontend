import type { Metadata } from 'next';

/**
 * Metadata for `/portfolio/playground`. The page itself is a client component,
 * so it cannot export `metadata`; this layout carries it instead, following the
 * `app/coaching-session/layout.tsx` precedent.
 *
 * The playground is an internal prompt sandbox, not a marketing page. Without
 * this it inherited the root layout's canonical and told Google it was the
 * homepage. `noindex` keeps it out of the index entirely, which is what it
 * wanted in the first place.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PortfolioPlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

'use client';

import type { ReactNode } from 'react';
import { usePortfolioReviewState } from './PortfolioReviewState';

/**
 * Hides the below-fold SEO block once a review is on screen, without ever
 * unmounting it.
 *
 * The distinction matters. `children` here is a SERVER-rendered subtree handed
 * down from app/gp-portfolio-tool/page.tsx, so it is fully present in the
 * initial HTML — which is the whole reason the block exists. Conditionally
 * rendering it would move that content behind a client-side decision, and a
 * crawler that never generates a review would still be fine but the pattern
 * would be one refactor away from breaking. Toggling the `hidden` attribute
 * keeps the markup where it is and just stops showing it.
 *
 * On first paint `hasReview` is false, so the server HTML and the first client
 * render agree and there is no hydration mismatch. A returning user whose review
 * is restored from localStorage flips it a moment later, which is the intended
 * behaviour: someone reading their output should see the review and nothing
 * else underneath it.
 */
export default function BelowFoldGate({ children }: { children: ReactNode }) {
    const { hasReview } = usePortfolioReviewState();
    return <div hidden={hasReview}>{children}</div>;
}

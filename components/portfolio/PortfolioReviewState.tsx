'use client';

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

/**
 * Whether a generated review is currently on screen, shared between two SIBLING
 * subtrees of /gp-portfolio-tool.
 *
 * Why a context and not a prop: the below-fold SEO block has to be rendered by
 * the SERVER page so its whole HTML ships in the initial response (spec §9 —
 * content injected on click is not reliably crawled), while the review state
 * lives inside the client tool. The two therefore cannot be parent and child in
 * either direction, and this is the seam between them.
 *
 * `hasReview` covers the localStorage restore as well as a fresh generation: the
 * tool publishes `review !== null`, and a returning user has a review on mount.
 */

interface PortfolioReviewStateValue {
    hasReview: boolean;
    setHasReview: (value: boolean) => void;
}

const PortfolioReviewStateContext = createContext<PortfolioReviewStateValue | null>(null);

/**
 * Read the shared review state. Falls back to "no review" outside a provider so
 * a component rendered in isolation shows its default (visible) state rather
 * than throwing.
 */
export function usePortfolioReviewState(): PortfolioReviewStateValue {
    return useContext(PortfolioReviewStateContext) ?? { hasReview: false, setHasReview: () => {} };
}

export default function PortfolioReviewStateProvider({ children }: { children: ReactNode }) {
    const [hasReview, setHasReviewState] = useState(false);

    const setHasReview = useCallback((value: boolean) => {
        setHasReviewState(current => (current === value ? current : value));
    }, []);

    const value = useMemo(() => ({ hasReview, setHasReview }), [hasReview, setHasReview]);

    return (
        <PortfolioReviewStateContext.Provider value={value}>
            {children}
        </PortfolioReviewStateContext.Provider>
    );
}

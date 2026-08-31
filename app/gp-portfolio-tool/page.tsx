import type { Metadata } from 'next';
import PortfolioToolClient from '@/components/portfolio/PortfolioToolClient';
import PortfolioBelowFold from '@/components/portfolio/PortfolioBelowFold';
import BelowFoldGate from '@/components/portfolio/BelowFoldGate';
import PortfolioReviewStateProvider from '@/components/portfolio/PortfolioReviewState';
import ReferralModalProvider from '@/components/portfolio/ReferralModalProvider';
import { PORTFOLIO_TOOL_JSON_LD, pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
    title: 'Free GP Portfolio Tool | AI Clinical Case Review Generator',
    description:
        'Generate structured clinical case reviews for your RCGP ePortfolio in seconds. Describe your case, select your capabilities, get a submission-ready draft. Free.',
    path: '/gp-portfolio-tool',
    image: {
        url: '/og/portfolio-tool.png',
        width: 1200,
        height: 1200,
        // A plain description of the image, not a marketing claim. The
        // "15,000 case reviews in 30 days" stat that used to live here is now in
        // visible below-fold copy, where it can actually be crawled — alt text
        // on a social card cannot rank for anything.
        alt: 'The Fourteen Fisherman GP portfolio tool',
    },
});

/**
 * /gp-portfolio-tool — the free RCGP ePortfolio case review generator.
 *
 * Stays a SERVER component so the below-fold SEO block is rendered on the server
 * and shipped in the initial HTML (spec §9). That block and the tool are
 * siblings, not parent and child, because the tool is a client component and the
 * block must not be: PortfolioReviewStateProvider is the seam between them, and
 * BelowFoldGate hides the block (without unmounting it) once a review is on
 * screen — including one restored from localStorage for a returning user.
 *
 * ReferralModalProvider wraps both so the strip's two instances share one modal.
 */
export default function GpPortfolioToolPage() {
    return (
        <>
            {/* JSON-LD as a raw script, following ORGANIZATION_JSON_LD in
                app/layout.tsx: Next's Metadata API has no hook for it. */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(PORTFOLIO_TOOL_JSON_LD) }}
            />
            <PortfolioReviewStateProvider>
                <ReferralModalProvider>
                    <PortfolioToolClient />
                    <BelowFoldGate>
                        <PortfolioBelowFold />
                    </BelowFoldGate>
                </ReferralModalProvider>
            </PortfolioReviewStateProvider>
        </>
    );
}

import type { Metadata } from 'next';
import PortfolioToolClient from '@/components/portfolio/PortfolioToolClient';
import { pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
    title: 'Free GP Portfolio Tool | AI Clinical Case Review Generator',
    description:
        'Generate structured clinical case reviews for your RCGP ePortfolio in seconds. Describe your case, select your capabilities, get a submission-ready draft. Free.',
    path: '/gp-portfolio-tool',
});

export default function GpPortfolioToolPage() {
    return <PortfolioToolClient />;
}

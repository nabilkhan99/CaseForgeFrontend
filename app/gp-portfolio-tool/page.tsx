import type { Metadata } from 'next';
import PortfolioToolClient from '@/components/portfolio/PortfolioToolClient';
import { pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
    title: 'Free GP Portfolio Tool | AI Clinical Case Review Generator',
    description:
        'Generate structured clinical case reviews for your RCGP ePortfolio in seconds. Describe your case, select your capabilities, get a submission-ready draft. Free.',
    path: '/gp-portfolio-tool',
    image: {
        url: '/og/portfolio-tool.png',
        width: 1200,
        height: 1200,
        alt: '15,000 clinical case reviews written up in 30 days',
    },
});

export default function GpPortfolioToolPage() {
    return <PortfolioToolClient />;
}

import { permanentRedirect } from 'next/navigation';

export default function LegacyPortfolioPage() {
    permanentRedirect('/gp-portfolio-tool');
}

import type { GuideArticle } from '@/lib/guides/articleTypes';
import { whatIsTheMrcgpSca } from '@/lib/guides/articles/what-is-the-mrcgp-sca';
import { scaPassRatesExplained } from '@/lib/guides/articles/sca-pass-rates-explained';
import { scaExamDay } from '@/lib/guides/articles/sca-exam-day';
import { scaMarkingDomainsExplained } from '@/lib/guides/articles/sca-marking-domains-explained';
import { scaFeedbackStatements } from '@/lib/guides/articles/sca-feedback-statements';
import { scaTwelveMinuteConsultationFramework } from '@/lib/guides/articles/sca-twelve-minute-consultation-framework';
import { scaPhraseBank } from '@/lib/guides/articles/sca-phrase-bank';
import { challengingScaConsultations } from '@/lib/guides/articles/challenging-sca-consultations';
import { complexScaConsultationStructures } from '@/lib/guides/articles/complex-sca-consultation-structures';
import { scaRevisionTimeline } from '@/lib/guides/articles/sca-revision-timeline';
import { howToPractiseScaCasesStudyPartner } from '@/lib/guides/articles/how-to-practise-sca-cases-study-partner';
import { bestScaRevisionResources } from '@/lib/guides/articles/best-sca-revision-resources';
import { whichScaAiPlatform } from '@/lib/guides/articles/which-sca-ai-platform';
import { failedMrcgpScaResitGuide } from '@/lib/guides/articles/failed-mrcgp-sca-resit-guide';
import { managingScaAnxiety } from '@/lib/guides/articles/managing-sca-anxiety';

/**
 * Registry of all SCA sub-guides, in series order. The dynamic route at
 * app/guides/[slug] renders any slug present here; generateStaticParams
 * pre-renders each one at build time.
 */
export const guideArticles: GuideArticle[] = [
    whatIsTheMrcgpSca,
    scaPassRatesExplained,
    scaExamDay,
    scaMarkingDomainsExplained,
    scaFeedbackStatements,
    scaTwelveMinuteConsultationFramework,
    scaPhraseBank,
    challengingScaConsultations,
    complexScaConsultationStructures,
    scaRevisionTimeline,
    howToPractiseScaCasesStudyPartner,
    bestScaRevisionResources,
    whichScaAiPlatform,
    failedMrcgpScaResitGuide,
    managingScaAnxiety,
];

export const guideArticlesBySlug: Record<string, GuideArticle> = Object.fromEntries(
    guideArticles.map(article => [article.slug, article]),
);

export function getGuideArticle(slug: string): GuideArticle | undefined {
    return guideArticlesBySlug[slug];
}

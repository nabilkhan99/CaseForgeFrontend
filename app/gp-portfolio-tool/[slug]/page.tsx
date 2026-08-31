import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleToc from './ArticleToc';
import { renderInline } from './renderInline';
import LandingFooter from '@/components/landing/LandingFooter';
import LandingNavbar from '@/components/landing/LandingNavbar';
import type { PortfolioArticle, PortfolioArticleBlock } from '@/lib/portfolio-guides/articleTypes';
import { PORTFOLIO_TOOL_PATH, portfolioArticlePath } from '@/lib/portfolio-guides/articleTypes';
import { getPortfolioArticle, portfolioArticles } from '@/lib/portfolio-guides/articles';
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/site';

export function generateStaticParams() {
    return portfolioArticles.map(article => ({ slug: article.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const article = getPortfolioArticle(slug);
    if (!article) {
        return { title: 'Article not found | Fourteen Fisherman' };
    }

    // Self-referencing canonical, Open Graph and Twitter tags all come from
    // pageMetadata, so each article carries its own.
    const metadata = pageMetadata({
        title: article.metaTitle,
        description: article.metaDescription,
        path: portfolioArticlePath(article.slug),
        type: 'article',
    });

    // The drafts supply meta titles that already end in "| Fourteen Fisherman",
    // and the root layout's title template appends the same suffix again. Mark
    // the title absolute so the rendered <title> is exactly the supplied string
    // rather than carrying the site name twice.
    return { ...metadata, title: { absolute: article.metaTitle } };
}

function ArticleBlockView({ block }: { block: PortfolioArticleBlock }) {
    if (block.type === 'text') {
        return <p>{renderInline(block.text)}</p>;
    }

    if (block.type === 'statement') {
        return (
            <div className="rounded-xl border border-[#e6dccb] border-l-4 border-l-primary bg-[#fbf8f2] p-4">
                <p className="[font-family:var(--font-serif)] text-lg font-medium italic leading-snug text-heading">
                    {renderInline(block.label)}
                </p>
                <p className="mt-2 text-[16px] leading-relaxed text-body">
                    {renderInline(block.text)}
                </p>
            </div>
        );
    }

    if (block.type === 'capabilities') {
        return (
            <div className="not-prose flex flex-wrap items-baseline gap-x-2 gap-y-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                    Capabilities
                </span>
                {block.items.map(item => (
                    <span
                        key={item}
                        className="rounded-full border border-[#e6dccb] bg-[#fbf8f2] px-3 py-1 text-[13px] leading-snug text-body"
                    >
                        {item}
                    </span>
                ))}
            </div>
        );
    }

    // defs
    return (
        <dl className="space-y-5 border-l-2 border-[#e6dccb] pl-5">
            {block.items.map(item => (
                <div key={item.term}>
                    <dt className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary">
                        {item.term}
                    </dt>
                    {item.paragraphs.map((paragraph, index) => (
                        <dd key={index} className="mt-2 text-[17px] leading-relaxed text-body">
                            {renderInline(paragraph)}
                        </dd>
                    ))}
                </div>
            ))}
        </dl>
    );
}

export default async function PortfolioArticlePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const article: PortfolioArticle | undefined = getPortfolioArticle(slug);
    if (!article) {
        notFound();
    }

    const tocSections = article.sections.map((section, index) => ({
        id: section.id,
        number: String(index + 1).padStart(2, '0'),
        title: section.title,
    }));

    // No datePublished/dateModified: this cluster carries no dates anywhere by
    // design, so that nothing in it needs revisiting on a calendar.
    const articleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.heading,
        description: article.metaDescription,
        author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: { '@type': 'ImageObject', url: absoluteUrl('/fourteenfishermann.png') },
        },
        mainEntityOfPage: absoluteUrl(portfolioArticlePath(article.slug)),
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'GP portfolio tool',
                item: absoluteUrl(PORTFOLIO_TOOL_PATH),
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: article.heading,
                item: absoluteUrl(portfolioArticlePath(article.slug)),
            },
        ],
    };

    return (
        <div className="min-h-[100dvh] bg-[#f4efe6] text-body">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />

            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-heading focus:px-4 focus:py-2 focus:text-white"
            >
                Skip to content
            </a>
            <LandingNavbar user={null} />

            <header className="border-b border-[#e2d8c8] px-4 pb-10 pt-32 md:px-6 md:pb-12">
                <div className="mx-auto max-w-[1180px]">
                    <nav
                        className="text-xs font-bold uppercase tracking-[0.16em] text-muted"
                        aria-label="Breadcrumb"
                    >
                        <Link href={PORTFOLIO_TOOL_PATH} className="hover:text-heading">
                            GP portfolio tool
                        </Link>
                        <span> / {article.kicker}</span>
                    </nav>
                    <p className="mt-8 text-xs font-bold uppercase tracking-[0.26em] text-primary">
                        {article.kicker}
                    </p>
                    <h1 className="mt-4 [font-family:var(--font-serif)] text-[38px] font-semibold leading-[1.05] tracking-tight text-heading md:text-[58px]">
                        {article.heading}
                    </h1>
                </div>
            </header>

            <div className="mx-auto grid max-w-[1180px] gap-12 px-4 py-12 md:px-6 lg:grid-cols-[264px_1fr]">
                <ArticleToc sections={tocSections} />

                <main id="main" className="min-w-0 max-w-[720px]">
                    <div className="space-y-5 text-lg leading-relaxed text-body">
                        {article.intro.map((paragraph, index) => (
                            <p
                                key={index}
                                className={
                                    index === 0 ? 'text-xl leading-relaxed text-heading' : undefined
                                }
                            >
                                {renderInline(paragraph)}
                            </p>
                        ))}
                    </div>

                    <div className="mt-4">
                        {article.sections.map(section => (
                            <section key={section.id} id={section.id} className="scroll-mt-28 pt-12">
                                <h2 className="[font-family:var(--font-serif)] text-3xl font-semibold leading-tight tracking-tight text-heading md:text-[32px]">
                                    {section.title}
                                </h2>
                                <div className="mt-5 space-y-5 text-[17px] leading-relaxed text-body">
                                    {section.blocks.map((block, index) => (
                                        <ArticleBlockView key={index} block={block} />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>

                    <aside
                        className="mt-14 rounded-[18px] border border-[#e6dccb] bg-[#fbf8f2] p-6 md:p-8"
                        aria-label="Try the portfolio tool"
                    >
                        <div className="space-y-4 [font-family:var(--font-serif)] text-[18px] italic leading-relaxed text-heading">
                            {article.cta.paragraphs.map((paragraph, index) => (
                                <p key={index}>{renderInline(paragraph)}</p>
                            ))}
                        </div>
                        <div className="mt-6 flex flex-wrap gap-3">
                            {article.cta.actions.map(action => (
                                <Link
                                    key={action.href}
                                    href={action.href}
                                    className="primary-button"
                                >
                                    {action.label} -&gt;
                                </Link>
                            ))}
                        </div>
                    </aside>
                </main>
            </div>

            <LandingFooter note="Educational guidance only. Always confirm current ePortfolio and ARCP requirements with the RCGP and your supervisor." />
        </div>
    );
}

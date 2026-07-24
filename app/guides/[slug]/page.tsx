import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import GuideTimeline from '@/components/guides/GuideTimeline';
import { renderInline } from '@/components/guides/renderInline';
import LandingFooter from '@/components/landing/LandingFooter';
import LandingNavbar from '@/components/landing/LandingNavbar';
import type { ArticleBlock, GuideArticle } from '@/lib/guides/articleTypes';
import { guidePath } from '@/lib/guides/articleTypes';
import { getGuideArticle, guideArticles } from '@/lib/guides/articles';
import { CASE_LIBRARY_PATH, GUIDE_INDEX_PATH } from '@/lib/guides/scaPillarGuide';
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/site';

export function generateStaticParams() {
    return guideArticles.map(article => ({ slug: article.slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const article = getGuideArticle(slug);
    if (!article) {
        return { title: 'Guide not found | Fourteen Fisherman' };
    }

    return pageMetadata({
        title: article.metaTitle,
        description: article.metaDescription,
        path: guidePath(article.slug),
        type: 'article',
    });
}

function ArticleBlockView({ block }: { block: ArticleBlock }) {
    if (block.type === 'text') {
        return <p>{renderInline(block.text)}</p>;
    }

    if (block.type === 'statement') {
        return (
            <div className="rounded-xl border border-[#e6dccb] border-l-4 border-l-primary bg-[#fbf8f2] p-4">
                <p className="[font-family:var(--font-serif)] text-lg font-medium italic leading-snug text-heading">
                    “{block.label}”
                </p>
                <p className="mt-2 text-[16px] leading-relaxed text-body">
                    {renderInline(block.text)}
                </p>
            </div>
        );
    }

    if (block.type === 'note') {
        return (
            <div className="rounded-xl border border-dashed border-[#d8c9ad] bg-[#f3ecdd] p-4 text-[15px] leading-relaxed text-muted">
                <span className="mr-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Editorial note
                </span>
                {renderInline(block.text)}
            </div>
        );
    }

    // table
    return (
        <figure className="not-prose">
            <div className="overflow-x-auto overflow-y-hidden rounded-xl border border-[#e6dccb]">
                <table className="w-full border-collapse text-left text-[14px]">
                    <thead>
                        <tr className="bg-[#f0e9dc]">
                            {block.columns.map(column => (
                                <th
                                    key={column}
                                    className="border-b border-[#e6dccb] px-3 py-2.5 font-bold text-heading"
                                >
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="odd:bg-white even:bg-[#fbf8f2]">
                                {row.map((cell, cellIndex) => (
                                    <td
                                        key={cellIndex}
                                        className="border-b border-[#efe6d6] px-3 py-2.5 align-top text-body last:border-b-0"
                                    >
                                        {renderInline(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {block.caption && (
                <figcaption className="mt-2 text-[13px] leading-relaxed text-muted">
                    {renderInline(block.caption)}
                </figcaption>
            )}
        </figure>
    );
}

export default async function GuideArticlePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const article: GuideArticle | undefined = getGuideArticle(slug);
    if (!article) {
        notFound();
    }

    const timelineSections = article.sections.map((section, index) => ({
        id: section.id,
        number: String(index + 1).padStart(2, '0'),
        title: section.title,
    }));

    const articleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.heading,
        description: article.metaDescription,
        datePublished: '2026-06-21',
        dateModified: '2026-06-21',
        author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: { '@type': 'ImageObject', url: absoluteUrl('/fourteenfishermann.png') },
        },
        mainEntityOfPage: absoluteUrl(guidePath(article.slug)),
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Guides', item: absoluteUrl(GUIDE_INDEX_PATH) },
            {
                '@type': 'ListItem',
                position: 3,
                name: article.heading,
                item: absoluteUrl(guidePath(article.slug)),
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
                        <Link href={GUIDE_INDEX_PATH} className="hover:text-heading">
                            Guides
                        </Link>
                        <span> / {article.group}</span>
                    </nav>
                    <p className="mt-8 text-xs font-bold uppercase tracking-[0.26em] text-primary">
                        {article.kicker}
                    </p>
                    <h1 className="mt-4 [font-family:var(--font-serif)] text-[38px] font-semibold leading-[1.05] tracking-tight text-heading md:text-[58px]">
                        {article.heading}
                    </h1>
                    <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span>{article.readTime}</span>
                        <span className="h-1 w-1 rounded-full bg-muted" />
                        <span>{article.updated}</span>
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-[1180px] gap-12 px-4 py-12 md:px-6 lg:grid-cols-[264px_1fr]">
                <GuideTimeline sections={timelineSections} />

                <main id="main" className="min-w-0 max-w-[720px]">
                    {article.reviewNote && (
                        <div className="mb-8 rounded-xl border border-dashed border-[#d8c9ad] bg-[#f3ecdd] p-4 text-[14px] leading-relaxed text-muted">
                            <span className="mr-2 text-xs font-bold uppercase tracking-[0.14em] text-primary">
                                Before publishing
                            </span>
                            {article.reviewNote}
                        </div>
                    )}

                    <div className="space-y-5 text-lg leading-relaxed text-body">
                        {article.intro.map((paragraph, index) => (
                            <p
                                key={index}
                                className={index === 0 ? 'text-xl leading-relaxed text-heading' : undefined}
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
                </main>
            </div>

            <section className="bg-[#ebe2d4] px-4 py-16 md:px-6">
                <div className="mx-auto max-w-[1180px]">
                    <div className="relative overflow-hidden rounded-[22px] bg-[#241d18] p-8 text-[#f4efe6] md:p-12">
                        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
                        <div className="relative">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold">
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                Free, no paywall
                            </span>
                            <h2 className="mt-6 text-4xl font-extrabold leading-none tracking-tight text-white md:text-5xl">
                                Start practising{' '}
                                <em className="[font-family:var(--font-serif)] font-medium text-primary">
                                    today
                                </em>
                            </h2>
                            <p className="mt-5 max-w-2xl [font-family:var(--font-serif)] text-xl leading-relaxed text-[#c9bcaa]">
                                Our case library has 79 SCA practice cases built directly from the RCGP curriculum, each with a candidate brief, patient script, marking scheme and learning points. Free, with no paywall, whenever it helps.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                <Link href={CASE_LIBRARY_PATH} className="primary-button">
                                    Practice Free Cases -&gt;
                                </Link>
                                <Link
                                    href={GUIDE_INDEX_PATH}
                                    className="inline-flex items-center rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-[#f4efe6] transition hover:border-white/50 hover:bg-white/10"
                                >
                                    Browse all guides
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter note="Educational guidance only. Always confirm exam details on the RCGP website." />
        </div>
    );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import GuideTimeline from '@/components/guides/GuideTimeline';
import LandingFooter from '@/components/landing/LandingFooter';
import LandingNavbar from '@/components/landing/LandingNavbar';
import {
    CASE_LIBRARY_PATH,
    GUIDE_INDEX_PATH,
    SCA_PILLAR_PATH,
    guideSeriesGroups,
    pillarMeta,
    pillarSections,
} from '@/lib/guides/scaPillarGuide';
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
    title: pillarMeta.title,
    description: pillarMeta.description,
    path: SCA_PILLAR_PATH,
    type: 'article',
});

function GuideLinkCard({
    href,
    label,
    subtitle,
}: {
    href: string;
    label: string;
    subtitle: string;
}) {
    return (
        <Link
            href={href}
            className="group flex items-center justify-between gap-4 rounded-[11px] border border-[#e6dccb] bg-[#fbf8f2] px-4 py-3 text-heading transition hover:-translate-y-0.5 hover:border-primary hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
            <span>
                <span className="block text-[15px] font-semibold leading-snug">{label}</span>
                <span className="mt-0.5 block text-[13px] font-normal text-muted">{subtitle}</span>
            </span>
            <span className="text-lg text-primary transition group-hover:translate-x-0.5" aria-hidden>
                -&gt;
            </span>
        </Link>
    );
}

function SeriesCard({
    href,
    label,
    subtitle,
    number,
}: {
    href: string;
    label: string;
    subtitle: string;
    number: string;
}) {
    return (
        <Link
            href={href}
            className="group flex gap-4 rounded-[14px] border border-[#e6dccb] bg-[#fbf8f2] p-5 text-left transition hover:-translate-y-1 hover:border-primary hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
            <span className="[font-family:var(--font-serif)] text-xl italic leading-none text-primary">
                {number}
            </span>
            <span>
                <span className="block text-base font-bold leading-snug text-heading">{label}</span>
                <span className="mt-1 block text-sm leading-snug text-muted">{subtitle}</span>
            </span>
        </Link>
    );
}

function SeriesIndex() {
    return (
        <section className="border-y border-[#e2d8c8] bg-[#ebe2d4] py-16" aria-label="The complete series">
            <div className="mx-auto max-w-[1180px] px-4 md:px-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.26em] text-primary">
                    The complete series
                </p>
                <h2 className="[font-family:var(--font-serif)] text-3xl font-semibold leading-tight text-heading md:text-5xl">
                    Fifteen guides, one map
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-body">
                    This page is the overview. Each part above expands into a deeper guide, grouped here by where it fits in your preparation.
                </p>

                <div className="mt-10 space-y-9">
                    {guideSeriesGroups.map(group => (
                        <section key={group.label}>
                            <div className="mb-4 flex items-center gap-3">
                                <span className="h-2 w-2 rounded-full bg-primary" />
                                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                                    {group.label}
                                </h3>
                                <span className="h-px flex-1 bg-[#e2d8c8]" />
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {group.cards.map(card => (
                                    <SeriesCard key={card.href} {...card} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function HowToPassMrcgpScaPage() {
    const articleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: pillarMeta.title,
        description: pillarMeta.description,
        datePublished: '2026-06-21',
        dateModified: '2026-06-21',
        author: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
        },
        publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: {
                '@type': 'ImageObject',
                url: absoluteUrl('/fourteenfishermann.png'),
            },
        },
        mainEntityOfPage: absoluteUrl(SCA_PILLAR_PATH),
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: SITE_URL,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Guides',
                item: absoluteUrl(GUIDE_INDEX_PATH),
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: 'How to Pass the MRCGP SCA',
                item: absoluteUrl(SCA_PILLAR_PATH),
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
                    <nav className="text-xs font-bold uppercase tracking-[0.16em] text-muted" aria-label="Breadcrumb">
                        <Link href={GUIDE_INDEX_PATH} className="hover:text-heading">
                            Guides
                        </Link>
                        <span> / Pillar guide</span>
                    </nav>
                    <p className="mt-8 text-xs font-bold uppercase tracking-[0.26em] text-primary">
                        The complete guide
                    </p>
                    <h1 className="mt-4 max-w-[14ch] [font-family:var(--font-serif)] text-[42px] font-semibold leading-none tracking-tight text-heading md:text-[68px]">
                        How to pass the MRCGP SCA
                    </h1>
                    <p className="mt-6 max-w-3xl text-lg leading-relaxed text-body md:text-xl">
                        The final clinical hurdle of GP training, explained end to end: what the exam is, how it is marked, how to structure 12 minutes, and how to prepare so you pass first time.
                    </p>
                    <div className="mt-7 flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span>{pillarMeta.readTime}</span>
                        <span className="h-1 w-1 rounded-full bg-muted" />
                        <span>{pillarMeta.updated}</span>
                        {pillarMeta.tags.map(tag => (
                            <span
                                key={tag}
                                className="rounded-full border border-[#e6dccb] bg-[#f0e9dc] px-3 py-1 text-xs font-medium text-body"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </header>

            <div className="mx-auto grid max-w-[1180px] gap-12 px-4 py-12 md:px-6 lg:grid-cols-[264px_1fr]">
                <GuideTimeline sections={pillarSections.map(({ id, number, title }) => ({ id, number, title }))} />

                <main id="main" className="min-w-0 max-w-[720px]">
                    <div className="space-y-6 text-lg leading-relaxed text-body">
                        <p className="text-xl leading-relaxed text-heading">
                            The Simulated Consultation Assessment is the final clinical hurdle of GP training, and it is a high stakes one, with a four figure fee and a pass rate that fails a meaningful share of every cohort. Most candidates consult competently every day and still find it daunting, because performing under exam conditions is a different task from a normal surgery.
                        </p>
                        <p>
                            Here is the most useful thing to understand before you read anything else: the SCA is a consultation exam, not a knowledge exam. The candidates who struggle are usually not the ones who missed a rare diagnosis. They are the ones who ran out of time, talked past the patient, or consulted mechanically. The skills that pass the SCA are specific, observable and trainable, and this guide covers all of them.
                        </p>
                        <p>
                            Each section gives you the working summary and links to a deeper guide on that topic.
                        </p>
                    </div>

                    <div className="mt-4">
                        {pillarSections.map(section => (
                            <section
                                key={section.id}
                                id={section.id}
                                className="scroll-mt-28 pt-12"
                            >
                                <span className="[font-family:var(--font-serif)] text-lg italic text-primary">
                                    {section.number}
                                </span>
                                <h2 className="mt-2 [font-family:var(--font-serif)] text-3xl font-semibold leading-tight tracking-tight text-heading md:text-[34px]">
                                    {section.title}
                                </h2>

                                <div className="mt-5 space-y-5 text-[17px] leading-relaxed text-body">
                                    {section.paragraphs.slice(0, section.pullQuote ? 1 : undefined).map(paragraph => (
                                        <p key={paragraph}>{paragraph}</p>
                                    ))}
                                </div>

                                {section.domains && (
                                    <div className="mt-5 grid gap-3">
                                        {section.domains.map(domain => (
                                            <div
                                                key={domain.title}
                                                className="rounded-xl border border-[#e6dccb] border-l-primary bg-[#fbf8f2] p-4"
                                            >
                                                <h3 className="text-base font-bold text-heading">{domain.title}</h3>
                                                <p className="mt-1 text-[15px] leading-relaxed text-body">
                                                    {domain.body}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {section.pullQuote && (
                                    <>
                                        <blockquote className="mt-6 border-l-4 border-primary pl-5">
                                            <p className="[font-family:var(--font-serif)] text-2xl font-medium leading-snug text-heading">
                                                {section.pullQuote}
                                            </p>
                                        </blockquote>
                                        <div className="mt-5 space-y-5 text-[17px] leading-relaxed text-body">
                                            {section.paragraphs.slice(1).map(paragraph => (
                                                <p key={paragraph}>{paragraph}</p>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {section.links && (
                                    <div className="mt-6 flex flex-col gap-2">
                                        {section.links.map(link => (
                                            <GuideLinkCard key={link.href} {...link} />
                                        ))}
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                </main>
            </div>

            <SeriesIndex />

            <section className="bg-[#ebe2d4] px-4 py-16 md:px-6">
                <div className="mx-auto max-w-[1180px]">
                    <div className="relative overflow-hidden rounded-[22px] bg-[#241d18] p-8 text-[#f4efe6] md:p-12">
                        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
                        <div className="relative">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold">
                                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                Free, no paywall
                            </span>
                            <h2 className="mt-6 text-4xl font-extrabold leading-none tracking-tight text-white md:text-6xl">
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

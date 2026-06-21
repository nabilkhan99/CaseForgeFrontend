import type { Metadata } from 'next';
import Link from 'next/link';
import LandingFooter from '@/components/landing/LandingFooter';
import LandingNavbar from '@/components/landing/LandingNavbar';
import {
    CASE_LIBRARY_PATH,
    SCA_PILLAR_PATH,
    guideSeriesGroups,
} from '@/lib/guides/scaPillarGuide';
import { pageMetadata } from '@/lib/seo/site';

export const metadata: Metadata = pageMetadata({
    title: 'MRCGP SCA Guides',
    description:
        'A structured guide series for GP registrars preparing for the MRCGP SCA, covering exam format, marking, consultation structure and practice strategy.',
    path: '/guides',
});

export default function GuidesIndexPage() {
    return (
        <div className="min-h-[100dvh] bg-[#f4efe6] text-body">
            <LandingNavbar user={null} />
            <main className="mx-auto max-w-[1180px] px-4 pb-20 pt-32 md:px-6">
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-primary">
                    SCA Guide Series
                </p>
                <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
                    <div>
                        <h1 className="max-w-3xl [font-family:var(--font-serif)] text-[42px] font-semibold leading-none tracking-tight text-heading md:text-[64px]">
                            One map for passing the MRCGP SCA
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-body">
                            Start with the complete pillar guide, then move through the focused guides for marking, structure, communication, resources and exam-day preparation.
                        </p>
                    </div>
                    <div className="rounded-[18px] border border-[#e6dccb] bg-[#fbf8f2] p-6">
                        <p className="text-sm font-semibold text-heading">
                            New here?
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-body">
                            Read the complete guide first. It explains how the whole series fits together.
                        </p>
                        <Link href={SCA_PILLAR_PATH} className="primary-button mt-5">
                            Read the complete guide
                        </Link>
                    </div>
                </div>

                <section className="mt-14 space-y-10" aria-label="Guide series">
                    {guideSeriesGroups.map(group => (
                        <div key={group.label}>
                            <div className="mb-4 flex items-center gap-3">
                                <span className="h-2 w-2 rounded-full bg-primary" />
                                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                                    {group.label}
                                </h2>
                                <span className="h-px flex-1 bg-[#e2d8c8]" />
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {group.cards.map(card => {
                                    const isPillar = card.href === SCA_PILLAR_PATH;
                                    return (
                                        <Link
                                            key={card.href}
                                            href={card.href}
                                            className="group flex gap-4 rounded-[14px] border border-[#e6dccb] bg-[#fbf8f2] p-5 transition hover:-translate-y-1 hover:border-primary hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                        >
                                            <span className="[font-family:var(--font-serif)] text-xl italic leading-none text-primary">
                                                {card.number}
                                            </span>
                                            <span>
                                                <span className="block text-base font-bold leading-snug text-heading">
                                                    {card.label}
                                                    {isPillar && (
                                                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                                                            Start here
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="mt-1 block text-sm leading-snug text-muted">
                                                    {card.subtitle}
                                                </span>
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </section>

                <section className="mt-16 rounded-[22px] bg-[#241d18] p-8 text-[#f4efe6] md:p-10">
                    <h2 className="text-3xl font-extrabold tracking-tight text-white">
                        Ready to practise?
                    </h2>
                    <p className="mt-3 max-w-2xl text-[#c9bcaa]">
                        Pair the guides with free SCA practice cases built from the RCGP curriculum.
                    </p>
                    <Link href={CASE_LIBRARY_PATH} className="primary-button mt-6">
                        Practice Free Cases
                    </Link>
                </section>
            </main>
            <LandingFooter note="Educational guidance only. Always confirm exam details on the RCGP website." />
        </div>
    );
}

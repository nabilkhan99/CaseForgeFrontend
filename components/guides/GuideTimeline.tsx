'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CASE_LIBRARY_PATH, type PillarSection } from '@/lib/guides/scaPillarGuide';

interface GuideTimelineProps {
    sections: Pick<PillarSection, 'id' | 'number' | 'title'>[];
}

export default function GuideTimeline({ sections }: GuideTimelineProps) {
    const [activeId, setActiveId] = useState(sections[0]?.id ?? '');

    useEffect(() => {
        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setActiveId(entry.target.id);
                    }
                });
            },
            { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
        );

        sections.forEach(section => {
            const element = document.getElementById(section.id);
            if (element) observer.observe(element);
        });

        return () => observer.disconnect();
    }, [sections]);

    return (
        <>
            <aside className="hidden lg:block sticky top-28 self-start" aria-label="On this page">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-4">
                    On this page
                </p>
                <ol className="relative space-y-0 before:absolute before:left-[5px] before:top-3 before:bottom-3 before:w-px before:bg-[#e2d8c8]">
                    {sections.map(section => {
                        const active = activeId === section.id;
                        return (
                            <li key={section.id} className="relative">
                                <Link
                                    href={`#${section.id}`}
                                    aria-current={active ? 'true' : undefined}
                                    className={`group flex gap-3 py-2 pl-6 text-sm leading-snug transition-colors ${
                                        active ? 'text-heading font-semibold' : 'text-muted hover:text-heading'
                                    }`}
                                >
                                    <span
                                        aria-hidden
                                        className={`absolute left-0 top-[14px] h-3 w-3 rounded-full border-2 transition-colors ${
                                            active
                                                ? 'border-primary bg-primary'
                                                : 'border-[#e2d8c8] bg-[#f4efe6] group-hover:border-primary/50'
                                        }`}
                                    />
                                    <span
                                        className={`min-w-[24px] font-serif text-xs italic ${
                                            active ? 'text-primary' : 'text-muted'
                                        }`}
                                    >
                                        {section.number}
                                    </span>
                                    <span>{section.title}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ol>

                <div className="mt-7 rounded-[14px] border border-[#e6dccb] bg-[#fbf8f2] p-5">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        Free, no paywall
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-body">
                        79 practice cases with marking schemes, built from the RCGP curriculum.
                    </p>
                    <Link
                        href={CASE_LIBRARY_PATH}
                        className="primary-button mt-4 w-full justify-center !rounded-[11px] !px-4 !py-3 text-sm"
                    >
                        Practice Free Cases
                    </Link>
                </div>
            </aside>

            <div className="lg:hidden sticky top-0 z-20 -mx-4 mb-8 border-b border-[#e2d8c8] bg-[#f4efe6]/95 px-4 backdrop-blur md:-mx-6 md:px-6">
                <details className="py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-heading [&::-webkit-details-marker]:hidden">
                        On this page
                        <span className="text-lg text-primary">+</span>
                    </summary>
                    <ol className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {sections.map(section => (
                            <li key={section.id}>
                                <Link
                                    href={`#${section.id}`}
                                    className="block rounded-lg px-2 py-2 text-sm text-body hover:bg-white/60 hover:text-heading"
                                >
                                    <span className="mr-2 font-serif text-xs italic text-primary">
                                        {section.number}
                                    </span>
                                    {section.title}
                                </Link>
                            </li>
                        ))}
                    </ol>
                </details>
            </div>
        </>
    );
}

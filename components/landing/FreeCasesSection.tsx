'use client';

import Link from 'next/link';
import { BlurFade } from '@/components/magicui/blur-fade';
import { NumberTicker } from '@/components/magicui/number-ticker';
import { motion } from 'framer-motion';

const heroCategories = [
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
        ),
        name: 'Cardiovascular',
        cases: 3,
        sampleBrief: 'A 58-year-old man presents with central chest pain radiating to his left arm...',
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
        ),
        name: 'Mental Health',
        cases: 3,
        sampleBrief: 'A 28-year-old woman returns for a follow-up. She was started on sertraline 6 weeks ago...',
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
            </svg>
        ),
        name: 'Paediatrics',
        cases: 3,
        sampleBrief: 'A mother brings her 3-year-old with a 2-day history of fever and reduced oral intake...',
    },
];

const compactCategories = [
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
        ),
        name: 'Respiratory',
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
        ),
        name: "Women's Health",
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
        ),
        name: 'Neurology',
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
        ),
        name: 'Dermatology',
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
        ),
        name: 'Older Adults',
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
        ),
        name: 'Urgent Care',
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
        ),
        name: 'Ophthalmology',
    },
    {
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75Z" />
            </svg>
        ),
        name: 'ENT',
    },
];

export default function FreeCasesSection() {
    return (
        <motion.section
            id="free-cases"
            className="py-20 lg:py-28 bg-surface relative"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
            {/* Section divider */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header — left-aligned */}
                <div className="max-w-3xl mb-12">
                    <BlurFade delay={0} inView>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/[0.12] text-xs font-medium text-primary bg-primary/[0.07] mb-5">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            100% Free — No Account Required
                        </div>
                    </BlurFade>

                    <BlurFade delay={0.08} inView>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-heading leading-tight mb-4">
                            78 cases across 26 topics.{' '}
                            <span className="text-muted">Built from the RCGP curriculum.</span>
                        </h2>
                    </BlurFade>

                    <BlurFade delay={0.12} inView>
                        <p className="text-base text-body leading-relaxed">
                            Full patient scripts, marking schemes, and examiner notes for every case.
                            Practice with a friend — completely free.
                        </p>
                    </BlurFade>
                </div>

                {/* Hero categories — 3 cards with case peek */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-black/[0.06] rounded-2xl overflow-hidden border border-black/[0.04] mb-8">
                    {heroCategories.map((cat, i) => (
                        <BlurFade key={cat.name} delay={0.04 * i} inView>
                            <div className="bg-white/60 backdrop-blur-sm p-6 h-full group hover:shadow-elevation-1 transition-all duration-300">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center border border-black/[0.06] group-hover:border-primary/[0.12] transition-colors">
                                        <span className="text-body group-hover:text-primary transition-colors">
                                            {cat.icon}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-heading">{cat.name}</h3>
                                        <p className="text-[10px] text-muted font-medium uppercase tracking-wider">{cat.cases} cases</p>
                                    </div>
                                </div>

                                {/* Case peek */}
                                <div className="bg-white/70 rounded-lg p-3 border border-black/[0.06]">
                                    <p className="text-[11px] text-muted italic leading-relaxed line-clamp-2">
                                        &ldquo;{cat.sampleBrief}&rdquo;
                                    </p>
                                    <p className="text-[9px] text-muted/60 mt-2 uppercase font-semibold tracking-wider">
                                        Sample patient brief
                                    </p>
                                </div>
                            </div>
                        </BlurFade>
                    ))}
                </div>

                {/* Compact category pills */}
                <BlurFade delay={0.16} inView>
                    <div className="flex flex-wrap gap-2 mb-10">
                        {compactCategories.map((cat) => (
                            <div
                                key={cat.name}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/[0.06] border border-primary/[0.1] text-xs font-medium text-primary hover:bg-primary/[0.1] hover:border-primary/20 transition-all duration-200"
                            >
                                {cat.icon}
                                {cat.name}
                            </div>
                        ))}
                        <div className="flex items-center px-3 py-2 rounded-lg border border-black/[0.06] text-xs font-medium text-muted">
                            +10 more specialties
                        </div>
                    </div>
                </BlurFade>

                {/* Stat bar — big JetBrains Mono numbers */}
                <BlurFade delay={0.2} inView>
                    <div className="relative -mb-14 z-20">
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-6 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-6 border border-black/[0.06] shadow-elevation-2">
                            <div className="grid grid-cols-3 gap-4 sm:flex sm:items-center sm:gap-12 flex-1 w-full sm:w-auto">
                                <div className="text-center">
                                    <p className="font-mono text-[48px] font-bold text-heading tracking-[-0.04em] leading-none">
                                        <NumberTicker value={26} className="font-mono text-[48px] font-bold text-heading tracking-[-0.04em]" />
                                    </p>
                                    <p className="text-[13px] text-muted font-medium mt-1">RCGP Topics</p>
                                </div>
                                <div className="hidden sm:block w-px h-10 bg-black/[0.06]" />
                                <div className="text-center">
                                    <p className="font-mono text-[48px] font-bold text-heading tracking-[-0.04em] leading-none">
                                        <NumberTicker value={78} className="font-mono text-[48px] font-bold text-heading tracking-[-0.04em]" />
                                    </p>
                                    <p className="text-[13px] text-muted font-medium mt-1">Free Cases</p>
                                </div>
                                <div className="hidden sm:block w-px h-10 bg-black/[0.06]" />
                                <div className="text-center">
                                    <p className="font-mono text-[48px] font-bold text-heading tracking-[-0.04em] leading-none">
                                        <NumberTicker value={12} className="font-mono text-[48px] font-bold text-heading tracking-[-0.04em]" suffix=" min" />
                                    </p>
                                    <p className="text-[13px] text-muted font-medium mt-1">Per Station</p>
                                </div>
                            </div>
                            <Link
                                href="/cases"
                                className="inline-flex items-center gap-1.5 px-6 py-3 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-light active:scale-[0.98] transition-all duration-150 shadow-elevation-1 whitespace-nowrap"
                            >
                                Browse All Cases
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                </svg>
                            </Link>
                        </div>
                    </div>
                </BlurFade>
            </div>
        </motion.section>
    );
}

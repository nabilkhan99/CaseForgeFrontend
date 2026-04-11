'use client';

import { useEffect, useRef, useState } from 'react';
import { domainScores, feedbackItems } from '@/lib/landing/mock-data';
import { BlurFade } from '@/components/magicui/blur-fade';
import { motion } from 'framer-motion';

const domainColors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
};

function AnimatedBar({ score, bgColor, delay }: { score: number; bgColor: string; delay: number }) {
    const [width, setWidth] = useState(0);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => setWidth(score), delay);
                }
            },
            { threshold: 0.5 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [score, delay]);

    return (
        <div ref={ref} className="w-full bg-black/[0.06] rounded-full h-2">
            <div
                className={`${bgColor} h-2 rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${width}%` }}
            />
        </div>
    );
}

export default function FeedbackAnalysisSection() {
    return (
        <motion.section
            className="py-20 lg:py-28 bg-surface relative"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
            {/* Section divider */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                    {/* Left - Performance Card */}
                    <BlurFade delay={0} inView className="w-full lg:w-5/12">
                        <div className="bg-white shadow-elevation-2 border border-black/[0.04] rounded-2xl overflow-hidden">
                            {/* Header */}
                            <div className="bg-stone-50 px-5 py-3.5 border-b border-black/[0.06] flex justify-between items-center">
                                <span className="text-xs font-semibold text-heading">
                                    Performance Analysis
                                </span>
                                <span className="px-2.5 py-0.5 rounded-md bg-success/10 text-success text-[10px] font-bold uppercase border border-success/20">
                                    Passed
                                </span>
                            </div>

                            <div className="p-5">
                                {/* Domain Scores — clean solid bars */}
                                <div className="space-y-5 mb-6">
                                    {domainScores.map((domain, index) => {
                                        const bgColor = domainColors[domain.color] || 'bg-blue-500';
                                        return (
                                            <div key={index}>
                                                <div className="flex justify-between items-end mb-2">
                                                    <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                                                        {domain.name}
                                                    </span>
                                                    <span className="text-heading font-bold text-xs">
                                                        {domain.score}%
                                                    </span>
                                                </div>
                                                <AnimatedBar
                                                    score={domain.score}
                                                    bgColor={bgColor}
                                                    delay={200 * index}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Feedback Items */}
                                <div className="space-y-2 pt-4 border-t border-black/[0.06]">
                                    {feedbackItems.map((item, index) => (
                                        <div
                                            key={index}
                                            className="p-3 bg-stone-50 rounded-lg border border-black/[0.06] flex gap-2.5"
                                        >
                                            {item.type === 'success' ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-amber-500">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                                                </svg>
                                            )}
                                            <div className="text-[11px]">
                                                <strong className="text-heading block mb-0.5">
                                                    {item.title}
                                                </strong>
                                                <span className="text-body">{item.description}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </BlurFade>

                    {/* Right - Content */}
                    <div className="w-full lg:w-7/12">
                        <BlurFade delay={0.08} inView>
                            <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-3">
                                AI-Powered Feedback
                            </p>
                        </BlurFade>

                        <BlurFade delay={0.12} inView>
                            <h2 className="text-3xl md:text-4xl font-bold text-heading mb-4 leading-tight">
                                Go beyond
                                <span className="text-muted"> &ldquo;pass&rdquo;</span> or
                                <span className="text-muted"> &ldquo;fail&rdquo;</span>
                            </h2>
                        </BlurFade>

                        <BlurFade delay={0.16} inView>
                            <p className="text-base text-body mb-8 leading-relaxed">
                                The SCA isn&apos;t just about the diagnosis. It&apos;s about <em>how</em> you
                                manage the consultation. Our AI breaks down your performance across the
                                three RCGP domains with actionable, specific feedback.
                            </p>
                        </BlurFade>

                        {/* Before / After — clean split */}
                        <BlurFade delay={0.2} inView>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-black/[0.06] rounded-xl overflow-hidden border border-black/[0.04] mb-8">
                                <div className="p-5 bg-white/60">
                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">
                                        Without Fourteen Fisherman
                                    </p>
                                    <p className="text-sm text-muted italic">&ldquo;You passed.&rdquo;</p>
                                    <p className="text-sm text-muted italic mt-1">&ldquo;You failed.&rdquo;</p>
                                </div>
                                <div className="p-5 bg-white/60">
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">
                                        With Fourteen Fisherman
                                    </p>
                                    <p className="text-sm text-body leading-relaxed">
                                        &ldquo;Your safety-netting was strong — you covered red flags for meningitis.
                                        However, the patient mentioned &apos;work stress&apos; twice. Exploring their ICE
                                        here would have improved your interpersonal score.&rdquo;
                                    </p>
                                </div>
                            </div>
                        </BlurFade>

                        <BlurFade delay={0.24} inView>
                            <div className="flex flex-wrap gap-4">
                                {[
                                    {
                                        icon: (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                                            </svg>
                                        ),
                                        label: 'Domain-specific scores',
                                    },
                                    {
                                        icon: (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                                            </svg>
                                        ),
                                        label: 'Progress tracking',
                                    },
                                    {
                                        icon: (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                                            </svg>
                                        ),
                                        label: 'Actionable tips',
                                    },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center gap-2 text-sm text-body">
                                        <span className="text-muted">{item.icon}</span>
                                        {item.label}
                                    </div>
                                ))}
                            </div>
                        </BlurFade>
                    </div>
                </div>
            </div>
        </motion.section>
    );
}

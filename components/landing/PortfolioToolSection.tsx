'use client';

import { BlurFade } from '@/components/magicui/blur-fade';
import { BorderBeam } from '@/components/magicui/border-beam';

export default function PortfolioToolSection() {
    return (
        <section className="py-16 bg-[#0f172a] border-t border-slate-800/50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <BlurFade delay={0} inView>
                    <div className="relative rounded-2xl overflow-hidden">
                        {/* Gradient background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-600/10 to-primary/20" />
                        <div className="absolute inset-0 bg-[#0f172a]/80" />
                        <BorderBeam size={200} duration={18} colorFrom="#8b5cf6" colorTo="#6366f1" />

                        <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
                            {/* Icon / Visual */}
                            <div className="shrink-0">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-purple-600/30 border border-primary/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-4xl text-primary">
                                        work
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 text-center md:text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full mb-3">
                                    <span className="material-symbols-outlined text-amber-400 text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        trending_up
                                    </span>
                                    <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                                        Trusted by thousands
                                    </span>
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                                    From the Team Behind the Fourteen Fisherman Portfolio Tool
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                                    Our portfolio tool has helped thousands of GP trainees organise
                                    and present their training evidence. Now we&apos;re bringing the
                                    same quality to SCA preparation.
                                </p>
                            </div>

                            {/* CTA */}
                            <div className="shrink-0">
                                <a
                                    href="https://fourteenfisherman.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700/50 text-white font-medium rounded-xl border border-slate-600 hover:bg-slate-700 transition-all text-sm"
                                >
                                    Visit Portfolio Tool
                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </BlurFade>
            </div>
        </section>
    );
}

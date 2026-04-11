'use client';

import Link from 'next/link';

import HeroChatSimulation from './HeroChatSimulation';
import { BlurFade } from '@/components/magicui/blur-fade';

export default function HeroSection() {
    return (
        <header className="relative pt-28 pb-20 lg:pt-36 lg:pb-32 overflow-hidden">
            {/* Background — clean dark with very subtle grain texture */}
            <div className="absolute inset-0 bg-[#09090b]" />
            {/* Single accent glow — extremely subtle, off-center */}
            <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-blue-500/[0.04] blur-[150px] rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Two-column split */}
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                    {/* Left — Headlines & CTAs */}
                    <div className="flex-1 text-center lg:text-left max-w-2xl">
                        <BlurFade delay={0} inView>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 text-xs font-medium text-zinc-400 mb-8">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Built by RCGP trainees, for RCGP trainees
                            </div>
                        </BlurFade>

                        <BlurFade delay={0.08} inView>
                            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold text-white tracking-tight leading-[1.08] mb-6">
                                Pass Your SCA.{' '}
                                <span className="text-blue-500">First Time.</span>
                            </h1>
                        </BlurFade>

                        <BlurFade delay={0.16} inView>
                            <p className="text-lg md:text-xl text-zinc-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                                Realistic 12-minute mock stations with AI patients that respond,
                                challenge, and score you — exactly like the real exam.
                            </p>
                        </BlurFade>

                        {/* CTAs — solid, magnetic, no shimmer */}
                        <BlurFade delay={0.24} inView>
                            <div className="flex flex-col sm:flex-row gap-3 mb-10 justify-center lg:justify-start">
                                <Link
                                    href="/try"
                                    className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-500 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-blue-600/25"
                                >
                                    Start Your First Mock — Free
                                    <span className="material-symbols-outlined ml-2 text-lg">arrow_forward</span>
                                </Link>
                                <Link
                                    href="/pricing"
                                    className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-zinc-300 font-medium rounded-xl border border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700 hover:text-white transition-all duration-200 text-base"
                                >
                                    See Plans
                                </Link>
                            </div>
                        </BlurFade>

                        {/* Trust anchors — crisp, no neon */}
                        <BlurFade delay={0.32} inView>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500 justify-center lg:justify-start">
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                    78 free cases
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                    No credit card
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                    AI feedback in seconds
                                </span>
                            </div>
                        </BlurFade>
                    </div>

                    {/* Right — Precision App Preview (no BorderBeam, no floating pills) */}
                    <BlurFade delay={0.2} inView className="flex-1 w-full max-w-2xl lg:max-w-none">
                        <div className="relative">
                            {/* Main preview card — clean, sharp, professional */}
                            <div className="relative bg-[#111318] rounded-2xl border border-zinc-800 shadow-2xl shadow-black/50 overflow-hidden ring-1 ring-white/[0.03]">

                                {/* Window Chrome — macOS style */}
                                <div className="bg-[#0c0c0f] px-4 py-3 border-b border-zinc-800/80 flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                                        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                                        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                                    </div>
                                    <div className="flex-1 text-center">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-800/50">
                                            <span className="text-[11px] text-zinc-500 font-medium">Fourteen Fisherman — Mock Station</span>
                                        </div>
                                    </div>
                                    <div className="w-[54px]" /> {/* Spacer for symmetry */}
                                </div>

                                {/* App Content */}
                                <div className="flex text-left">
                                    {/* Sidebar (desktop only) */}
                                    <aside className="hidden md:flex w-48 flex-col bg-[#0c0c0f] border-r border-zinc-800/60 p-3 gap-1.5">
                                        <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1 px-1">
                                            Stations
                                        </div>
                                        {['Chest Pain', 'Paediatrics', 'Ophthalmology'].map((station, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-zinc-500"
                                            >
                                                <span className="material-symbols-outlined text-emerald-600 text-xs">check_circle</span>
                                                <span className="text-[11px]">{i + 1}: {station}</span>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                            <span className="material-symbols-outlined text-blue-500 text-xs">play_circle</span>
                                            <div>
                                                <p className="text-[11px] font-semibold text-white">4: Acute Abdomen</p>
                                                <p className="text-[9px] text-blue-400 font-medium">In Progress</p>
                                            </div>
                                        </div>
                                    </aside>

                                    {/* Main Content */}
                                    <main className="flex-1 flex flex-col bg-[#111318] h-[350px] sm:h-[380px]">
                                        {/* Timer Bar */}
                                        <div className="h-10 border-b border-zinc-800/60 bg-[#0c0c0f] flex items-center justify-between px-4">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-red-500 text-xs">timer</span>
                                                <span className="text-red-400 font-mono font-bold text-sm">08:42</span>
                                            </div>
                                            <div className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500 font-medium">
                                                Station 4 / 12
                                            </div>
                                        </div>

                                        {/* Patient info strip */}
                                        <div className="px-4 py-2.5 border-b border-zinc-800/40 flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-zinc-500 text-sm">person</span>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold text-white">Sarah Jenkins, 32F</p>
                                                <p className="text-[10px] text-zinc-600">Acute Abdomen — Urgent Appointment</p>
                                            </div>
                                        </div>

                                        {/* Chat Area */}
                                        <div className="flex-1 bg-[#0a0a0e] overflow-hidden relative">
                                            <HeroChatSimulation />
                                        </div>
                                    </main>
                                </div>
                            </div>
                        </div>
                    </BlurFade>
                </div>
            </div>
        </header>
    );
}

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

import HeroChatSimulation from './HeroChatSimulation';

export default function HeroSection() {
    return (
        <section className="max-w-[1200px] mx-auto px-12 pt-[160px] pb-[120px] relative">
            {/* Ambient gradient orb */}
            <div className="absolute top-0 right-[-200px] w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(180,83,9,0.06)_0%,transparent_50%)] pointer-events-none" />

            <div className="flex items-start gap-20 flex-col lg:flex-row">
                {/* Left: Copy */}
                <motion.div
                    className="flex-[1.2] relative z-[2]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Eyebrow */}
                    <div className="flex items-center gap-3 mb-6">
                        <span className="uppercase text-[12px] font-semibold tracking-[0.08em] text-primary">
                            Built by GP trainees
                        </span>
                        <span className="flex-1 h-px bg-primary/20 max-w-[48px]" />
                    </div>

                    {/* Headline */}
                    <h1 className="text-[64px] font-extrabold text-heading tracking-[-0.045em] leading-[1.0] mb-6">
                        Practice that
                        <br />
                        <em className="gradient-text not-italic">actually</em>
                        <br />
                        prepares you
                    </h1>

                    {/* Subtext */}
                    <p className="text-[18px] text-[#78716C] leading-[1.7] max-w-[460px] mb-10">
                        Realistic 12-minute mock stations with AI patients that respond,
                        challenge, and score you — exactly like the real exam.
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-start gap-4 mb-10">
                        <Link
                            href="/try"
                            className="primary-button"
                        >
                            Start Your First Mock — Free
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4"
                            >
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </Link>
                        <Link
                            href="#how-it-works"
                            className="inline-flex items-center gap-2 text-[15px] font-medium text-body hover:text-heading transition-colors duration-150 mt-1"
                        >
                            See how it works
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-4 h-4"
                            >
                                <path d="M5 12h14" />
                                <path d="m12 5 7 7-7 7" />
                            </svg>
                        </Link>
                    </div>

                    {/* Trust row */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
                        {['78 free cases', 'No credit card', 'AI feedback in seconds'].map((item) => (
                            <span key={item} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary-lighter shrink-0" />
                                {item}
                            </span>
                        ))}
                    </div>
                </motion.div>

                {/* Right: Product Preview */}
                <motion.div
                    className="flex-1 relative z-[1] w-full"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.3 }}
                >
                    <div className="relative">
                        {/* Preview window */}
                        <motion.div
                            className="relative glass-panel rounded-[20px] shadow-elevation-4 overflow-hidden"
                            initial={{ rotate: 1 }}
                            whileHover={{ rotate: 0, y: -4 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        >
                            {/* macOS top bar */}
                            <div className="bg-white/80 backdrop-blur-sm px-4 py-3 border-b border-black/[0.06] flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                                </div>
                                <div className="flex-1 text-center">
                                    <span className="font-mono text-[11px] text-muted font-medium">
                                        08:42 remaining
                                    </span>
                                </div>
                                <div className="w-[54px]" />
                            </div>

                            {/* Patient info strip */}
                            <div className="bg-surface px-4 py-3 border-b border-black/[0.05] flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shrink-0">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="w-4 h-4 text-amber-700"
                                        >
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[12px] font-semibold text-heading">Sarah Jenkins, 32F</p>
                                        <p className="text-[10px] text-muted">Acute Abdomen — Urgent Appointment</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-50 border border-red-100 text-[10px] font-semibold text-red-600 uppercase tracking-wide">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    Live
                                </span>
                            </div>

                            {/* Chat area */}
                            <div className="bg-surface/60 h-[280px] sm:h-[300px] overflow-hidden relative">
                                <HeroChatSimulation />
                            </div>

                            {/* Waveform bar */}
                            <div className="bg-white/70 backdrop-blur-sm border-t border-black/[0.04] px-4 py-3 flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary-light/20 flex items-center justify-center shrink-0">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="w-3 h-3 text-primary"
                                    >
                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" x2="12" y1="19" y2="22" />
                                    </svg>
                                </div>
                                <div className="flex-1 flex items-center gap-[3px] h-6">
                                    {Array.from({ length: 28 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 rounded-full bg-primary/30"
                                            style={{
                                                height: `${20 + Math.sin(i * 0.7) * 16 + Math.cos(i * 1.3) * 10}%`,
                                                animationDelay: `${i * 60}ms`,
                                                animation: 'pulse-bar 1.2s ease-in-out infinite',
                                            }}
                                        />
                                    ))}
                                </div>
                                <span className="text-[10px] font-mono text-muted">08:42</span>
                            </div>
                        </motion.div>

                        {/* Floating score card */}
                        <motion.div
                            className="absolute bottom-[-24px] left-[-20px] bg-white rounded-2xl shadow-elevation-3 px-4 py-3 flex items-center gap-3 min-w-[160px]"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.7 }}
                        >
                            {/* Conic progress ring — 74% */}
                            <div
                                className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
                                style={{
                                    background: 'conic-gradient(#B45309 0% 74%, #F5F0EB 74% 100%)',
                                }}
                            >
                                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-heading">74%</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold text-heading leading-tight">SCA Score</p>
                                <p className="text-[10px] text-muted leading-tight">Data Gathering</p>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

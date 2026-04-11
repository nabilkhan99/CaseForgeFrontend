'use client';

import { specialties } from '@/lib/landing/mock-data';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Marquee } from '@/components/magicui/marquee';
import { motion } from 'framer-motion';

function SpecialtyCard({ specialty }: { specialty: typeof specialties[0] }) {
    return (
        <div className="w-64 bg-white/60 backdrop-blur-sm border border-black/[0.04] rounded-xl p-5 flex flex-col hover:border-primary/[0.12] hover:shadow-elevation-1 transition-all duration-200 group">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center border border-black/[0.06] group-hover:border-primary/[0.12] transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-body group-hover:text-primary transition-colors">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-heading">{specialty.name}</p>
                    <p className="text-[10px] text-muted font-medium">{specialty.cases} Cases</p>
                </div>
            </div>

            {/* Topic pills */}
            <div className="flex flex-wrap gap-1.5 mt-auto">
                {specialty.topics.split(', ').map((topic, i) => (
                    <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-primary/[0.06] text-[10px] text-primary/80 font-medium border border-primary/[0.08]"
                    >
                        {topic}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function StationsCarousel() {
    return (
        <motion.section
            id="stations"
            className="pt-24 pb-16 overflow-hidden relative"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
            {/* Gradient transition from stat bar */}
            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-surface to-transparent" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <BlurFade delay={0} inView>
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                        <div>
                            <p className="text-xs font-semibold text-primary uppercase tracking-[0.2em] mb-2">
                                Full Curriculum Coverage
                            </p>
                            <h2 className="text-3xl md:text-4xl font-bold text-heading">
                                200+ stations. Every clinical area.
                            </h2>
                        </div>
                        <p className="text-sm text-body max-w-sm">
                            From cardiovascular emergencies to mental health consultations — no gaps in your preparation.
                        </p>
                    </div>
                </BlurFade>
            </div>

            {/* Marquee */}
            <div className="relative">
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-surface to-transparent" />
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-surface to-transparent" />
                <Marquee pauseOnHover duration="50s" gap="1rem">
                    {specialties.map((specialty, index) => (
                        <SpecialtyCard key={index} specialty={specialty} />
                    ))}
                </Marquee>
            </div>
        </motion.section>
    );
}

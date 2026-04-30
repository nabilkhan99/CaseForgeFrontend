'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { type CaseBankDomain } from '@/lib/supabase/queries/cases';
import CaseBankCard from '@/components/cases/CaseBankCard';
import LandingNavbar from '@/components/landing/LandingNavbar';
import { BlurFade } from '@/components/magicui/blur-fade';
import { createClient } from '@/lib/supabase/client';
import {
    Flower, HeartPulse, Hand, Ear, Activity, Eye, UtensilsCrossed, Droplets, Droplet,
    Bug, Puzzle, Baby, Smile, Dumbbell, Brain, Sparkles, Armchair, Ribbon,
    GraduationCap, FlaskConical, Wind, Heart, Wine, AlertTriangle,
    Dna, CircleDot, Stethoscope, Globe, MessageSquare, Pill,
    Users, ShieldPlus, Flame, BookOpen,
    type LucideIcon,
} from 'lucide-react';

const DOMAIN_ICON_MAP: [string, LucideIcon][] = [
    ['allergy', Flower],
    ['cardiovascular', HeartPulse],
    ['dermatology', Hand],
    ['ear', Ear],
    ['ophthalmology', Eye],
    ['gastroenterology', UtensilsCrossed],
    ['gender, reproductive', Droplets],
    ['haematology', Droplet],
    ['infectious', Bug],
    ['learning disability', Puzzle],
    ['maternity', Baby],
    ['mental health & addiction', Flame],
    ['mental health', Smile],
    ['musculoskeletal', Dumbbell],
    ['neurodiversity', Sparkles],
    ['neurology', Brain],
    ['older adults & frailty', Armchair],
    ['older adults', Armchair],
    ['end of life', Ribbon],
    ['long-term conditions', Ribbon],
    ['patient < 19', GraduationCap],
    ['renal', FlaskConical],
    ['respiratory', Wind],
    ['sexual health', Heart],
    ['smoking', Wine],
    ['urgent', AlertTriangle],
    ['metabolic', Activity],
    ['endocrinology', Activity],
    ['genetics', Dna],
    ['gynaecology', CircleDot],
    ['population', Globe],
    ['planetary', Globe],
    ['professional', MessageSquare],
    ['conversation', MessageSquare],
    ['prescribing', Pill],
    ['ethnicity', Users],
    ['health disadvantage', ShieldPlus],
    ['investigation', BookOpen],
    ['undifferentiated', Stethoscope],
];

function getDomainIcon(domainName: string) {
    const lower = domainName.toLowerCase();
    const match = DOMAIN_ICON_MAP.find(([key]) => lower.includes(key));
    const Icon = match ? match[1] : Stethoscope;
    return <Icon size={18} className="text-primary" />;
}

export default function CaseBankPage() {
    const [user, setUser] = useState<{ id: string } | null>(null);
    const [domains, setDomains] = useState<CaseBankDomain[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
    }, []);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/cases');
                if (res.ok) {
                    const data = await res.json();
                    setDomains(data.domains || []);
                }
            } catch {
                // Handle silently
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // Filter logic — dropdown selects a domain name (or empty for all)
    const filteredDomains = useMemo(() => {
        if (!searchQuery.trim()) return domains;
        return domains.filter(d => d.name === searchQuery);
    }, [domains, searchQuery]);

    const totalCases = domains.reduce((sum, d) => sum + d.cases.length, 0);
    const totalDomains = domains.length;

    return (
        <div className="min-h-[100dvh] bg-surface">
            <LandingNavbar user={user} />

            <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-12 md:pt-28 md:pb-16">
                {/* Header */}
                <BlurFade delay={0} inView>
                    <div className="mb-10 md:mb-12">
                        <p className="text-xs font-semibold text-primary bg-primary/[0.07] border border-primary/[0.12] uppercase tracking-[0.2em] mb-3 inline-block px-3 py-1 rounded-full">
                            Free Case Library
                        </p>
                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3 text-heading">
                            Case Library
                        </h1>
                        <p className="text-base text-text-secondary">
                            {loading
                                ? 'Loading cases...'
                                : `Browse ${totalCases} cases across ${totalDomains} RCGP curriculum topics — all free.`
                            }
                        </p>
                    </div>
                </BlurFade>

                {/* Search & Filters */}
                <BlurFade delay={0.06} inView>
                    <div className="flex flex-col sm:flex-row gap-3 mb-10 md:mb-12">
                        {/* Clinical topic dropdown */}
                        <div className="relative flex-1 max-w-xl">
                            <select
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-black/[0.06] text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all text-base md:text-sm appearance-none cursor-pointer pr-10"
                            >
                                <option value="">All Topics</option>
                                {domains.map(d => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </span>
                        </div>
                    </div>
                </BlurFade>

                {/* Domain Sections */}
                {loading ? (
                    <div className="flex items-center justify-center py-32">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-black/[0.06] border-t-primary" />
                            <p className="text-muted text-sm">Loading cases...</p>
                        </div>
                    </div>
                ) : filteredDomains.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/60 border border-black/[0.06] flex items-center justify-center">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                <line x1="8" y1="11" x2="14" y2="11" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-body">No cases found</h3>
                        <p className="text-muted text-sm">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {filteredDomains.map((domain, domainIndex) => (
                            <BlurFade key={domain.id} delay={0.04 * Math.min(domainIndex, 5)} inView>
                                <section>
                                    {/* Domain header */}
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-0.5 h-6 rounded-full border-l-2 border-primary" />
                                        {getDomainIcon(domain.name)}
                                        <h2 className="text-lg font-bold text-heading">{domain.name}</h2>
                                        <span className="text-[10px] font-semibold text-primary bg-primary/[0.07] px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                                            {domain.cases.length} {domain.cases.length === 1 ? 'Case' : 'Cases'}
                                        </span>
                                    </div>

                                    {/* Cards grid with staggered whileInView */}
                                    <motion.div
                                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                                        initial="hidden"
                                        whileInView="visible"
                                        viewport={{ once: true, margin: '-50px' }}
                                        variants={{
                                            hidden: {},
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.05,
                                                },
                                            },
                                        }}
                                    >
                                        {domain.cases.map((station) => (
                                            <motion.div
                                                key={station.id}
                                                variants={{
                                                    hidden: { opacity: 0, y: 12 },
                                                    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
                                                }}
                                            >
                                                <CaseBankCard
                                                    station={station}
                                                />
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                </section>
                            </BlurFade>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

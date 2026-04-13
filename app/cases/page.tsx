'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getCasesGroupedByDomain, type CaseBankDomain } from '@/lib/supabase/queries/cases';
import CaseBankCard from '@/components/cases/CaseBankCard';
import LandingNavbar from '@/components/landing/LandingNavbar';
import { BlurFade } from '@/components/magicui/blur-fade';
import { createClient } from '@/lib/supabase/client';

const difficultyFilters = ['all', 'beginner', 'intermediate', 'advanced'] as const;
type DifficultyFilter = (typeof difficultyFilters)[number];

export default function CaseBankPage() {
    const [user, setUser] = useState<{ id: string } | null>(null);
    const [domains, setDomains] = useState<CaseBankDomain[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
    }, []);

    useEffect(() => {
        async function fetchData() {
            const data = await getCasesGroupedByDomain();
            setDomains(data);
            setLoading(false);
        }
        fetchData();
    }, []);

    // Filter logic
    const filteredDomains = useMemo(() => {
        return domains
            .map(domain => {
                let cases = domain.cases;

                // Search filter
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    cases = cases.filter(
                        c =>
                            c.title.toLowerCase().includes(q) ||
                            c.patient_name.toLowerCase().includes(q) ||
                            c.domain_name.toLowerCase().includes(q)
                    );
                }

                // Difficulty filter
                if (difficultyFilter !== 'all') {
                    cases = cases.filter(c => c.difficulty === difficultyFilter);
                }

                return { ...domain, cases };
            })
            .filter(domain => domain.cases.length > 0);
    }, [domains, searchQuery, difficultyFilter]);

    const totalCases = domains.reduce((sum, d) => sum + d.cases.length, 0);
    const totalDomains = domains.length;

    return (
        <div className="min-h-screen bg-surface">
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
                        <p className="text-base text-body">
                            {loading
                                ? 'Loading cases...'
                                : `Browse ${totalCases} cases across ${totalDomains} RCGP specialties — all free.`
                            }
                        </p>
                    </div>
                </BlurFade>

                {/* Search & Filters */}
                <BlurFade delay={0.06} inView>
                    <div className="flex flex-col sm:flex-row gap-3 mb-10 md:mb-12">
                        {/* Search */}
                        <div className="relative flex-1 max-w-xl">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" style={{ display: 'flex', alignItems: 'center' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Search by case name, patient, or specialty..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-black/[0.06] text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all text-sm"
                            />
                        </div>

                        {/* Difficulty pills */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            {difficultyFilters.map(f => (
                                <button
                                    key={f}
                                    onClick={() => setDifficultyFilter(f)}
                                    className={`px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${difficultyFilter === f
                                        ? 'shadow-[0_2px_8px_rgba(180,83,9,0.2)]'
                                        : 'bg-white/60 border border-black/[0.06] text-body hover:border-black/[0.1]'
                                        }`}
                                    style={difficultyFilter === f ? { background: 'linear-gradient(135deg, #B45309, #D97706)', color: '#fff' } : undefined}
                                >
                                    {f === 'all' ? 'All' : f}
                                </button>
                            ))}
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
                                        <h2 className="text-lg font-bold text-heading">{domain.name}</h2>
                                        <span className="text-[10px] font-semibold text-primary bg-primary/[0.07] px-2.5 py-1 rounded-full uppercase tracking-wider">
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
                                        {domain.cases.map((station, i) => (
                                            <motion.div
                                                key={station.id}
                                                variants={{
                                                    hidden: { opacity: 0, y: 12 },
                                                    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
                                                }}
                                            >
                                                <CaseBankCard
                                                    station={station}
                                                    index={i}
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

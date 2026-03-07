'use client';

import { useEffect, useState, useMemo } from 'react';
import { getCasesGroupedByDomain, type CaseBankDomain } from '@/lib/supabase/queries/cases';
import CaseBankCard from '@/components/cases/CaseBankCard';
import Link from 'next/link';
import Image from 'next/image';

const difficultyFilters = ['all', 'beginner', 'intermediate', 'advanced'] as const;
type DifficultyFilter = (typeof difficultyFilters)[number];

// Domain accent colors
const domainAccents = [
    'border-blue-500', 'border-pink-500', 'border-emerald-500', 'border-orange-500',
    'border-violet-500', 'border-red-500', 'border-amber-500', 'border-indigo-500',
    'border-cyan-500', 'border-teal-500', 'border-lime-500', 'border-purple-500',
];

export default function CaseBankPage() {
    const [domains, setDomains] = useState<CaseBankDomain[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');

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
        <div className="min-h-screen bg-[#070A13] text-white">
            {/* Background effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px]" />
            </div>

            {/* Navbar */}
            <nav className="sticky top-0 z-50 bg-[#070A13]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <Image
                            src="/fourteenfishermann.png"
                            alt="Fourteen Fisherman"
                            width={40}
                            height={40}
                            className="h-10 w-auto"
                        />
                    </Link>
                    <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
                        <Link href="/#features" className="text-gray-400 hover:text-white transition-colors">
                            Features
                        </Link>
                        <Link href="/#pricing" className="text-gray-400 hover:text-white transition-colors">
                            Pricing
                        </Link>
                        <Link href="/cases" className="text-white font-semibold">
                            Cases
                        </Link>
                        <Link
                            href="/dashboard"
                            className="px-4 py-2 min-h-[44px] flex items-center bg-purple-600/10 text-purple-400 border border-purple-500/20 rounded-lg hover:bg-purple-600 hover:text-white transition-all"
                        >
                            Dashboard
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
                {/* Header */}
                <div className="mb-8 md:mb-10">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Case Library</h1>
                    <p className="text-gray-400">
                        {loading
                            ? 'Loading cases...'
                            : `Browse ${totalCases} cases across ${totalDomains} specialties`
                        }
                    </p>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8 md:mb-10">
                    {/* Search */}
                    <div className="relative flex-1 max-w-xl">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500" style={{ fontSize: '20px' }}>
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search by case name, patient, or specialty..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/30 transition-all text-sm"
                        />
                    </div>

                    {/* Difficulty pills */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        {difficultyFilters.map(f => (
                            <button
                                key={f}
                                onClick={() => setDifficultyFilter(f)}
                                className={`px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${difficultyFilter === f
                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                                    }`}
                            >
                                {f === 'all' ? 'All' : f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Domain Sections */}
                {loading ? (
                    <div className="flex items-center justify-center py-32">
                        <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
                            <p className="text-gray-500 text-sm">Loading cases...</p>
                        </div>
                    </div>
                ) : filteredDomains.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-4">
                        <span className="material-symbols-outlined text-5xl text-gray-700">search_off</span>
                        <h3 className="text-xl font-bold text-gray-400">No cases found</h3>
                        <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {filteredDomains.map((domain, domainIndex) => (
                            <section key={domain.id}>
                                {/* Domain header */}
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-1 h-8 rounded-full ${domainAccents[domainIndex % domainAccents.length]}`} />
                                        <div>
                                            <h2 className="text-xl font-black text-white">{domain.name}</h2>
                                        </div>
                                        <span className="text-xs font-bold text-gray-500 bg-white/5 px-3 py-1 rounded-full">
                                            {domain.cases.length} {domain.cases.length === 1 ? 'Case' : 'Cases'}
                                        </span>
                                    </div>
                                </div>

                                {/* Horizontal scrolling cards */}
                                <div className="relative">
                                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                                        {domain.cases.map((station, i) => (
                                            <CaseBankCard
                                                key={station.id}
                                                station={station}
                                                index={i}
                                            />
                                        ))}
                                    </div>
                                    {/* Fade edge */}
                                    <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-[#070A13] to-transparent pointer-events-none" />
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

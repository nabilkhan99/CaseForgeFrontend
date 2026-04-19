'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { type CaseBankDomain } from '@/lib/supabase/queries/cases';
import CaseBankCard from '@/components/cases/CaseBankCard';
import LandingNavbar from '@/components/landing/LandingNavbar';
import { BlurFade } from '@/components/magicui/blur-fade';
import { createClient } from '@/lib/supabase/client';

function getDomainIcon(domainName: string) {
    const name = domainName.toLowerCase();

    if (name.includes('cardiovascular'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
        );
    if (name.includes('dermatology'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
        );
    if (name.includes('mental health'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 2a9 9 0 0 1 9 9c0 3.47-1.96 6.48-4.84 8.01L15 21H9l-.16-1.99A9.001 9.001 0 0 1 3 11a9 9 0 0 1 9-9z" />
                <line x1="9" y1="11" x2="9.01" y2="11" />
                <line x1="12" y1="9" x2="12.01" y2="9" />
                <line x1="15" y1="11" x2="15.01" y2="11" />
            </svg>
        );
    if (name.includes('neurology') || name.includes('neurodiversity'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z" />
            </svg>
        );
    if (name.includes('respiratory'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 6v4" />
                <path d="M6 10c-1.5.5-3 2-3 4 0 3 2 5 5 5 1.5 0 2.5-.5 3-1" />
                <path d="M18 10c1.5.5 3 2 3 4 0 3-2 5-5 5-1.5 0-2.5-.5-3-1" />
                <path d="M12 2a4 4 0 0 0-4 4v4h8V6a4 4 0 0 0-4-4z" />
            </svg>
        );
    if (name.includes('musculoskeletal'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M18 6H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" />
                <path d="M4 9H2" />
                <path d="M22 9h-2" />
                <path d="M4 15H2" />
                <path d="M22 15h-2" />
            </svg>
        );
    if (name.includes('ophthalmology'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        );
    if (name.includes('gastroenterology'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 2c-3.87 0-7 2.46-7 5.5 0 1.67.85 3.16 2.19 4.19C6.46 13.03 6 14.46 6 16c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.54-.46-2.97-1.19-4.31C18.15 10.66 19 9.17 19 7.5 19 4.46 15.87 2 12 2z" />
            </svg>
        );
    if (name.includes('ent') || name.includes('ear') || name.includes('nose'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 0 1-7 0" />
                <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 0 1-2 2" />
            </svg>
        );
    if (name.includes('haematology'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 2 C12 2 5 9 5 14 a7 7 0 0 0 14 0 C19 9 12 2 12 2z" />
            </svg>
        );
    if (name.includes('renal') || name.includes('urology'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 2c-3 0-6 2.5-6 7 0 3 1 5 2 7 1 2 2 4 2 6h4c0-2 1-4 2-6 1-2 2-4 2-7 0-4.5-3-7-6-7z" />
            </svg>
        );
    if (name.includes('maternity') || name.includes('reproductive'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2z" />
                <path d="M12 12v10" />
                <path d="M8 17h8" />
            </svg>
        );
    if (name.includes('sexual health'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M8.5 11.5 10.5 13.5 15.5 8.5" />
            </svg>
        );
    if (name.includes('genetics'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M2 15c6.667-6 13.333 0 20-6" />
                <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
                <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
                <path d="m2 9 20 6" />
                <path d="m2 21 20-6" />
            </svg>
        );
    if (name.includes('learning disability'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
        );
    if (name.includes('older adult'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v6" />
                <path d="M9 10l-2 7" />
                <path d="M15 10l2 7" />
                <path d="M7 17l-1 4" />
                <path d="M17 17l1 4" />
            </svg>
        );
    if (name.includes('end of life'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        );
    if (name.includes('infectious'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <circle cx="12" cy="11" r="2" />
                <path d="M12 9v-2" />
                <path d="M12 13v2" />
                <path d="M10 11H8" />
                <path d="M14 11h2" />
            </svg>
        );
    if (name.includes('allergy'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        );
    if (name.includes('metabolic') || name.includes('endocrinology'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
        );
    if (name.includes('gynaecology'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="8" r="5" />
                <path d="M12 13v9" />
                <path d="M9 19h6" />
            </svg>
        );
    if (name.includes('population') || name.includes('planetary'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
        );
    if (name.includes('smoking') || name.includes('alcohol') || name.includes('substance'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        );
    if (name.includes('neurodiver'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 2c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z" />
            </svg>
        );
    if (name.includes('patient under') || name.includes('under 19') || name.includes('child') || name.includes('paediatric'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="6" r="3" />
                <path d="M12 9v6" />
                <path d="M9 13l3 3 3-3" />
            </svg>
        );
    if (name.includes('long-term') || name.includes('cancer'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                <path d="M12 12v.01" />
            </svg>
        );
    if (name.includes('professional') || name.includes('conversation'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        );
    if (name.includes('urgent') || name.includes('unscheduled'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
        );
    // Default: stethoscope
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
            <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
            <circle cx="20" cy="10" r="2" />
        </svg>
    );
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

                return { ...domain, cases };
            })
            .filter(domain => domain.cases.length > 0);
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
                        <p className="text-base text-body">
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
                                placeholder="Search by specialty, case title..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-black/[0.06] text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all text-base md:text-sm"
                            />
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SeoCase } from '@/lib/seo/cases';
import CaseTimer from '@/components/cases/CaseTimer';
import CaseDetailTabs from '@/components/cases/CaseDetailTabs';
import { MarkdownContent, LearningPointsDisplay } from '@/components/cases/LearningPoints';
import { MarkSchemeDomains } from '@/components/cases/MarkScheme';
import LandingNavbar from '@/components/landing/LandingNavbar';
import Container from '@/components/ui/Container';
import { createClient } from '@/lib/supabase/client';

interface CaseDetailPageClientProps {
    caseData: SeoCase;
}

// Parse the candidate_instructions markdown into structured sections
function parseInstructions(raw: string) {
    const sections: { title: string; content: string }[] = [];

    const lines = raw.split('\n');
    let currentTitle = '';
    let currentContent: string[] = [];

    for (const line of lines) {
        const boldMatch = line.match(/^\*\*(.+?):\*\*\s*(.*)/);
        const headerMatch = line.match(/^#{1,3}\s+(.+)/);

        if (boldMatch || headerMatch) {
            if (currentTitle) {
                sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
            }
            currentTitle = boldMatch ? boldMatch[1] : headerMatch![1];
            currentContent = boldMatch && boldMatch[2] ? [boldMatch[2]] : [];
        } else {
            currentContent.push(line);
        }
    }
    if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
    }

    return sections;
}

function SectionIcon({ title }: { title: string }) {
    const lower = title.toLowerCase();

    if (lower.includes('situation') || lower.includes('current'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        );
    if (lower.includes('history') || lower.includes('past'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
        );
    if (lower.includes('medication') || lower.includes('drug'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                <path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-6 18h9" />
            </svg>
        );
    if (lower.includes('recent') || lower.includes('notes'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
            </svg>
        );
    if (lower.includes('allerg'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
        );
    if (lower.includes('social') || lower.includes('family'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        );
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    );
}




export default function CaseDetailPageClient({ caseData }: CaseDetailPageClientProps) {
    const [user, setUser] = useState<{ id: string } | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
    }, []);

    const sections = parseInstructions(caseData.candidate_instructions ?? '');

    const detailSections = sections.filter(
        s =>
            !s.title.toLowerCase().includes('patient name') &&
            !s.title.toLowerCase().includes('dob')
    );

    const consultTypeLabel = caseData.consultation_type === 'telephone'
        ? 'Telephone'
        : caseData.consultation_type === 'video'
            ? 'Video'
            : 'Face-to-Face';

    const candidateContent = (
        <div className="p-5 md:p-6 space-y-6">
            {/* Materials header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/[0.07] border border-primary/[0.12] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                        Materials for Candidate
                    </h3>
                    <p className="text-[11px] text-muted/70">Please review before starting the consultation</p>
                </div>
            </div>

            {/* Patient Profile Card */}
            <div className="rounded-xl border border-black/[0.06] bg-white/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                        Patient Profile
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Full Name</p>
                        <p className="text-lg font-bold text-heading">{caseData.patient_name}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Age</p>
                        <p className="text-lg font-bold text-heading">
                            {caseData.patient_age} <span className="text-sm font-normal text-muted">years</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Consultation Type</p>
                        <span className="inline-block px-3 py-1 rounded-lg bg-primary/[0.07] border border-primary/[0.12] text-primary text-xs font-bold">
                            {consultTypeLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* Instruction Sections */}
            {detailSections.map((section, i) => (
                <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                        <SectionIcon title={section.title} />
                        <h3 className="text-sm font-bold text-heading">{section.title}</h3>
                    </div>
                    <div className="pl-7">
                        <MarkdownContent content={section.content} />
                    </div>
                </div>
            ))}
        </div>
    );

    const markSchemeContent = (
        <div className="p-5 md:p-6 space-y-8">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/[0.07] border border-amber-500/[0.12] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-muted">Mark Scheme</h3>
            </div>

            <MarkSchemeDomains
                dataGathering={caseData.data_gathering ?? null}
                clinicalManagement={caseData.clinical_management ?? null}
                relatingToOthers={caseData.relating_to_others ?? null}
            />
        </div>
    );

    const patientScriptContent = caseData.station_script ? (
        <div className="p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/[0.07] border border-violet-500/[0.12] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted">Patient Script</h3>
                    <p className="text-[11px] text-muted/70">For the friend playing the patient role</p>
                </div>
            </div>
            <div
                className="rounded-xl border border-violet-200/50 p-4 text-[14px] text-body leading-[1.8]"
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.03), rgba(167,139,250,0.03))' }}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        p: ({ children }) => <p className="text-[14px] text-body leading-relaxed mb-3 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-heading">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        ul: ({ children }) => <ul className="space-y-1 my-2 pl-1">{children}</ul>,
                        ol: ({ children }) => <ol className="space-y-1 my-2 pl-1 list-decimal list-inside">{children}</ol>,
                        li: ({ children }) => (
                            <li className="text-[14px] text-body leading-relaxed flex items-start gap-2">
                                <span className="text-violet-400 mt-1.5 text-[6px] shrink-0">●</span>
                                <span>{children}</span>
                            </li>
                        ),
                        h1: ({ children }) => <h3 className="text-[15px] font-bold text-heading mt-4 mb-2 first:mt-0">{children}</h3>,
                        h2: ({ children }) => <h3 className="text-[15px] font-bold text-heading mt-4 mb-2 first:mt-0">{children}</h3>,
                        h3: ({ children }) => <h4 className="text-[14px] font-bold text-heading mt-3 mb-1">{children}</h4>,
                    }}
                >
                    {caseData.station_script}
                </ReactMarkdown>
            </div>
        </div>
    ) : null;

    const learningPointsContent = (
        <div className="p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/[0.12] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                        <path d="M6 12v5c3 3 10 3 12 0v-5" />
                    </svg>
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-muted">Clinical Learning Points</h3>
            </div>
            <LearningPointsDisplay content={caseData.clinical_learning_points ?? null} />
        </div>
    );

    return (
        <div className="min-h-[100dvh] bg-surface">
            <LandingNavbar user={user} />

            <main className="max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-32 md:pt-28 md:pb-16 lg:pb-16">
                {/* Breadcrumb + meta row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3 text-sm">
                        <Link
                            href="/sca-cases"
                            className="flex items-center gap-1.5 text-muted hover:text-heading transition-colors"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            Cases
                        </Link>
                        <span className="text-muted/40">/</span>
                        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                            {caseData.domain_name}
                        </span>
                    </div>
                </div>

                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-heading tracking-tight">
                        {caseData.condition} — Free SCA Practice Case
                    </h1>
                    <p className="mt-2 text-sm md:text-base text-muted">
                        {caseData.title}
                    </p>
                </div>

                {/* Layout: sidebar + content */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Timer sidebar */}
                    <div className="lg:w-[260px] flex-shrink-0 lg:sticky lg:top-28 lg:self-start">
                        <Container padding="none">
                            <CaseTimer totalSeconds={caseData.consultation_duration_seconds} />
                        </Container>

                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                        <Container padding="none">
                            <CaseDetailTabs
                                candidateContent={candidateContent}
                                patientScriptContent={patientScriptContent}
                                markSchemeContent={markSchemeContent}
                                learningPointsContent={learningPointsContent}
                            />
                        </Container>
                    </div>
                </div>

                <div className="mt-8 flex flex-col gap-4">
                    <div className="rounded-2xl border border-black/[0.06] bg-stone-100/70 p-5 text-sm text-text-secondary leading-relaxed">
                        Free MRCGP SCA practice case for GP registrars covering {caseData.condition} — {caseData.domain_name}. Includes candidate brief, patient script, marking scheme mapped to the RCGP SCA marking domains, and learning points. Built directly from the RCGP curriculum topic stations listed under &quot;How this might be tested in the MRCGP SCA,&quot; part of a free library of 79 SCA practice cases for simulated consultation assessment preparation.
                    </div>
                    <Link href="/sca-cases" className="inline-flex w-fit text-primary hover:text-primary/80 text-sm font-medium transition-colors">
                        &larr; Back to Free SCA Practice Cases
                    </Link>
                </div>
            </main>
        </div>
    );
}

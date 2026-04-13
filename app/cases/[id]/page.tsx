'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCaseById, type CaseDetail } from '@/lib/supabase/queries/cases';
import CaseTimer from '@/components/cases/CaseTimer';
import CaseDetailTabs from '@/components/cases/CaseDetailTabs';
import LandingNavbar from '@/components/landing/LandingNavbar';
import Container from '@/components/ui/Container';
import { createClient } from '@/lib/supabase/client';

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

function MarkdownContent({ content }: { content: string | null }) {
    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-muted">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <p className="text-sm font-medium">Content not available for this case</p>
            </div>
        );
    }

    return (
        <div>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-lg font-bold text-heading mt-6 mb-3">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-base font-bold text-heading mt-5 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-sm font-bold text-heading mt-4 mb-2">{children}</h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-sm font-bold text-heading mt-3 mb-1">{children}</h4>
                    ),
                    p: ({ children }) => (
                        <p className="text-sm text-body leading-relaxed mb-3">{children}</p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-bold text-heading">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="text-body italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                        <ul className="space-y-1.5 my-2 pl-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="space-y-1.5 my-2 pl-1 list-decimal list-inside">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-sm text-body leading-relaxed flex items-start gap-2">
                            <span className="text-primary mt-1.5 text-[6px] shrink-0">●</span>
                            <span>{children}</span>
                        </li>
                    ),
                    table: ({ children }) => (
                        <div className="my-4 rounded-xl border border-black/[0.06] overflow-hidden">
                            <table className="w-full text-sm">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-black/[0.02]">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-black/[0.06]">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="hover:bg-black/[0.01] transition-colors">{children}</tr>
                    ),
                    th: ({ children }) => (
                        <th className="px-4 py-3 text-left text-xs font-bold text-primary uppercase tracking-wider">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-3 text-sm text-body leading-relaxed align-top">
                            {children}
                        </td>
                    ),
                    hr: () => (
                        <hr className="border-black/[0.06] my-4" />
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-primary/30 pl-4 my-3 text-muted italic">
                            {children}
                        </blockquote>
                    ),
                    code: ({ children }) => (
                        <code className="bg-primary/[0.06] text-primary px-1.5 py-0.5 rounded text-xs font-mono">
                            {children}
                        </code>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export default function CaseDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const [user, setUser] = useState<{ id: string } | null>(null);
    const [caseData, setCaseData] = useState<CaseDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
    }, []);

    useEffect(() => {
        async function fetchCase() {
            const data = await getCaseById(id);
            setCaseData(data);
            setLoading(false);
        }
        fetchCase();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-surface flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-black/[0.06] border-t-primary" />
            </div>
        );
    }

    if (!caseData) {
        return (
            <div className="min-h-screen bg-surface">
                <LandingNavbar user={user} />
                <div className="flex flex-col items-center justify-center pt-40 gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/60 border border-black/[0.06] flex items-center justify-center">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-heading">Case not found</h2>
                    <Link href="/cases" className="text-primary hover:text-primary/80 text-sm font-medium transition-colors">
                        &larr; Back to Case Library
                    </Link>
                </div>
            </div>
        );
    }

    const sections = parseInstructions(caseData.candidate_instructions);

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

    const difficultyColors: Record<string, string> = {
        advanced: 'bg-red-50 text-red-700 border-red-200',
        beginner: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    const diffBadge = difficultyColors[caseData.difficulty || 'intermediate'] || difficultyColors.intermediate;

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

            {/* Data Gathering */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <h4 className="text-sm font-bold text-heading">Data Gathering</h4>
                </div>
                <div className="pl-4 border-l-2 border-blue-200">
                    <MarkdownContent content={caseData.data_gathering} />
                </div>
            </div>

            {/* Clinical Management */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-bold text-heading">Clinical Management</h4>
                </div>
                <div className="pl-4 border-l-2 border-emerald-200">
                    <MarkdownContent content={caseData.clinical_management} />
                </div>
            </div>

            {/* Interpersonal Skills */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <h4 className="text-sm font-bold text-heading">Interpersonal Skills</h4>
                </div>
                <div className="pl-4 border-l-2 border-primary/20">
                    <MarkdownContent content={caseData.relating_to_others} />
                </div>
            </div>
        </div>
    );

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
            <MarkdownContent content={caseData.clinical_learning_points} />
        </div>
    );

    return (
        <div className="min-h-screen bg-surface">
            <LandingNavbar user={user} />

            <main className="max-w-7xl mx-auto px-4 md:px-6 pt-24 pb-12 md:pt-28 md:pb-16">
                {/* Breadcrumb + meta row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3 text-sm">
                        <Link
                            href="/cases"
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
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${diffBadge} w-fit`}>
                        {caseData.difficulty || 'Intermediate'}
                    </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl md:text-3xl font-bold text-heading tracking-tight mb-8">
                    {caseData.title}
                </h1>

                {/* Layout: sidebar + content */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Timer sidebar */}
                    <div className="lg:w-[260px] flex-shrink-0">
                        <Container padding="none">
                            <CaseTimer totalSeconds={caseData.consultation_duration_seconds} />
                        </Container>

                        {/* Start station link */}
                        <Link
                            href={user
                                ? `/clinical-master/station/${caseData.id}`
                                : `/auth/sign-in?redirect=/clinical-master/station/${caseData.id}`
                            }
                            className="mt-4 w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            style={{ background: 'linear-gradient(135deg, #B45309, #D97706)', color: '#fff', boxShadow: '0 2px 8px rgba(180,83,9,0.2)' }}
                        >
                            {user ? (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                    Start Consultation &rarr;
                                </>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                        <polyline points="10 17 15 12 10 7" />
                                        <line x1="15" y1="12" x2="3" y2="12" />
                                    </svg>
                                    Sign in to start &rarr;
                                </>
                            )}
                        </Link>
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                        <Container padding="none">
                            <CaseDetailTabs
                                candidateContent={candidateContent}
                                markSchemeContent={markSchemeContent}
                                learningPointsContent={learningPointsContent}
                            />
                        </Container>
                    </div>
                </div>
            </main>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCaseById, type CaseDetail } from '@/lib/supabase/queries/cases';
import CaseTimer from '@/components/cases/CaseTimer';
import CaseDetailTabs from '@/components/cases/CaseDetailTabs';

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
        return <span className="material-symbols-outlined text-blue-400" style={{ fontSize: '18px' }}>clinical_notes</span>;
    if (lower.includes('history') || lower.includes('past'))
        return <span className="material-symbols-outlined text-zinc-400" style={{ fontSize: '18px' }}>history</span>;
    if (lower.includes('medication') || lower.includes('drug'))
        return <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '18px' }}>medication</span>;
    if (lower.includes('recent') || lower.includes('notes'))
        return <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: '18px' }}>description</span>;
    if (lower.includes('allerg'))
        return <span className="material-symbols-outlined text-red-400" style={{ fontSize: '18px' }}>warning</span>;
    if (lower.includes('social') || lower.includes('family'))
        return <span className="material-symbols-outlined text-zinc-400" style={{ fontSize: '18px' }}>family_restroom</span>;
    return <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: '18px' }}>info</span>;
}

function MarkdownContent({ content }: { content: string | null }) {
    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
                <span className="material-symbols-outlined text-4xl mb-3">lock</span>
                <p className="text-sm font-medium">Content not available for this case</p>
            </div>
        );
    }

    return (
        <div className="prose-dark">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => (
                        <h1 className="text-lg font-bold text-white mt-6 mb-3">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-base font-bold text-white mt-5 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-sm font-bold text-white mt-4 mb-2">{children}</h3>
                    ),
                    h4: ({ children }) => (
                        <h4 className="text-sm font-bold text-white mt-3 mb-1">{children}</h4>
                    ),
                    p: ({ children }) => (
                        <p className="text-sm text-zinc-400 leading-relaxed mb-3">{children}</p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-bold text-white">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="text-zinc-300 italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                        <ul className="space-y-1.5 my-2 pl-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="space-y-1.5 my-2 pl-1 list-decimal list-inside">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-sm text-zinc-400 leading-relaxed flex items-start gap-2">
                            <span className="text-blue-500 mt-1.5 text-[6px] shrink-0">●</span>
                            <span>{children}</span>
                        </li>
                    ),
                    table: ({ children }) => (
                        <div className="my-4 rounded-xl border border-zinc-800 overflow-hidden">
                            <table className="w-full text-sm">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-zinc-900/50">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-zinc-800">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="hover:bg-zinc-800/20 transition-colors">{children}</tr>
                    ),
                    th: ({ children }) => (
                        <th className="px-4 py-3 text-left text-xs font-bold text-blue-400 uppercase tracking-wider">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-3 text-sm text-zinc-400 leading-relaxed align-top">
                            {children}
                        </td>
                    ),
                    hr: () => (
                        <hr className="border-zinc-800 my-4" />
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-blue-500/30 pl-4 my-3 text-zinc-500 italic">
                            {children}
                        </blockquote>
                    ),
                    code: ({ children }) => (
                        <code className="bg-zinc-800/50 text-blue-400 px-1.5 py-0.5 rounded text-xs font-mono">
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
    const [caseData, setCaseData] = useState<CaseDetail | null>(null);
    const [loading, setLoading] = useState(true);

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
            <div className="h-screen bg-[#09090b] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-zinc-800 border-t-blue-500" />
            </div>
        );
    }

    if (!caseData) {
        return (
            <div className="h-screen bg-[#09090b] flex flex-col items-center justify-center text-white gap-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-zinc-700">error_outline</span>
                </div>
                <h2 className="text-xl font-bold">Case not found</h2>
                <Link href="/cases" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                    ← Back to Case Library
                </Link>
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

    const candidateContent = (
        <div className="p-4 md:p-6 space-y-6">
            {/* Materials header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-400" style={{ fontSize: '16px' }}>description</span>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        Materials for Candidate
                    </h3>
                    <p className="text-[11px] text-zinc-600">Please review before starting the consultation</p>
                </div>
            </div>

            {/* Patient Profile Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        Patient Profile
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Full Name</p>
                        <p className="text-lg font-bold text-white">{caseData.patient_name}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Age</p>
                        <p className="text-lg font-bold text-white">
                            {caseData.patient_age} <span className="text-sm font-normal text-zinc-600">years</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Consultation Type</p>
                        <span className="inline-block px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
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
                        <h3 className="text-sm font-bold text-white">{section.title}</h3>
                    </div>
                    <div className="pl-7">
                        <MarkdownContent content={section.content} />
                    </div>
                </div>
            ))}
        </div>
    );

    const markSchemeContent = (
        <div className="p-4 md:p-6 space-y-8">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '16px' }}>grading</span>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Mark Scheme</h3>
            </div>

            {/* Data Gathering */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <h4 className="text-sm font-bold text-white">Data Gathering</h4>
                </div>
                <div className="pl-4 border-l-2 border-blue-500/20">
                    <MarkdownContent content={caseData.data_gathering} />
                </div>
            </div>

            {/* Clinical Management */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <h4 className="text-sm font-bold text-white">Clinical Management</h4>
                </div>
                <div className="pl-4 border-l-2 border-emerald-500/20">
                    <MarkdownContent content={caseData.clinical_management} />
                </div>
            </div>

            {/* Interpersonal Skills */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    <h4 className="text-sm font-bold text-white">Interpersonal Skills</h4>
                </div>
                <div className="pl-4 border-l-2 border-zinc-700/50">
                    <MarkdownContent content={caseData.relating_to_others} />
                </div>
            </div>
        </div>
    );

    const learningPointsContent = (
        <div className="p-4 md:p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: '16px' }}>school</span>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Clinical Learning Points</h3>
            </div>
            <MarkdownContent content={caseData.clinical_learning_points} />
        </div>
    );

    return (
        <div className="h-screen bg-[#09090b] text-white flex flex-col overflow-hidden">
            {/* Top bar */}
            <header className="h-14 bg-[#0c0c0f] border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/cases"
                        className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-sm flex-shrink-0"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                        <span className="hidden sm:inline">Cases</span>
                    </Link>
                    <span className="text-zinc-800">|</span>
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider flex-shrink-0">
                            {caseData.domain_name}
                        </span>
                        <span className="text-zinc-800">•</span>
                        <span className="text-sm font-semibold text-white truncate">
                            {caseData.title}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${caseData.difficulty === 'advanced'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : caseData.difficulty === 'beginner'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                        {caseData.difficulty || 'Intermediate'}
                    </span>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex min-h-0">
                {/* Timer Sidebar — responsive: hidden on mobile, visible on desktop */}
                <CaseTimer totalSeconds={caseData.consultation_duration_seconds} />

                {/* Right Content */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 md:pb-0">
                    <CaseDetailTabs
                        candidateContent={candidateContent}
                        markSchemeContent={markSchemeContent}
                        learningPointsContent={learningPointsContent}
                    />
                </div>
            </div>
        </div>
    );
}

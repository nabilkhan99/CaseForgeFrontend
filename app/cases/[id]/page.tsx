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

    // Split by markdown headers (** or ##)
    const lines = raw.split('\n');
    let currentTitle = '';
    let currentContent: string[] = [];

    for (const line of lines) {
        // Check for bold headers like **Past Medical History:** or ## headers
        const boldMatch = line.match(/^\*\*(.+?):\*\*\s*(.*)/);
        const headerMatch = line.match(/^#{1,3}\s+(.+)/);

        if (boldMatch || headerMatch) {
            // Save previous section
            if (currentTitle) {
                sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
            }
            currentTitle = boldMatch ? boldMatch[1] : headerMatch![1];
            currentContent = boldMatch && boldMatch[2] ? [boldMatch[2]] : [];
        } else {
            currentContent.push(line);
        }
    }
    // Push last section
    if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
    }

    return sections;
}

function SectionIcon({ title }: { title: string }) {
    const lower = title.toLowerCase();
    if (lower.includes('situation') || lower.includes('current'))
        return <span className="material-symbols-outlined text-blue-400" style={{ fontSize: '20px' }}>clinical_notes</span>;
    if (lower.includes('history') || lower.includes('past'))
        return <span className="material-symbols-outlined text-purple-400" style={{ fontSize: '20px' }}>history</span>;
    if (lower.includes('medication') || lower.includes('drug'))
        return <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '20px' }}>medication</span>;
    if (lower.includes('recent') || lower.includes('notes'))
        return <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: '20px' }}>description</span>;
    if (lower.includes('allerg'))
        return <span className="material-symbols-outlined text-red-400" style={{ fontSize: '20px' }}>warning</span>;
    if (lower.includes('social') || lower.includes('family'))
        return <span className="material-symbols-outlined text-cyan-400" style={{ fontSize: '20px' }}>family_restroom</span>;
    return <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '20px' }}>info</span>;
}

function MarkdownContent({ content }: { content: string | null }) {
    if (!content) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
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
                        <p className="text-sm text-gray-300 leading-relaxed mb-3">{children}</p>
                    ),
                    strong: ({ children }) => (
                        <strong className="font-bold text-white">{children}</strong>
                    ),
                    em: ({ children }) => (
                        <em className="text-gray-200 italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                        <ul className="space-y-1.5 my-2 pl-1">{children}</ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="space-y-1.5 my-2 pl-1 list-decimal list-inside">{children}</ol>
                    ),
                    li: ({ children }) => (
                        <li className="text-sm text-gray-300 leading-relaxed flex items-start gap-2">
                            <span className="text-purple-400 mt-1.5 text-[6px] shrink-0">●</span>
                            <span>{children}</span>
                        </li>
                    ),
                    table: ({ children }) => (
                        <div className="my-4 rounded-xl border border-white/10 overflow-hidden">
                            <table className="w-full text-sm">{children}</table>
                        </div>
                    ),
                    thead: ({ children }) => (
                        <thead className="bg-white/5">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                        <tbody className="divide-y divide-white/5">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                        <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>
                    ),
                    th: ({ children }) => (
                        <th className="px-4 py-3 text-left text-xs font-bold text-purple-300 uppercase tracking-wider">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-4 py-3 text-sm text-gray-300 leading-relaxed align-top">
                            {children}
                        </td>
                    ),
                    hr: () => (
                        <hr className="border-white/10 my-4" />
                    ),
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-purple-500/30 pl-4 my-3 text-gray-400 italic">
                            {children}
                        </blockquote>
                    ),
                    code: ({ children }) => (
                        <code className="bg-white/10 text-purple-300 px-1.5 py-0.5 rounded text-xs font-mono">
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
            <div className="h-screen bg-[#070A13] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
            </div>
        );
    }

    if (!caseData) {
        return (
            <div className="h-screen bg-[#070A13] flex flex-col items-center justify-center text-white gap-4">
                <span className="material-symbols-outlined text-5xl text-gray-600">error_outline</span>
                <h2 className="text-xl font-bold">Case not found</h2>
                <Link href="/cases" className="text-purple-400 hover:text-purple-300 text-sm">
                    ← Back to Case Library
                </Link>
            </div>
        );
    }

    const sections = parseInstructions(caseData.candidate_instructions);

    // Extract patient info from sections
    const _patientNameSection = sections.find(s => s.title.toLowerCase().includes('patient name'));
    const _ageSection = sections.find(s => s.title.toLowerCase().includes('age'));
    const _situationSection = sections.find(s =>
        s.title.toLowerCase().includes('situation') ||
        s.title.toLowerCase().includes('reason') ||
        s.title.toLowerCase().includes('presenting')
    );

    // Filter out top-level info fields from detailed sections
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
        <div className="p-6 space-y-6">
            {/* Materials header */}
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-purple-400" style={{ fontSize: '18px' }}>description</span>
                </div>
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                        Materials for Candidate
                    </h3>
                    <p className="text-[11px] text-gray-500">Please review before starting the consultation</p>
                </div>
            </div>

            {/* Patient Profile Card */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Patient Profile
                    </span>
                </div>

                <div className="grid grid-cols-3 gap-6">
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Full Name</p>
                        <p className="text-lg font-bold text-white">{caseData.patient_name}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Age</p>
                        <p className="text-lg font-bold text-white">
                            {caseData.patient_age} <span className="text-sm font-normal text-gray-500">years</span>
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Consultation Type</p>
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
        <div className="p-6 space-y-8">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-400" style={{ fontSize: '18px' }}>grading</span>
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Mark Scheme</h3>
            </div>

            {/* Data Gathering */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <h4 className="text-sm font-bold text-white">Data Gathering</h4>
                </div>
                <div className="pl-4 border-l-2 border-blue-500/20">
                    <MarkdownContent content={caseData.data_gathering} />
                </div>
            </div>

            {/* Clinical Management */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <h4 className="text-sm font-bold text-white">Clinical Management</h4>
                </div>
                <div className="pl-4 border-l-2 border-emerald-500/20">
                    <MarkdownContent content={caseData.clinical_management} />
                </div>
            </div>

            {/* Interpersonal Skills */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <h4 className="text-sm font-bold text-white">Interpersonal Skills</h4>
                </div>
                <div className="pl-4 border-l-2 border-purple-500/20">
                    <MarkdownContent content={caseData.relating_to_others} />
                </div>
            </div>
        </div>
    );

    const learningPointsContent = (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: '18px' }}>school</span>
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Clinical Learning Points</h3>
            </div>
            <MarkdownContent content={caseData.clinical_learning_points} />
        </div>
    );

    return (
        <div className="h-screen bg-[#070A13] text-white flex flex-col overflow-hidden">
            {/* Top bar */}
            <header className="h-14 bg-[#0B0F1A] border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Link
                        href="/cases"
                        className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                        Cases
                    </Link>
                    <span className="text-gray-700">|</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {caseData.domain_name}
                        </span>
                        <span className="text-gray-700">•</span>
                        <span className="text-sm font-bold text-white truncate max-w-sm">
                            {caseData.title}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
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
                {/* Timer Sidebar */}
                <CaseTimer totalSeconds={caseData.consultation_duration_seconds} />

                {/* Right Content */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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

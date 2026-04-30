'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { type CaseDetail } from '@/lib/supabase/queries/cases';
import CaseTimer from '@/components/cases/CaseTimer';
import CaseDetailTabs from '@/components/cases/CaseDetailTabs';
import LandingNavbar from '@/components/landing/LandingNavbar';
import Container from '@/components/ui/Container';
import FeedbackModal from '@/components/ui/FeedbackModal';
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

    if (lower.includes('age') || lower.includes('dob') || lower.includes('patient name'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        );
    if (lower.includes('history') || lower.includes('past'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="13" x2="12" y2="17" />
                <line x1="10" y1="11" x2="14" y2="11" />
            </svg>
        );
    if (lower.includes('medication') || lower.includes('drug'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                <path d="m8.5 8.5 7 7" />
            </svg>
        );
    if (lower.includes('recent') || lower.includes('notes'))
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="8" x2="16" y2="8" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="8" y1="16" x2="12" y2="16" />
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
    // Default: stethoscope
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
            <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
            <circle cx="20" cy="10" r="2" />
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

interface MarkSchemeRow {
    positive: string;
    negative: string;
}

function parseMarkdownTable(content: string): MarkSchemeRow[] {
    const rows: MarkSchemeRow[] = [];
    const lines = content.split('\n');
    let inBody = false;
    let headerSeen = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('|')) continue;

        const cells = trimmed
            .split('|')
            .slice(1, -1)
            .map(c => c.trim());

        if (!headerSeen) {
            headerSeen = true;
            continue;
        }

        if (trimmed.match(/^\|[\s-:|]+\|$/)) {
            inBody = true;
            continue;
        }

        if (inBody && cells.length >= 2) {
            const positive = cells[0].replace(/\*\*/g, '').trim();
            const negative = cells[1].replace(/\*\*/g, '').trim();
            if (positive || negative) {
                rows.push({ positive, negative });
            }
        }
    }

    return rows;
}

function InteractiveMarkScheme({ content, onScoreChange, checked, onToggle }: {
    content: string | null;
    onScoreChange?: (positiveChecked: number, negativeChecked: number) => void;
    checked: Record<string, boolean>;
    onToggle: (key: string) => void;
}) {
    const rows = content ? parseMarkdownTable(content) : [];

    const positiveChecked = rows.filter((_, i) => checked[`pos-${i}`]).length;
    const negativeChecked = rows.filter((_, i) => checked[`neg-${i}`]).length;
    const totalPositive = rows.filter(r => r.positive).length;
    const totalNegative = rows.filter(r => r.negative).length;
    const cumulativeScore = Math.max(0, positiveChecked - negativeChecked);

    useEffect(() => {
        onScoreChange?.(positiveChecked, negativeChecked);
    }, [positiveChecked, negativeChecked, onScoreChange]);

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

    if (rows.length === 0) {
        return <MarkdownContent content={content} />;
    }


    return (
        <div className="space-y-3">
            {/* Tally badges */}
            <div className="flex items-center gap-2 px-1 py-2 flex-wrap">
                <span className="text-xs font-bold text-heading bg-primary/[0.07] px-3 py-1.5 rounded-lg">
                    {cumulativeScore} / {totalPositive} score
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    +{positiveChecked}
                </span>
                <span className="text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg">
                    &minus;{negativeChecked}
                </span>
            </div>

            {/* Two-column grid: positive left, negative right */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0">
                {/* Column headers */}
                <div className="hidden sm:block text-[11px] font-bold text-emerald-700 uppercase tracking-wider px-1 pb-2">
                    Positive ({positiveChecked}/{totalPositive})
                </div>
                <div className="hidden sm:block text-[11px] font-bold text-red-700 uppercase tracking-wider px-1 pb-2">
                    Negative ({negativeChecked}/{totalNegative})
                </div>

                {/* Rows — each pair shares the same grid row for equal height */}
                {rows.map((row, i) => (
                    <div key={i} className="contents">
                        {/* Positive cell */}
                        <div className="pb-2">
                            {row.positive ? (
                                <button
                                    type="button"
                                    onClick={() => onToggle(`pos-${i}`)}
                                    className={`w-full h-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                                        checked[`pos-${i}`]
                                            ? 'bg-emerald-50/80 border border-emerald-200'
                                            : 'bg-emerald-50/40 border border-emerald-100 hover:bg-emerald-50/60'
                                    }`}
                                >
                                    <span className={`mt-0.5 flex-shrink-0 w-4.5 h-4.5 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all ${
                                        checked[`pos-${i}`]
                                            ? 'bg-emerald-500 border-emerald-500'
                                            : 'border-emerald-300 bg-white'
                                    }`}>
                                        {checked[`pos-${i}`] && (
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </span>
                                    <span className={`text-[13px] leading-relaxed ${
                                        checked[`pos-${i}`] ? 'text-emerald-800' : 'text-body'
                                    }`}>
                                        {row.positive}
                                    </span>
                                </button>
                            ) : (
                                <div className="h-full" />
                            )}
                        </div>

                        {/* Negative cell */}
                        <div className="pb-2">
                            {row.negative ? (
                                <button
                                    type="button"
                                    onClick={() => onToggle(`neg-${i}`)}
                                    className={`w-full h-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                                        checked[`neg-${i}`]
                                            ? 'bg-red-50/80 border border-red-200'
                                            : 'bg-red-50/40 border border-red-100 hover:bg-red-50/60'
                                    }`}
                                >
                                    <span className={`mt-0.5 flex-shrink-0 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all ${
                                        checked[`neg-${i}`]
                                            ? 'bg-red-500 border-red-500'
                                            : 'border-red-300 bg-white'
                                    }`}>
                                        {checked[`neg-${i}`] && (
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                    </span>
                                    <span className={`text-[13px] leading-relaxed ${
                                        checked[`neg-${i}`] ? 'text-red-800' : 'text-body'
                                    }`}>
                                        {row.negative}
                                    </span>
                                </button>
                            ) : (
                                <div className="h-full" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const LEARNING_POINT_COLORS = [
    { bg: 'bg-blue-50', border: 'border-blue-300', number: 'text-blue-200' },
    { bg: 'bg-emerald-50', border: 'border-emerald-300', number: 'text-emerald-200' },
    { bg: 'bg-amber-50', border: 'border-amber-300', number: 'text-amber-200' },
    { bg: 'bg-purple-50', border: 'border-purple-300', number: 'text-purple-200' },
    { bg: 'bg-rose-50', border: 'border-rose-300', number: 'text-rose-200' },
];

function LearningPointsDisplay({ content }: { content: string | null }) {
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

    const sectionRegex = /\*\*(\d+)\.\s+(.+?)\*\*/;
    const lines = content.split('\n');
    const sections: { number: string; title: string; content: string }[] = [];
    let currentNumber = '';
    let currentTitle = '';
    let currentLines: string[] = [];

    for (const line of lines) {
        const match = line.match(sectionRegex);
        if (match) {
            if (currentTitle) {
                sections.push({
                    number: currentNumber,
                    title: currentTitle,
                    content: currentLines.join('\n').trim(),
                });
            }
            currentNumber = match[1];
            currentTitle = match[2];
            const remainder = line.replace(sectionRegex, '').trim();
            currentLines = remainder ? [remainder] : [];
        } else {
            currentLines.push(line);
        }
    }
    if (currentTitle) {
        sections.push({
            number: currentNumber,
            title: currentTitle,
            content: currentLines.join('\n').trim(),
        });
    }

    if (sections.length === 0) {
        return <MarkdownContent content={content} />;
    }

    return (
        <div className="space-y-4">
            {sections.map((section, i) => {
                const color = LEARNING_POINT_COLORS[i % LEARNING_POINT_COLORS.length];
                return (
                    <div
                        key={i}
                        className={`relative rounded-xl ${color.bg} border-l-[3px] ${color.border} p-5 overflow-hidden`}
                    >
                        <span className={`absolute top-2 left-3 text-5xl font-black ${color.number} select-none pointer-events-none`}>
                            {section.number}
                        </span>
                        <div className="relative pl-8">
                            <h4 className="text-sm font-bold text-heading mb-2">{section.title}</h4>
                            <MarkdownContent content={section.content} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function CaseDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const [user, setUser] = useState<{ id: string } | null>(null);
    const [caseData, setCaseData] = useState<CaseDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // Domain scores for live total score calculation
    const [domainScores, setDomainScores] = useState({ d1: { pos: 0, neg: 0 }, d2: { pos: 0, neg: 0 }, d3: { pos: 0, neg: 0 } });
    const totalScore = (domainScores.d1.pos - domainScores.d1.neg) + (domainScores.d2.pos - domainScores.d2.neg) + (domainScores.d3.pos - domainScores.d3.neg);
    const onD1ScoreChange = useCallback((pos: number, neg: number) => setDomainScores(prev => ({ ...prev, d1: { pos, neg } })), []);
    const onD2ScoreChange = useCallback((pos: number, neg: number) => setDomainScores(prev => ({ ...prev, d2: { pos, neg } })), []);
    const onD3ScoreChange = useCallback((pos: number, neg: number) => setDomainScores(prev => ({ ...prev, d3: { pos, neg } })), []);

    // Lifted mark scheme checked state — persists across tab switches
    const [d1Checked, setD1Checked] = useState<Record<string, boolean>>({});
    const [d2Checked, setD2Checked] = useState<Record<string, boolean>>({});
    const [d3Checked, setD3Checked] = useState<Record<string, boolean>>({});
    const toggleD1 = useCallback((key: string) => setD1Checked(prev => ({ ...prev, [key]: !prev[key] })), []);
    const toggleD2 = useCallback((key: string) => setD2Checked(prev => ({ ...prev, [key]: !prev[key] })), []);
    const toggleD3 = useCallback((key: string) => setD3Checked(prev => ({ ...prev, [key]: !prev[key] })), []);

    // Feedback modal state
    const [feedbackOpen, setFeedbackOpen] = useState(false);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
    }, []);

    useEffect(() => {
        async function fetchCase() {
            try {
                const res = await fetch(`/api/cases/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    setCaseData(data.case || null);
                }
            } catch {
                // Handle silently
            } finally {
                setLoading(false);
            }
        }
        fetchCase();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-black/[0.06] border-t-primary" />
            </div>
        );
    }

    if (!caseData) {
        return (
            <div className="min-h-[100dvh] bg-surface">
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

    // Compute total positive indicators across all 3 domains for X/Y display
    const countPositives = (content: string | null) => content ? parseMarkdownTable(content).filter(r => r.positive).length : 0;
    const totalPositiveIndicators = countPositives(caseData.data_gathering) + countPositives(caseData.clinical_management) + countPositives(caseData.relating_to_others);

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
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/[0.07] border border-amber-500/[0.12] flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted">Mark Scheme</h3>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/[0.07] border border-primary/[0.12]">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Total Score</span>
                    <span className="text-sm font-black text-heading tabular-nums">{Math.max(0, totalScore)} / {totalPositiveIndicators}</span>
                </div>
            </div>

            {/* Data Gathering */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <h4 className="text-sm font-bold text-heading">Domain 1: Data Gathering and Diagnosis</h4>
                </div>
                <div className="pl-4 border-l-2 border-blue-200">
                    <InteractiveMarkScheme content={caseData.data_gathering} onScoreChange={onD1ScoreChange} checked={d1Checked} onToggle={toggleD1} />
                </div>
            </div>

            {/* Clinical Management */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-bold text-heading">Domain 2: Clinical Management and Medical Complexity</h4>
                </div>
                <div className="pl-4 border-l-2 border-emerald-200">
                    <InteractiveMarkScheme content={caseData.clinical_management} onScoreChange={onD2ScoreChange} checked={d2Checked} onToggle={toggleD2} />
                </div>
            </div>

            {/* Interpersonal Skills */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <h4 className="text-sm font-bold text-heading">Domain 3: Relating to Others</h4>
                </div>
                <div className="pl-4 border-l-2 border-primary/20">
                    <InteractiveMarkScheme content={caseData.relating_to_others} onScoreChange={onD3ScoreChange} checked={d3Checked} onToggle={toggleD3} />
                </div>
            </div>
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
            <LearningPointsDisplay content={caseData.clinical_learning_points} />
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
                </div>

                {/* Title + mobile feedback */}
                <div className="flex items-start justify-between gap-3 mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-heading tracking-tight">
                        {caseData.title}
                    </h1>
                    <button
                        onClick={() => setFeedbackOpen(true)}
                        className="lg:hidden flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white mt-1"
                        style={{ background: '#C2410C' }}
                    >
                        Feedback
                    </button>
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
                                feedbackButton={
                                    <button
                                        onClick={() => setFeedbackOpen(true)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 text-white"
                                        style={{ background: '#C2410C' }}
                                    >
                                        Feedback
                                    </button>
                                }
                            />
                        </Container>
                    </div>
                </div>
            </main>

            <FeedbackModal
                isOpen={feedbackOpen}
                onClose={() => setFeedbackOpen(false)}
                sourceType="case"
                sourceId={id}
            />
        </div>
    );
}

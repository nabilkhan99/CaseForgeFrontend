'use client';

import { useState } from 'react';
import { MarkdownContent } from '@/components/cases/LearningPoints';

/**
 * The RCGP mark-scheme renderer, shared by the public case page and the
 * post-consultation feedback report.
 *
 * Extracted from CaseDetailPageClient when the feedback report grew a
 * "Mark scheme" tab: the indicators a candidate was actually judged against
 * belong next to their result, not only on a public page they have to go and
 * find. One component so the two cannot drift.
 */

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

export function InteractiveMarkScheme({ content }: { content: string | null }) {
    const [checked, setChecked] = useState<Record<string, boolean>>({});

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

    const rows = parseMarkdownTable(content);

    if (rows.length === 0) {
        return <MarkdownContent content={content} />;
    }

    const totalIndicators = rows.reduce((count, row) => {
        if (row.positive) count++;
        if (row.negative) count++;
        return count;
    }, 0);

    const checkedCount = Object.values(checked).filter(Boolean).length;

    function toggleCheck(key: string) {
        setChecked(prev => ({ ...prev, [key]: !prev[key] }));
    }

    const positiveChecked = rows.filter((_, i) => checked[`pos-${i}`]).length;
    const negativeChecked = rows.filter((_, i) => checked[`neg-${i}`]).length;
    const totalPositive = rows.filter(r => r.positive).length;
    const totalNegative = rows.filter(r => r.negative).length;

    return (
        <div className="space-y-3">
            {/* Tally badges */}
            <div className="flex items-center gap-2 px-1 py-2 flex-wrap">
                <span className="text-xs font-bold text-heading bg-primary/[0.07] px-3 py-1.5 rounded-lg">
                    {checkedCount} / {totalIndicators} indicators checked
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
                                    onClick={() => toggleCheck(`pos-${i}`)}
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
                                    onClick={() => toggleCheck(`neg-${i}`)}
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


/**
 * All three RCGP domains, in marking order, each with its own accent. Kept here
 * rather than at either call site so the public case page and the feedback
 * report show the same domains under the same names.
 */
export function MarkSchemeDomains({
    dataGathering,
    clinicalManagement,
    relatingToOthers,
}: {
    dataGathering: string | null;
    clinicalManagement: string | null;
    relatingToOthers: string | null;
}) {
    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <h4 className="text-sm font-bold text-heading">Domain 1: Data Gathering and Diagnosis</h4>
                </div>
                <div className="pl-4 border-l-2 border-blue-200">
                    <InteractiveMarkScheme content={dataGathering} />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-bold text-heading">Domain 2: Clinical Management and Medical Complexity</h4>
                </div>
                <div className="pl-4 border-l-2 border-emerald-200">
                    <InteractiveMarkScheme content={clinicalManagement} />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <h4 className="text-sm font-bold text-heading">Domain 3: Relating to Others</h4>
                </div>
                <div className="pl-4 border-l-2 border-primary/20">
                    <InteractiveMarkScheme content={relatingToOthers} />
                </div>
            </div>
        </div>
    );
}

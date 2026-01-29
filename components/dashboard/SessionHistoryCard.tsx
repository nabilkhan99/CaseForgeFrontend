'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { SessionHistoryItem } from '@/lib/supabase/queries/dashboard';

interface SessionHistoryCardProps {
    session: SessionHistoryItem;
}

export default function SessionHistoryCard({ session }: SessionHistoryCardProps) {
    // Format the completion date
    const formattedDate = session.completedAt
        ? formatDistanceToNow(new Date(session.completedAt), { addSuffix: true })
        : 'Unknown';

    // Determine score color class based on overall score
    const getScoreColorClass = (score: number) => {
        if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
        if (score >= 60) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
        return 'bg-red-500/10 border-red-500/20 text-red-400';
    };

    const scoreColorClass = getScoreColorClass(session.overallScore);

    return (
        <div className="glass-card rounded-2xl p-5 hover:border-white/20 hover:-translate-y-1 hover:shadow-lift hover:bg-[#1c233d]/70 transition-all group cursor-pointer">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                        {session.stationTitle}
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
                            {session.domainName}
                        </span>
                        <span className="text-gray-600 text-xs">•</span>
                        <span className="text-xs text-gray-500 font-medium">
                            Completed {formattedDate}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Domain Scores Mini Display */}
                    <div className="hidden sm:flex items-center gap-2">
                        <ScoreBadge label="DG" score={session.dataGatheringScore} />
                        <ScoreBadge label="CM" score={session.clinicalManagementScore} />
                        <ScoreBadge label="IS" score={session.interpersonalSkillsScore} />
                    </div>

                    {/* Overall Score */}
                    <div className={`px-4 py-2 rounded-xl border ${scoreColorClass}`}>
                        <span className="text-xs font-black uppercase tracking-widest">
                            Score: {session.overallScore}%
                        </span>
                    </div>

                    {/* Pass/Fail Badge */}
                    <div className={`px-3 py-1 rounded-lg text-xs font-bold ${session.passed
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                        {session.passed ? 'PASS' : 'REFER'}
                    </div>

                    <Link
                        href={`/dashboard/session/${session.id}`}
                        className="flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-gray-600 group-hover:text-white transition-colors">
                            chevron_right
                        </span>
                    </Link>
                </div>
            </div>

            {/* Mobile Score Display */}
            <div className="sm:hidden mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-2">
                    <ScoreBadge label="Data Gathering" score={session.dataGatheringScore} expanded />
                    <ScoreBadge label="Clinical Mgmt" score={session.clinicalManagementScore} expanded />
                    <ScoreBadge label="Interpersonal" score={session.interpersonalSkillsScore} expanded />
                </div>
            </div>
        </div>
    );
}

function ScoreBadge({
    label,
    score,
    expanded = false
}: {
    label: string;
    score: number;
    expanded?: boolean;
}) {
    const getColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 60) return 'text-amber-400';
        return 'text-red-400';
    };

    return (
        <div className={`flex items-center gap-1 ${expanded ? 'flex-col' : ''}`}>
            <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                {label}
            </span>
            <span className={`text-xs font-bold ${getColor(score)}`}>
                {score}%
            </span>
        </div>
    );
}

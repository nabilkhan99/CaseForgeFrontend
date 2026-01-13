'use client';

import { StationCase } from '@/lib/station-library/mock-data';

interface CaseCardProps {
    stationCase: StationCase;
    onClick?: () => void;
}

function getScoreColor(score: number): { bg: string; border: string; text: string } {
    if (score >= 80) {
        return {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            text: 'text-emerald-400',
        };
    } else if (score >= 60) {
        return {
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            text: 'text-emerald-400',
        };
    } else {
        return {
            bg: 'bg-red-500/10',
            border: 'border-red-500/20',
            text: 'text-red-400',
        };
    }
}

export default function CaseCard({ stationCase, onClick }: CaseCardProps) {
    const isCompleted = stationCase.status === 'completed';
    const isInProgress = stationCase.status === 'in-progress';
    const isNotStarted = stationCase.status === 'not-started';

    // Special styling for in-progress cases
    const cardClasses = isInProgress
        ? 'glass-card rounded-2xl p-5 flex items-center justify-between group cursor-pointer border-amber-500/30 bg-amber-500/5 hover:-translate-y-1'
        : 'glass-card rounded-2xl p-5 flex items-center justify-between group cursor-pointer hover:-translate-y-1';

    const statusDot = isCompleted
        ? 'bg-emerald-400'
        : isInProgress
            ? 'bg-amber-400'
            : 'bg-gray-600';

    const statusText = isCompleted
        ? 'text-emerald-400'
        : isInProgress
            ? 'text-amber-400'
            : 'text-gray-500';

    const statusLabel = isCompleted
        ? 'Completed'
        : isInProgress
            ? 'In Progress'
            : 'Not Started';

    const scoreColors = stationCase.score ? getScoreColor(stationCase.score) : null;

    return (
        <div className={cardClasses} onClick={onClick}>
            <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                    {stationCase.title}
                </h3>
                <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${statusText}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                        {statusLabel}
                    </span>
                    <span className="text-gray-600 text-xs">•</span>
                    <span className="text-xs text-gray-500 font-medium">
                        {stationCase.lastAttempted || stationCase.focus || ''}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-8">
                {isCompleted && scoreColors ? (
                    <div className={`${scoreColors.bg} border ${scoreColors.border} px-4 py-2 rounded-xl`}>
                        <span className={`text-xs font-black ${scoreColors.text} uppercase tracking-widest`}>
                            Score: {stationCase.score}%
                        </span>
                    </div>
                ) : (
                    <div className="px-4 py-2">
                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">-- %</span>
                    </div>
                )}
                <span
                    className={`material-symbols-outlined ${isInProgress
                            ? 'text-amber-400 group-hover:text-white'
                            : isCompleted
                                ? 'text-gray-600 group-hover:text-white'
                                : 'text-gray-600 group-hover:text-white'
                        } transition-colors`}
                >
                    {isCompleted ? 'chevron_right' : 'play_circle'}
                </span>
            </div>
        </div>
    );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { getStationsForDomain, type Station } from '@/lib/supabase/queries/station-library';
import { use } from 'react';

// Domain colors
const domainColors = ['blue', 'pink', 'emerald', 'orange', 'violet', 'red', 'amber', 'indigo', 'cyan', 'lime', 'teal', 'purple'];

// Map domain color to icon container styles
const domainIconColors: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    pink: 'bg-pink-500/10 border-pink-500/20 text-pink-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    lime: 'bg-lime-500/10 border-lime-500/20 text-lime-400',
    teal: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
};

// Domain icon mapping
const domainIcons: Record<string, string> = {
    'patient': 'child_care',
    'gender': 'female',
    'repro': 'female',
    'long-term': 'monitoring',
    'older': 'elderly',
    'frailty': 'elderly',
    'mental': 'psychology',
    'urgent': 'emergency',
    'unscheduled': 'emergency',
    'health disadvantage': 'handshake',
    'vulnerability': 'handshake',
    'ethnicity': 'public',
    'culture': 'public',
    'diversity': 'public',
    'undifferentiated': 'question_mark',
    'prescribing': 'medication',
    'investigation': 'lab_research',
    'professional': 'forum',
};

function getIconForDomain(name: string): string {
    const lowerName = name.toLowerCase();
    for (const [key, icon] of Object.entries(domainIcons)) {
        if (lowerName.includes(key)) {
            return icon;
        }
    }
    return 'medical_services';
}

function StationCard({ station, onStart, onViewFeedback }: { station: Station; onStart: (stationId: string) => void; onViewFeedback: (sessionId: string) => void }) {
    const [expanded, setExpanded] = useState(false);

    const statusColors = {
        'completed': 'text-emerald-400',
        'in-progress': 'text-yellow-400',
        'not-started': 'text-gray-500',
    };

    const statusLabels = {
        'completed': 'Completed',
        'in-progress': 'In Progress',
        'not-started': 'Not Started',
    };

    const getScoreColor = (score?: number | null) => {
        if (score == null) return 'border-gray-600 text-gray-400';
        if (score >= 70) return 'border-emerald-500 bg-emerald-500/10 text-emerald-400';
        if (score >= 50) return 'border-yellow-500 bg-yellow-500/10 text-yellow-400';
        return 'border-red-500 bg-red-500/10 text-red-400';
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return `${Math.floor(diffDays / 30)}mo ago`;
    };

    const hasAttempts = station.attempts.length > 0;
    const latestAttempt = hasAttempts ? station.attempts[0] : null;

    const handleCardClick = () => {
        if (hasAttempts) {
            // If only 1 attempt, go straight to feedback
            if (station.attempts.length === 1 && latestAttempt) {
                onViewFeedback(latestAttempt.sessionId);
            } else {
                setExpanded(!expanded);
            }
        } else {
            onStart(station.id);
        }
    };

    return (
        <div className="rounded-xl bg-[#1a1a2e]/60 border border-[#2a2a4a] hover:border-purple-500/30 transition-all overflow-hidden">
            {/* Main Row */}
            <div
                onClick={handleCardClick}
                className="group flex items-center gap-4 py-4 px-5 cursor-pointer"
            >
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-purple-400 group-hover:text-purple-300 transition-colors">
                        {station.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs mt-1">
                        <span className={`flex items-center gap-1 ${statusColors[station.status]}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {statusLabels[station.status]}
                        </span>
                        {hasAttempts && (
                            <>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-500">{station.attempts.length} attempt{station.attempts.length !== 1 ? 's' : ''}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Score badge (most recent) */}
                {hasAttempts && latestAttempt?.score != null ? (
                    <div className={`px-4 py-2 rounded-lg border font-bold text-sm ${getScoreColor(latestAttempt.score)}`}>
                        {latestAttempt.score}%
                    </div>
                ) : station.status !== 'completed' ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onStart(station.id); }}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:scale-105 transition-all"
                    >
                        <span className="material-symbols-outlined text-xl">play_arrow</span>
                    </button>
                ) : null}

                {/* Expand / navigate indicator */}
                {hasAttempts && station.attempts.length > 1 ? (
                    <span className={`material-symbols-outlined text-gray-600 group-hover:text-gray-400 transition-all ${expanded ? 'rotate-90' : ''}`}>
                        chevron_right
                    </span>
                ) : hasAttempts ? (
                    <span className="material-symbols-outlined text-gray-600 group-hover:text-gray-400 transition-colors">
                        chevron_right
                    </span>
                ) : null}
            </div>

            {/* Expanded Attempts List */}
            {expanded && hasAttempts && (
                <div className="border-t border-[#2a2a4a]/60 bg-[#12122a]/60">
                    {station.attempts.map((attempt, i) => (
                        <div
                            key={attempt.sessionId}
                            onClick={() => onViewFeedback(attempt.sessionId)}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-[#2a2a4a]/30 last:border-b-0"
                        >
                            <span className="text-xs text-gray-500 font-mono w-6">#{station.attempts.length - i}</span>
                            <span className="text-sm text-gray-400 flex-1">
                                {formatDate(attempt.completedAt)}
                            </span>
                            {attempt.score != null && (
                                <span className={`text-sm font-bold ${attempt.score >= 70 ? 'text-emerald-400' : attempt.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {attempt.score}%
                                </span>
                            )}
                            <span className="material-symbols-outlined text-gray-600 text-base">open_in_new</span>
                        </div>
                    ))}
                    {/* Retry button */}
                    <div
                        onClick={(e) => { e.stopPropagation(); onStart(station.id); }}
                        className="flex items-center justify-center gap-2 px-5 py-3 hover:bg-purple-500/10 cursor-pointer transition-colors text-purple-400"
                    >
                        <span className="material-symbols-outlined text-base">replay</span>
                        <span className="text-sm font-semibold">Try Again</span>
                    </div>
                </div>
            )}
        </div>
    );
}

interface PageProps {
    params: Promise<{ domainId: string }>;
}

export default function DomainDetailPage({ params }: PageProps) {
    const { domainId } = use(params);
    const router = useRouter();
    const [stations, setStations] = useState<Station[]>([]);
    const [domainName, setDomainName] = useState('');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, []);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);

            // Get domain name
            const supabase = createClient();
            const { data: domain } = await supabase
                .from('domains')
                .select('name')
                .eq('id', domainId)
                .single();

            if (domain) {
                setDomainName(domain.name);
            }

            const stationsData = await getStationsForDomain(domainId, user?.id);
            setStations(stationsData);
            setLoading(false);
        }

        fetchData();
    }, [domainId, user]);

    const handleStartStation = (stationId: string) => {
        router.push(`/clinical-master?station=${stationId}`);
    };

    const handleViewFeedback = (sessionId: string) => {
        router.push(`/dashboard/feedback/${sessionId}`);
    };

    const completedCount = stations.filter(s => s.status === 'completed').length;
    const stationsWithScores = stations.filter(s => s.attempts.length > 0 && s.attempts[0].score != null);
    const avgScore = stationsWithScores.length > 0
        ? Math.round(stationsWithScores.reduce((sum, s) => sum + (s.attempts[0].score || 0), 0) / stationsWithScores.length)
        : 0;

    const domainShortName = domainName.split(' ').slice(0, 2).join(' ');
    const icon = getIconForDomain(domainName);
    const colorIndex = domainName.toLowerCase().charCodeAt(0) % domainColors.length;
    const color = domainColors[colorIndex];
    const iconColors = domainIconColors[color] || domainIconColors.blue;

    return (
        <main className="flex-1 bg-dashboard-gradient overflow-hidden relative flex flex-col h-screen">
            {/* Background gradient blobs */}
            <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-4xl mx-auto w-full h-full flex flex-col relative z-10 px-8">
                {/* Header */}
                <header className="w-full pt-10 pb-8 flex flex-col shrink-0">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 mb-6 group">
                        <Link
                            href="/dashboard/library"
                            className="hover:text-purple-400 transition-colors flex items-center gap-1"
                        >
                            <span className="material-symbols-outlined text-sm">home</span>
                            Station Library
                        </Link>
                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                        <span className="text-purple-400">{domainShortName}</span>
                    </div>

                    {/* Title Row */}
                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight">{domainShortName}</h1>
                            <p className="text-gray-400 text-sm mt-2 font-medium">
                                {stations.length > 0
                                    ? stations[0]?.domain_name
                                    : 'Loading...'
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-6 mb-1">
                            {/* Average Score */}
                            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                                <div className="text-right">
                                    <div className="text-[9px] uppercase font-bold text-gray-500 tracking-[0.2em]">
                                        Avg Score
                                    </div>
                                    <div className="text-sm font-black text-white">{avgScore}%</div>
                                </div>
                            </div>

                            {/* Completion Count */}
                            <div className="text-right">
                                <div className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-1">
                                    Category Completion
                                </div>
                                <div className="text-xl font-black text-white">
                                    {completedCount}/{stations.length}
                                </div>
                            </div>

                            {/* Domain Icon */}
                            <div
                                className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${iconColors}`}
                            >
                                <span className="material-symbols-outlined text-2xl">{icon}</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Station Cards */}
                <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                        </div>
                    ) : stations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <span className="material-symbols-outlined text-5xl mb-4">inbox</span>
                            <p className="text-lg font-medium">No stations available</p>
                            <p className="text-sm text-gray-500 mt-2">More stations coming soon for this domain</p>
                            <Link
                                href="/dashboard/library"
                                className="mt-6 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
                            >
                                Back to Library
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {stations.map((station) => (
                                <StationCard
                                    key={station.id}
                                    station={station}
                                    onStart={handleStartStation}
                                    onViewFeedback={handleViewFeedback}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

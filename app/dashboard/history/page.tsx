'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import SessionHistoryCard from '@/components/dashboard/SessionHistoryCard';
import {
    getSessionHistory,
    type SessionHistoryItem,
} from '@/lib/supabase/queries/dashboard';

export default function HistoryPage() {
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);

    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, [supabase.auth]);

    useEffect(() => {
        async function fetchHistory() {
            if (!user?.id) {
                if (user === null) {
                    setLoading(false);
                }
                return;
            }

            try {
                const data = await getSessionHistory(user.id, ITEMS_PER_PAGE, 0);
                setSessions(data);
                setHasMore(data.length === ITEMS_PER_PAGE);
            } catch (error) {
                console.error('Error fetching session history:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchHistory();
    }, [user]);

    const loadMore = async () => {
        if (!user?.id || !hasMore) return;

        try {
            const data = await getSessionHistory(user.id, ITEMS_PER_PAGE, sessions.length);
            setSessions(prev => [...prev, ...data]);
            setHasMore(data.length === ITEMS_PER_PAGE);
        } catch (error) {
            console.error('Error loading more sessions:', error);
        }
    };

    if (loading) {
        return (
            <main className="flex-1 bg-dashboard-gradient overflow-hidden relative flex items-center justify-center h-screen">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                    <p className="text-gray-400 text-sm">Loading session history...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 bg-dashboard-gradient overflow-hidden relative flex flex-col h-screen">
            {/* Background Gradients */}
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-4xl mx-auto w-full h-full flex flex-col relative z-10 px-8">
                {/* Header */}
                <header className="w-full pt-10 pb-8 flex flex-col shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 mb-6">
                        <Link href="/dashboard" className="hover:text-purple-400 transition-colors flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">home</span>
                            Dashboard
                        </Link>
                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                        <span className="text-purple-400">Session History</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight">Session History</h1>
                            <p className="text-gray-400 text-sm mt-2 font-medium">
                                Review your past consultation sessions and scores
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-1">
                                Total Sessions
                            </div>
                            <div className="text-xl font-black text-white">{sessions.length}</div>
                        </div>
                    </div>
                </header>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
                    {sessions.length === 0 ? (
                        <div className="glass-card rounded-2xl p-12 text-center">
                            <span className="material-symbols-outlined text-6xl text-gray-600 mb-4">history</span>
                            <h2 className="text-xl font-bold text-white mb-2">No sessions yet</h2>
                            <p className="text-gray-400 mb-6">
                                Complete a clinical consultation to see your history here.
                            </p>
                            <Link
                                href="/dashboard/library"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-white font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm">play_circle</span>
                                Start Your First Session
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {sessions.map((session) => (
                                <SessionHistoryCard key={session.id} session={session} />
                            ))}

                            {hasMore && (
                                <div className="flex justify-center py-6">
                                    <button
                                        onClick={loadMore}
                                        className="px-6 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all"
                                    >
                                        Load More Sessions
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

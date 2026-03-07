'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import StatCard from '@/components/dashboard/StatCard';
import ResumeStationCard from '@/components/dashboard/ResumeStationCard';
import StartNewCard from '@/components/dashboard/StartNewCard';
import PerformancePulse from '@/components/dashboard/PerformancePulse';
import BlueprintGrid from '@/components/dashboard/BlueprintGrid';
import {
    getUserStats,
    getPerformanceMetrics,
    getBlueprintDomains,
    getLastStation,
    updateLoginStreak,
} from '@/lib/supabase/queries/dashboard';
import type {
    UserStats,
    PerformanceMetrics,
    BlueprintDomain,
    LastStation,
} from '@/lib/dashboard/mock-data';

// Default empty states
const defaultStats: UserStats = {
    currentStreak: 0,
    completedStations: 0,
    totalStations: 0,
    examCountdownDays: 0,
};

const defaultMetrics: PerformanceMetrics = {
    dataGathering: 0,
    clinicalManagement: 0,
    interpersonalSkills: 0,
};

export default function DashboardPage() {
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<UserStats>(defaultStats);
    const [metrics, setMetrics] = useState<PerformanceMetrics>(defaultMetrics);
    const [domains, setDomains] = useState<BlueprintDomain[]>([]);
    const [lastStation, setLastStation] = useState<LastStation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get user first
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, [supabase.auth]);

    useEffect(() => {
        async function fetchDashboardData() {
            if (!user?.id) {
                if (user === null) {
                    // User check complete but no user
                    setLoading(false);
                }
                return;
            }

            try {
                // Update login streak
                await updateLoginStreak(user.id);

                // Fetch all dashboard data in parallel
                const [statsData, metricsData, domainsData, lastStationData] = await Promise.all([
                    getUserStats(user.id),
                    getPerformanceMetrics(user.id),
                    getBlueprintDomains(user.id),
                    getLastStation(user.id),
                ]);

                setStats(statsData);
                setMetrics(metricsData);
                setDomains(domainsData);
                setLastStation(lastStationData);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchDashboardData();
    }, [user]);

    // Format time remaining for last station
    const minutesRemaining = lastStation
        ? Math.floor(lastStation.timeRemaining / 60)
        : 0;

    if (loading) {
        return (
            <main className="flex-1 bg-dashboard-gradient overflow-auto relative flex flex-col">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col relative z-10">
                    {/* Skeleton header */}
                    <header className="w-full px-4 md:px-8 py-6 flex items-center shrink-0 border-b border-white/5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="glass-card rounded-2xl p-4 animate-pulse">
                                    <div className="h-3 bg-white/10 rounded w-1/2 mb-3" />
                                    <div className="h-5 bg-white/10 rounded w-3/4" />
                                </div>
                            ))}
                        </div>
                    </header>
                    {/* Skeleton content */}
                    <div className="flex-1 px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 glass-card rounded-2xl p-6 min-h-[160px] animate-pulse"><div className="h-4 bg-white/10 rounded w-2/3 mb-3" /><div className="h-3 bg-white/10 rounded w-1/2" /></div>
                            <div className="flex-1 glass-card rounded-2xl p-6 min-h-[160px] animate-pulse"><div className="h-4 bg-white/10 rounded w-2/3 mb-3" /><div className="h-3 bg-white/10 rounded w-1/2" /></div>
                        </div>
                        <div className="glass-card rounded-2xl p-6 animate-pulse"><div className="h-4 bg-white/10 rounded w-1/3 mb-4" /><div className="h-20 bg-white/10 rounded" /></div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 bg-dashboard-gradient overflow-auto relative flex flex-col">
            {/* Background Gradients */}
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col relative z-10">
                {/* Header Stats */}
                <header className="w-full px-4 md:px-8 py-6 flex items-center shrink-0 border-b border-white/5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full">
                        <StatCard
                            icon="local_fire_department"
                            iconColor="orange"
                            label="Current Streak"
                            value={stats.currentStreak > 0 ? `${stats.currentStreak} Days` : 'Start today!'}
                        />
                        <StatCard
                            icon="check_circle"
                            iconColor="blue"
                            label="Completed Stations"
                            value={`${stats.completedStations}/${stats.totalStations || '—'}`}
                        />
                        <StatCard
                            icon="event"
                            iconColor="purple"
                            label="Exam Countdown"
                            value={stats.examCountdownDays > 0 ? `${stats.examCountdownDays} Days` : 'Set date in settings'}
                        />
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 px-4 md:px-8 py-6 md:py-8 flex flex-col gap-6">
                    {/* Hero Cards Row */}
                    <section className="flex flex-col md:flex-row gap-6 shrink-0">
                        {lastStation ? (
                            <ResumeStationCard
                                title={lastStation.title}
                                domain={lastStation.domain}
                                patientName={lastStation.patientName}
                                timeRemaining={`${minutesRemaining}m left`}
                            />
                        ) : (
                            <div className="flex-1 glass-card rounded-2xl p-6 flex items-center justify-center min-h-[160px]">
                                <div className="text-center">
                                    <span className="material-symbols-outlined text-4xl text-gray-600 mb-2">play_circle</span>
                                    <p className="text-gray-400 text-sm">No session in progress</p>
                                    <p className="text-gray-500 text-xs mt-1">Start a new station to begin practicing</p>
                                </div>
                            </div>
                        )}
                        <StartNewCard />
                    </section>

                    {/* Performance Pulse */}
                    <PerformancePulse metrics={metrics} />

                    {/* RCGP Blueprint Grid */}
                    {domains.length > 0 ? (
                        <BlueprintGrid domains={domains} />
                    ) : (
                        <div className="glass-card rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4">RCGP Blueprint Progress</h2>
                            <p className="text-gray-400 text-sm">
                                Complete stations to track your progress across the 12 RCGP curriculum domains.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

'use client';

import StatCard from '@/components/dashboard/StatCard';
import ResumeStationCard from '@/components/dashboard/ResumeStationCard';
import StartNewCard from '@/components/dashboard/StartNewCard';
import PerformancePulse from '@/components/dashboard/PerformancePulse';
import BlueprintGrid from '@/components/dashboard/BlueprintGrid';
import {
    mockUserStats,
    mockLastStation,
    mockPerformanceMetrics,
    mockBlueprintDomains,
} from '@/lib/dashboard/mock-data';

export default function DashboardPage() {
    // Format time remaining
    const minutesRemaining = Math.floor(mockLastStation.timeRemaining / 60);

    return (
        <main className="flex-1 bg-dashboard-gradient overflow-hidden relative flex flex-col h-screen">
            {/* Background Gradients */}
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-6xl mx-auto w-full h-full flex flex-col relative z-10">
                {/* Header Stats */}
                <header className="w-full px-8 py-6 flex items-center shrink-0 border-b border-white/5">
                    <div className="grid grid-cols-3 gap-6 w-full">
                        <StatCard
                            icon="local_fire_department"
                            iconColor="orange"
                            label="Current Streak"
                            value={`${mockUserStats.currentStreak} Days`}
                        />
                        <StatCard
                            icon="check_circle"
                            iconColor="blue"
                            label="Completed Stations"
                            value={`${mockUserStats.completedStations}/${mockUserStats.totalStations}`}
                        />
                        <StatCard
                            icon="event"
                            iconColor="purple"
                            label="Exam Countdown"
                            value={`${mockUserStats.examCountdownDays} Days`}
                        />
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 px-8 py-8 overflow-hidden flex flex-col gap-6">
                    {/* Hero Cards Row */}
                    <section className="flex flex-col md:flex-row gap-6 shrink-0">
                        <ResumeStationCard
                            title={mockLastStation.title}
                            domain={mockLastStation.domain}
                            patientName={mockLastStation.patientName}
                            timeRemaining={`${minutesRemaining}m left`}
                        />
                        <StartNewCard />
                    </section>

                    {/* Performance Pulse */}
                    <PerformancePulse metrics={mockPerformanceMetrics} />

                    {/* RCGP Blueprint Grid */}
                    <BlueprintGrid domains={mockBlueprintDomains} />
                </div>
            </div>
        </main>
    );
}

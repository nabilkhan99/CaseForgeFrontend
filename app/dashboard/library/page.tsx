'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { getDomains, type Domain } from '@/lib/supabase/queries/station-library';
import Link from 'next/link';

// Domain icon mapping based on name patterns
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

// Get icon for a domain
function getIconForDomain(name: string): string {
    const lowerName = name.toLowerCase();
    for (const [key, icon] of Object.entries(domainIcons)) {
        if (lowerName.includes(key)) {
            return icon;
        }
    }
    return 'medical_services';
}

// Domain colors
const domainColors = ['blue', 'pink', 'emerald', 'orange', 'violet', 'red', 'amber', 'indigo', 'cyan', 'lime', 'teal', 'purple'];

function DomainCard({ domain, index }: { domain: Domain; index: number }) {
    const icon = getIconForDomain(domain.name);
    const color = domainColors[index % domainColors.length];
    const hasStations = domain.station_count > 0;

    const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
        pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
        orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
        red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
        cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
        lime: { bg: 'bg-lime-500/10', text: 'text-lime-400', border: 'border-lime-500/20' },
        teal: { bg: 'bg-teal-500/10', text: 'text-teal-400', border: 'border-teal-500/20' },
        purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
    };

    const colors = colorClasses[color] || colorClasses.blue;

    const CardContent = () => (
        <div className={`group relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${hasStations
                ? 'bg-[#1a1a2e]/60 border-[#2a2a4a] hover:border-purple-500/30 cursor-pointer'
                : 'bg-[#1a1a2e]/30 border-[#2a2a4a]/50 opacity-60 cursor-not-allowed'
            }`}>
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
                <span className={`material-symbols-rounded text-2xl ${colors.text}`}>{icon}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold truncate">{domain.name}</h3>
                <p className="text-gray-500 text-sm uppercase tracking-wider truncate">
                    {domain.description}
                </p>
            </div>

            {/* Progress Badge */}
            <div className={`px-3 py-1.5 rounded-lg ${colors.bg} ${colors.text} text-sm font-medium`}>
                {domain.completed_count} / {domain.station_count}
            </div>

            {/* Chevron */}
            {hasStations && (
                <span className="material-symbols-rounded text-gray-600 group-hover:text-gray-400 transition-colors">
                    chevron_right
                </span>
            )}
        </div>
    );

    if (!hasStations) {
        return <CardContent />;
    }

    return (
        <Link href={`/dashboard/library/${domain.id}`}>
            <CardContent />
        </Link>
    );
}

export default function StationLibraryPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const supabase = createClient();

        // Get current user
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, []);

    useEffect(() => {
        async function fetchDomains() {
            setLoading(true);
            const data = await getDomains(user?.id);
            setDomains(data);
            setLoading(false);
        }

        fetchDomains();
    }, [user]);

    const totalStations = domains.reduce((sum, d) => sum + d.station_count, 0);

    return (
        <main className="flex-1 bg-dashboard-gradient overflow-hidden relative flex flex-col h-screen">
            {/* Background gradient blobs */}
            <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-4xl mx-auto w-full h-full flex flex-col relative z-10 px-8">
                {/* Header */}
                <header className="w-full py-10 flex flex-col items-center shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="h-px w-8 bg-purple-500/50" />
                        <span className="text-[10px] uppercase font-black tracking-[0.3em] text-purple-400">
                            RCGP Blueprint
                        </span>
                        <span className="h-px w-8 bg-purple-500/50" />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tight text-center">
                        Station Library
                    </h1>
                    <p className="text-gray-400 text-sm mt-3 font-medium text-center">
                        {totalStations > 0
                            ? `${totalStations} station${totalStations !== 1 ? 's' : ''} available across 12 RCGP domains`
                            : 'No stations available yet - more coming soon!'
                        }
                    </p>
                </header>

                {/* Domain Cards Grid */}
                <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                            {domains.map((domain, index) => (
                                <DomainCard key={domain.id} domain={domain} index={index} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

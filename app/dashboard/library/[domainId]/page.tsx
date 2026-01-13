import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDomainDetail, getDomainById } from '@/lib/station-library/mock-data';
import CaseCard from '@/components/station-library/CaseCard';

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
};

interface PageProps {
    params: Promise<{ domainId: string }>;
}

export default async function DomainDetailPage({ params }: PageProps) {
    const { domainId } = await params;
    const domainDetail = getDomainDetail(domainId);
    const domain = getDomainById(domainId);

    if (!domainDetail || !domain) {
        notFound();
    }

    const iconColors = domainIconColors[domain.color] || domainIconColors.blue;

    // Get readable domain name (first word of name for breadcrumb)
    const domainShortName = domain.name.split(' ').slice(0, 2).join(' ');

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
                            <p className="text-gray-400 text-sm mt-2 font-medium">{domain.subtitle}</p>
                        </div>
                        <div className="flex items-center gap-6 mb-1">
                            {/* Average Score */}
                            <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                                <div className="text-right">
                                    <div className="text-[9px] uppercase font-bold text-gray-500 tracking-[0.2em]">
                                        Avg Score
                                    </div>
                                    <div className="text-sm font-black text-white">{domainDetail.avgScore}%</div>
                                </div>
                            </div>

                            {/* Completion Count */}
                            <div className="text-right">
                                <div className="text-[10px] uppercase font-bold text-gray-500 tracking-[0.2em] mb-1">
                                    Category Completion
                                </div>
                                <div className="text-xl font-black text-white">
                                    {domain.completed}/{domain.total}
                                </div>
                            </div>

                            {/* Domain Icon */}
                            <div
                                className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${iconColors}`}
                            >
                                <span className="material-symbols-outlined text-2xl">{domain.icon}</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Case Cards */}
                <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
                    <div className="flex flex-col gap-3">
                        {domainDetail.cases.map((stationCase) => (
                            <CaseCard key={stationCase.id} stationCase={stationCase} />
                        ))}

                        {/* Load More Button */}
                        <div className="flex justify-center py-6">
                            <button className="px-6 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all">
                                Load More Cases
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

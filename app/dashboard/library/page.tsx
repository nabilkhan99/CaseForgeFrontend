import { rcgpDomains } from '@/lib/station-library/mock-data';
import DomainCard from '@/components/station-library/DomainCard';

export default function StationLibraryPage() {
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
                        Master all 12 RCGP domains through focused simulation
                    </p>
                </header>

                {/* Domain Cards Grid */}
                <div className="flex-1 overflow-y-auto pb-20 no-scrollbar">
                    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                        {rcgpDomains.map((domain) => (
                            <DomainCard key={domain.id} domain={domain} />
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}

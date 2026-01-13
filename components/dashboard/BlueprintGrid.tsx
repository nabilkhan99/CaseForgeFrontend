import { BlueprintDomain } from '@/lib/dashboard/mock-data';
import DomainCard from './DomainCard';

interface BlueprintGridProps {
    domains: BlueprintDomain[];
}

export default function BlueprintGrid({ domains }: BlueprintGridProps) {
    return (
        <section className="glass-card rounded-2xl p-6 flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: '20px' }}>
                            model_training
                        </span>
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">RCGP Blueprint Coverage</h3>
                </div>
                <span className="text-[10px] font-black bg-white/5 px-2 py-1 rounded border border-white/10 text-gray-400 uppercase tracking-widest">
                    12 Domains
                </span>
            </div>

            {/* Grid */}
            <div className="overflow-y-auto pr-1 no-scrollbar flex-1">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-2">
                    {domains.map((domain) => (
                        <DomainCard key={domain.id} domain={domain} />
                    ))}
                </div>
            </div>
        </section>
    );
}

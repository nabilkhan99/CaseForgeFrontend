import { BlueprintDomain } from '@/lib/dashboard/mock-data';

interface DomainCardProps {
    domain: BlueprintDomain;
    onClick?: () => void;
}

export default function DomainCard({ domain, onClick }: DomainCardProps) {
    const isMastered = domain.percentage === 100;

    return (
        <div
            onClick={onClick}
            className={`${isMastered
                    ? 'bg-indigo-600/40 border border-indigo-400 shadow-lg shadow-indigo-500/20'
                    : 'glass-card'
                } hover:-translate-y-1 rounded-xl flex flex-col justify-between transition-all cursor-pointer group min-h-[100px] relative overflow-hidden`}
        >
            {/* Progress background */}
            {!isMastered && (
                <div
                    className="absolute inset-0 bg-blue-500/10 z-0"
                    style={{ width: `${domain.percentage}%` }}
                />
            )}

            {/* Content */}
            <div className="relative z-10 p-4 flex flex-col h-full justify-between">
                <span
                    className={`text-[11px] font-bold ${isMastered ? 'text-white' : 'text-gray-300 group-hover:text-white'
                        } leading-tight uppercase tracking-tight line-clamp-2`}
                >
                    {domain.name}
                </span>

                <div className="mt-4 flex items-center justify-between">
                    {isMastered ? (
                        <>
                            <span className="text-[10px] text-indigo-200 font-bold uppercase">Mastered</span>
                            <span className="text-xs font-black text-white flex items-center gap-1">
                                100%
                                <span className="material-symbols-outlined text-[14px] fill text-yellow-400">stars</span>
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="text-[10px] text-gray-500 font-bold">
                                {domain.completed}/{domain.total}
                            </span>
                            <span className="text-xs font-black text-gray-400">{domain.percentage}%</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

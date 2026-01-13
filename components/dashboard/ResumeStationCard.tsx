interface ResumeStationCardProps {
    title: string;
    domain: string;
    patientName: string;
    timeRemaining: string;
    onClick?: () => void;
}

export default function ResumeStationCard({
    title,
    domain,
    patientName,
    timeRemaining,
    onClick,
}: ResumeStationCardProps) {
    return (
        <button
            onClick={onClick}
            className="flex-[2] bg-purple-indigo-vibrant hover:brightness-110 rounded-2xl p-6 text-left shadow-2xl shadow-indigo-500/40 border border-white/30 transition-all group/btn flex flex-col justify-between h-[180px] relative overflow-hidden"
        >
            {/* Background Icon */}
            <div className="absolute -top-4 -right-4 opacity-30 group-hover/btn:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-[140px] fill text-white">play_circle</span>
            </div>

            {/* Content */}
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[10px] font-bold text-white backdrop-blur-md uppercase tracking-wider border border-white/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Resume Last Station
                    </span>
                </div>
                <h3 className="text-2xl font-black text-white mb-2 leading-tight">{title}</h3>
                <p className="text-white/80 text-xs flex items-center gap-3 font-semibold">
                    <span className="bg-black/20 px-2 py-0.5 rounded">{domain}</span>
                    <span className="opacity-40">•</span>
                    <span>{patientName}</span>
                    <span className="opacity-40">•</span>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">timer</span>
                        {timeRemaining}
                    </span>
                </p>
            </div>

            {/* CTA */}
            <div className="mt-auto flex items-center text-sm font-extrabold text-white group-hover/btn:translate-x-1 transition-transform">
                CONTINUE MISSION
                <span className="material-symbols-outlined ml-2 text-xl font-bold">play_arrow</span>
            </div>
        </button>
    );
}

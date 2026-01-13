interface StartNewCardProps {
    onClick?: () => void;
}

export default function StartNewCard({ onClick }: StartNewCardProps) {
    return (
        <button
            onClick={onClick}
            className="flex-1 glass-card hover:bg-white/[0.08] rounded-2xl p-6 flex flex-col justify-center items-center text-center gap-4 transition-all group/new h-[180px]"
        >
            <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover/new:scale-110 group-hover/new:border-purple-500/50 transition-all shadow-lg">
                <span className="material-symbols-outlined text-purple-400 text-3xl font-light">add_circle</span>
            </div>
            <div>
                <h3 className="text-base font-bold text-white">Start New</h3>
                <p className="text-[10px] text-purple-400 mt-1 uppercase tracking-widest font-black bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
                    Random Topic
                </p>
            </div>
        </button>
    );
}

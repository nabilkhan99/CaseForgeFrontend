interface StatCardProps {
    icon: string;
    iconColor: 'orange' | 'blue' | 'purple';
    label: string;
    value: string;
}

export default function StatCard({ icon, iconColor, label, value }: StatCardProps) {
    const colorClasses = {
        orange: 'bg-orange-500/20 text-orange-400',
        blue: 'bg-blue-500/20 text-blue-400',
        purple: 'bg-purple-500/20 text-purple-400',
    };

    return (
        <div className="glass-card rounded-2xl px-5 py-3.5 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl ${colorClasses[iconColor]} flex items-center justify-center shrink-0`}>
                <span className="material-symbols-outlined fill" style={{ fontSize: '20px' }}>
                    {icon}
                </span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-0.5">{label}</span>
                <span className="text-lg font-extrabold text-white leading-none">{value}</span>
            </div>
        </div>
    );
}

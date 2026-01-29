interface AuthCardProps {
    children: React.ReactNode;
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
    accentColor?: 'blue' | 'green' | 'purple';
}

const iconBgColors = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    purple: 'bg-purple-500/20 text-purple-400',
};

export default function AuthCard({ children, icon, title, subtitle, accentColor = 'blue' }: AuthCardProps) {
    return (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            {/* Icon */}
            {icon && (
                <div className={`w-14 h-14 rounded-xl ${iconBgColors[accentColor]} flex items-center justify-center mx-auto mb-6`}>
                    {icon}
                </div>
            )}

            {/* Title */}
            <h1 className="text-2xl font-bold text-white text-center mb-1">
                {title.includes('Fourteen Fisherman') ? (
                    <>
                        {title.split('Fourteen Fisherman')[0]}
                        <span className="text-blue-400">Fourteen Fisherman</span>
                        {title.split('Fourteen Fisherman')[1]}
                    </>
                ) : (
                    <span className={accentColor === 'green' ? 'text-emerald-400' : 'text-white'}>
                        {title}
                    </span>
                )}
            </h1>

            {/* Subtitle */}
            {subtitle && (
                <p className="text-slate-400 text-center text-sm mb-8">
                    {subtitle}
                </p>
            )}

            {/* Content */}
            {children}
        </div>
    );
}

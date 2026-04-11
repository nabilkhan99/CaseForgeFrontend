interface AuthCardProps {
    children: React.ReactNode;
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
    accentColor?: 'blue' | 'green' | 'purple';
}

export default function AuthCard({ children, icon, title, subtitle }: AuthCardProps) {
    return (
        <div className="bg-white/60 backdrop-blur-xl border border-black/[0.04] shadow-elevation-2 rounded-2xl p-8">
            {/* Icon */}
            {icon && (
                <div className="w-14 h-14 rounded-xl bg-primary/20 text-primary flex items-center justify-center mx-auto mb-6">
                    {icon}
                </div>
            )}

            {/* Title */}
            <h1 className="text-2xl font-bold text-heading text-center mb-1">
                {title.includes('Fourteen Fisherman') ? (
                    <>
                        {title.split('Fourteen Fisherman')[0]}
                        <span className="text-primary">Fourteen Fisherman</span>
                        {title.split('Fourteen Fisherman')[1]}
                    </>
                ) : (
                    title
                )}
            </h1>

            {/* Subtitle */}
            {subtitle && (
                <p className="text-muted text-center text-sm mb-8">
                    {subtitle}
                </p>
            )}

            {/* Content */}
            {children}
        </div>
    );
}

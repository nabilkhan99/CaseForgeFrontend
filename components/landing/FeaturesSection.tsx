import { features } from '@/lib/landing/mock-data';

const colorMap = {
    yellow: {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        shadow: 'shadow-[0_0_15px_-3px_rgba(234,179,8,0.2)]',
        text: 'text-yellow-500',
        hover: 'hover:border-yellow-500/30',
    },
    green: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        shadow: 'shadow-[0_0_15px_-3px_rgba(34,197,94,0.2)]',
        text: 'text-green-500',
        hover: 'hover:border-green-500/30',
    },
    blue: {
        bg: 'bg-primary/10',
        border: 'border-primary/20',
        shadow: 'shadow-[0_0_15px_-3px_rgba(23,84,207,0.3)]',
        text: 'text-primary',
        hover: 'hover:border-primary/30',
    },
    purple: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        shadow: 'shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)]',
        text: 'text-purple-500',
        hover: 'hover:border-purple-500/30',
    },
};

export default function FeaturesSection() {
    return (
        <section id="features" className="py-24 bg-[#111318] relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
            </div>

            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Header */}
                <div className="mb-10 text-center">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
                        Everything you need to{' '}
                        <span className="gradient-text-blue">
                            pass.
                        </span>
                    </h2>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        We&apos;re not just another question bank. We are a complete
                        simulation ecosystem designed to bridge the gap between revision
                        and reality.
                    </p>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {features.map((feature, index) => {
                        const colors = colorMap[feature.color];
                        return (
                            <div
                                key={index}
                                className={`group relative bg-[#1e293b]/40 backdrop-blur-sm rounded-3xl border border-slate-800 p-6 overflow-hidden ${colors.hover} transition-all duration-300`}
                            >
                                {/* Background Icon */}
                                <div className="absolute -top-10 -right-10 p-12 opacity-[0.03] group-hover:opacity-10 transition-opacity duration-500 transform group-hover:scale-110 origin-top-right">
                                    <span
                                        className={`material-symbols-outlined text-[150px] ${colors.text} leading-none`}
                                    >
                                        {feature.icon}
                                    </span>
                                </div>

                                <div className="relative z-10 flex flex-col justify-between h-full">
                                    <div>
                                        {/* Icon */}
                                        <div
                                            className={`w-12 h-12 rounded-2xl ${colors.bg} flex items-center justify-center mb-4 border ${colors.border} ${colors.shadow}`}
                                        >
                                            <span
                                                className={`material-symbols-outlined text-2xl ${colors.text}`}
                                            >
                                                {feature.icon}
                                            </span>
                                        </div>

                                        {/* Content */}
                                        <h3 className="text-lg font-bold text-white mb-2">
                                            {feature.title}
                                        </h3>
                                        <p className="text-slate-400 text-sm leading-relaxed">
                                            {feature.description}
                                        </p>
                                    </div>

                                    {/* Badge */}
                                    {feature.badge && (
                                        <div className="mt-4 pt-4 border-t border-slate-800/50">
                                            <div
                                                className={`flex items-center gap-2 text-xs ${colors.text} font-mono uppercase tracking-wider`}
                                            >
                                                <span className="material-symbols-outlined text-sm">
                                                    check_circle
                                                </span>{' '}
                                                {feature.badge}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

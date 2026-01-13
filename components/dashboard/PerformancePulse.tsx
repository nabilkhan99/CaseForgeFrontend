import { PerformanceMetrics } from '@/lib/dashboard/mock-data';

interface PerformancePulseProps {
    metrics: PerformanceMetrics;
}

interface DomainBarProps {
    label: string;
    shortLabel: string;
    percentage: number;
    color: 'emerald' | 'orange' | 'blue';
}

function DomainBar({ label, shortLabel, percentage, color }: DomainBarProps) {
    const colorClasses = {
        emerald: {
            text: 'text-emerald-400',
            gradient: 'from-emerald-600 to-emerald-400',
            glow: 'progress-glow-emerald',
            hover: 'group-hover:text-emerald-400',
        },
        orange: {
            text: 'text-orange-400',
            gradient: 'from-orange-600 to-orange-400',
            glow: 'progress-glow-orange',
            hover: 'group-hover:text-orange-400',
        },
        blue: {
            text: 'text-blue-400',
            gradient: 'from-blue-600 to-blue-400',
            glow: 'progress-glow-blue',
            hover: 'group-hover:text-blue-400',
        },
    };

    const colors = colorClasses[color];

    return (
        <div className="flex flex-col gap-3 group cursor-pointer">
            <div className="flex justify-between items-end mb-1">
                <span
                    className={`text-[11px] text-gray-400 font-bold ${colors.hover} transition-colors truncate uppercase tracking-tighter`}
                    title={label}
                >
                    {shortLabel}
                </span>
                <span className={`text-sm font-black ${colors.text}`}>{percentage}%</span>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full relative flex items-center border border-white/5">
                {/* Pass line at 60% */}
                <div className="absolute inset-y-[-4px] left-[60%] w-[1px] bg-white/100 z-20 shadow-[0_0_8px_white]" />

                {/* Progress bar */}
                <div
                    className={`h-1.5 bg-gradient-to-r ${colors.gradient} rounded-full absolute left-0 z-10 ${colors.glow}`}
                    style={{ width: `${percentage}%` }}
                />

                {/* Current position indicator */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-5 bg-white z-30 shadow-[0_0_12px_white] rounded-full"
                    style={{ left: `${percentage}%` }}
                />
            </div>
        </div>
    );
}

export default function PerformancePulse({ metrics }: PerformancePulseProps) {
    return (
        <section className="glass-card rounded-2xl px-6 py-6 shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-400" style={{ fontSize: '20px' }}>
                            ecg_heart
                        </span>
                    </div>
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Performance Pulse</h3>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-3 bg-white shadow-[0_0_10px_white] rounded-full" />
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Your Score</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-px border-l-2 border-dashed border-white/100" />
                        <span className="text-[10px] text-gray-200 font-bold uppercase tracking-wide">Pass (60%)</span>
                    </div>
                </div>
            </div>

            {/* Three Domain Bars */}
            <div className="grid grid-cols-3 gap-10">
                <DomainBar
                    label="Data Gathering and Diagnosis"
                    shortLabel="Data Gathering & Diagnosis"
                    percentage={metrics.dataGathering}
                    color="emerald"
                />
                <DomainBar
                    label="Clinical Management and Medical Complexity"
                    shortLabel="Clinical Mgmt & Complexity"
                    percentage={metrics.clinicalManagement}
                    color="orange"
                />
                <DomainBar
                    label="Interpersonal Skills"
                    shortLabel="Interpersonal Skills"
                    percentage={metrics.interpersonalSkills}
                    color="blue"
                />
            </div>
        </section>
    );
}

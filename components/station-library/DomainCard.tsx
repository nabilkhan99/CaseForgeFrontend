'use client';

import Link from 'next/link';
import { RCGPDomain } from '@/lib/station-library/mock-data';

interface DomainCardProps {
    domain: RCGPDomain;
}

// Map color names to Tailwind classes
const colorClasses: Record<string, { bg: string; border: string; text: string; hoverBg: string; hoverText: string }> = {
    blue: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        text: 'text-blue-400',
        hoverBg: 'group-hover:bg-blue-500/20',
        hoverText: 'group-hover:text-blue-400',
    },
    pink: {
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/20',
        text: 'text-pink-400',
        hoverBg: 'group-hover:bg-pink-500/20',
        hoverText: 'group-hover:text-pink-400',
    },
    emerald: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        text: 'text-emerald-400',
        hoverBg: 'group-hover:bg-emerald-500/20',
        hoverText: 'group-hover:text-emerald-400',
    },
    orange: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/20',
        text: 'text-orange-400',
        hoverBg: 'group-hover:bg-orange-500/20',
        hoverText: 'group-hover:text-orange-400',
    },
    violet: {
        bg: 'bg-violet-500/10',
        border: 'border-violet-500/20',
        text: 'text-violet-400',
        hoverBg: 'group-hover:bg-violet-500/20',
        hoverText: 'group-hover:text-violet-400',
    },
    red: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        text: 'text-red-400',
        hoverBg: 'group-hover:bg-red-500/20',
        hoverText: 'group-hover:text-red-400',
    },
    amber: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        text: 'text-amber-400',
        hoverBg: 'group-hover:bg-amber-500/20',
        hoverText: 'group-hover:text-amber-400',
    },
    indigo: {
        bg: 'bg-indigo-500/10',
        border: 'border-indigo-500/20',
        text: 'text-indigo-400',
        hoverBg: 'group-hover:bg-indigo-500/20',
        hoverText: 'group-hover:text-indigo-400',
    },
    cyan: {
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500/20',
        text: 'text-cyan-400',
        hoverBg: 'group-hover:bg-cyan-500/20',
        hoverText: 'group-hover:text-cyan-400',
    },
    lime: {
        bg: 'bg-lime-500/10',
        border: 'border-lime-500/20',
        text: 'text-lime-400',
        hoverBg: 'group-hover:bg-lime-500/20',
        hoverText: 'group-hover:text-lime-400',
    },
    teal: {
        bg: 'bg-teal-500/10',
        border: 'border-teal-500/20',
        text: 'text-teal-400',
        hoverBg: 'group-hover:bg-teal-500/20',
        hoverText: 'group-hover:text-teal-400',
    },
};

export default function DomainCard({ domain }: DomainCardProps) {
    const colors = colorClasses[domain.color] || colorClasses.blue;

    // Mastered state has special styling
    if (domain.mastered) {
        return (
            <Link
                href={`/dashboard/library/${domain.id}`}
                className="bg-indigo-600/30 border border-indigo-400/40 rounded-2xl p-4 flex items-center justify-between group cursor-pointer shadow-lg shadow-indigo-500/10 hover:bg-indigo-600/40 transition-all duration-300"
            >
                <div className="flex items-center gap-5">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-400/20 border border-indigo-400/40 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-all duration-300">
                        <span className="material-symbols-outlined text-3xl">{domain.icon}</span>
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-white">{domain.name}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">Mastered</span>
                            <span className="material-symbols-outlined text-[14px] text-yellow-400">stars</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="px-4 py-2 rounded-xl bg-white/20 border border-white/20">
                        <span className="text-xs font-black text-white uppercase tracking-widest">
                            {domain.completed} / {domain.total}
                        </span>
                    </div>
                    <span className="material-symbols-outlined text-white/50 group-hover:text-white transition-colors">
                        chevron_right
                    </span>
                </div>
            </Link>
        );
    }

    return (
        <Link
            href={`/dashboard/library/${domain.id}`}
            className="glass-card rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:-translate-y-1"
        >
            <div className="flex items-center gap-5">
                <div
                    className={`h-14 w-14 rounded-2xl ${colors.bg} ${colors.border} border flex items-center justify-center ${colors.text} shrink-0 group-hover:scale-110 ${colors.hoverBg} transition-all duration-300`}
                >
                    <span className="material-symbols-outlined text-3xl">{domain.icon}</span>
                </div>
                <div className="flex flex-col">
                    <h3 className={`text-lg font-bold text-white ${colors.hoverText} transition-colors`}>
                        {domain.name}
                    </h3>
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                        {domain.subtitle}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <span className="text-xs font-black text-purple-400 uppercase tracking-widest">
                        {domain.completed} / {domain.total}
                    </span>
                </div>
                <span className="material-symbols-outlined text-gray-600 group-hover:text-white transition-colors">
                    chevron_right
                </span>
            </div>
        </Link>
    );
}

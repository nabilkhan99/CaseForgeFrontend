'use client';

import Link from 'next/link';
import type { CaseBankStation } from '@/lib/supabase/queries/cases';

interface CaseBankCardProps {
    station: CaseBankStation;
    index: number;
}

const difficultyConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    beginner: { label: 'Beginner', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    intermediate: { label: 'Intermediate', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    advanced: { label: 'Advanced', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

const consultTypeIcons: Record<string, string> = {
    'face-to-face': 'person',
    'video': 'videocam',
    'telephone': 'call',
};

export default function CaseBankCard({ station, index }: CaseBankCardProps) {
    const diff = difficultyConfig[station.difficulty || 'intermediate'] || difficultyConfig.intermediate;
    const consultIcon = consultTypeIcons[station.consultation_type || 'face-to-face'] || 'person';
    const durationMin = Math.floor(station.consultation_duration_seconds / 60);

    // Build a short description from patient info
    const ageStr = station.patient_age < 1
        ? 'Infant'
        : station.patient_age < 18
            ? `${station.patient_age}yo`
            : `${station.patient_age}yo`;

    // Gender guess from name is unreliable — just show age
    const shortDesc = `${ageStr} • ${station.patient_name}`;

    return (
        <Link href={`/cases/${station.id}`}>
            <div
                className="group relative flex-shrink-0 w-[300px] rounded-2xl border border-white/[0.08] bg-[#111827]/80 backdrop-blur-sm p-5 cursor-pointer transition-all duration-300 hover:border-purple-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/5"
                style={{ animationDelay: `${index * 50}ms` }}
            >
                {/* Top row: tag + badge */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-gray-500 tracking-wider uppercase">
                        #{station.domain_name.substring(0, 4).toUpperCase()}-{String(index + 1).padStart(3, '0')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${diff.bg} ${diff.color} ${diff.border} border`}>
                        {diff.label}
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-[15px] font-bold text-white leading-snug mb-2 group-hover:text-purple-300 transition-colors line-clamp-2 min-h-[40px]">
                    {station.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-gray-400 mb-4 line-clamp-1">
                    {shortDesc}
                </p>

                {/* Bottom row: metadata */}
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{consultIcon}</span>
                            {station.consultation_type || 'Face-to-face'}
                        </span>
                    </div>
                    <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>schedule</span>
                        {durationMin}m
                    </span>
                </div>
            </div>
        </Link>
    );
}

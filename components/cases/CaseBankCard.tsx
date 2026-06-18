'use client';

import Link from 'next/link';
import type { SeoCase } from '@/lib/seo/cases';

interface CaseBankCardProps {
    station: SeoCase;
}

function VideoIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
    );
}

function PhoneIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.77a16 16 0 0 0 6.29 6.29l1.13-1.84a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

const consultTypeIcons: Record<string, React.ReactNode> = {
    'video': <VideoIcon />,
    'telephone': <PhoneIcon />,
};

export default function CaseBankCard({ station }: CaseBankCardProps) {
    const consultIcon = consultTypeIcons[station.consultation_type || 'video'] || <VideoIcon />;
    const durationMin = Math.floor(station.consultation_duration_seconds / 60);

    const ageStr = station.patient_age < 1
        ? 'Infant'
        : `${station.patient_age}yo`;

    const shortDesc = `${ageStr} • ${station.patient_name}`;

    return (
        <Link href={station.path} className="h-full block">
            <div className="group relative rounded-xl bg-white/60 backdrop-blur-sm border border-black/[0.04] hover:border-primary/[0.15] hover:shadow-elevation-1 transition-all duration-200 cursor-pointer p-5 h-full flex flex-col">
                {/* Title */}
                <h3 className="text-sm font-semibold text-heading leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-3 sm:line-clamp-2 min-h-[44px]">
                    {station.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-muted mb-4 line-clamp-1">
                    {shortDesc}
                </p>

                {/* Bottom row: metadata */}
                <div className="flex items-center justify-between text-[11px] text-muted mt-auto pt-3 border-t border-black/[0.04]">
                    <span className="flex items-center gap-1.5">
                        {consultIcon}
                        {station.consultation_type === 'telephone' ? 'Telephone' : 'Video'}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <ClockIcon />
                        {durationMin}m
                    </span>
                </div>
            </div>
        </Link>
    );
}

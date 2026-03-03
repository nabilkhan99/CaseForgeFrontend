'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FreeCaseStation {
    id: string;
    title: string;
    patient_name: string;
    patient_age: number;
    difficulty: string;
    reading_duration_seconds: number;
    consultation_duration_seconds: number;
    domains: { id: string; name: string } | null;
}

const DOMAIN_COLORS: Record<string, string> = {
    'Cardiovascular Health': 'from-red-500/20 to-red-600/5 border-red-500/30',
    'Allergy and Immunology': 'from-amber-500/20 to-amber-600/5 border-amber-500/30',
    'Ear, Nose and Throat': 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
    'Dermatology': 'from-pink-500/20 to-pink-600/5 border-pink-500/30',
    'Gastroenterology': 'from-green-500/20 to-green-600/5 border-green-500/30',
};

const DOMAIN_ICONS: Record<string, string> = {
    'Cardiovascular Health': 'cardiology',
    'Allergy and Immunology': 'immunology',
    'Ear, Nose and Throat': 'hearing',
    'Dermatology': 'dermatology',
    'Gastroenterology': 'gastroenterology',
};

export default function TryCasePickerPage() {
    const [cases, setCases] = useState<FreeCaseStation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFreeCases() {
            try {
                const res = await fetch('/api/try/free-cases');
                if (res.ok) {
                    const data = await res.json();
                    setCases(data.stations || []);
                }
            } catch (err) {
                console.error('Error fetching free cases:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchFreeCases();
    }, []);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
            {/* Header */}
            <div className="text-center mb-12 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>science</span>
                    FREE TRIAL — NO ACCOUNT REQUIRED
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                    Try a Free <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">SCA Case</span>
                </h1>
                <p className="text-slate-400 text-lg leading-relaxed">
                    Experience our AI-powered clinical consultation simulator. Pick a case below,
                    read the brief, then speak to a simulated patient — just like the real SCA exam.
                </p>
            </div>

            {/* Case Cards */}
            {loading ? (
                <div className="flex items-center gap-3 text-slate-400">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                    <span>Loading cases...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
                    {cases.map((station) => {
                        const domainName = station.domains?.name || 'General';
                        const colorClasses = DOMAIN_COLORS[domainName] || 'from-slate-500/20 to-slate-600/5 border-slate-500/30';
                        const icon = DOMAIN_ICONS[domainName] || 'stethoscope';

                        return (
                            <Link
                                key={station.id}
                                href={`/try/station/${station.id}`}
                                className={`group relative rounded-2xl border bg-gradient-to-b ${colorClasses} p-6 hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden`}
                            >
                                {/* Glow effect on hover */}
                                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

                                <div className="relative z-10">
                                    {/* Domain badge */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '18px' }}>{icon}</span>
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{domainName}</span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-lg font-bold text-white mb-3 leading-tight group-hover:text-blue-200 transition-colors">
                                        {station.title}
                                    </h3>

                                    {/* Patient info */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '16px' }}>person</span>
                                        <span className="text-sm text-slate-400">{station.patient_name}, {station.patient_age}y</span>
                                    </div>

                                    {/* Timer info */}
                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>menu_book</span>
                                            {Math.floor((station.reading_duration_seconds || 180) / 60)}min read
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>timer</span>
                                            {Math.floor((station.consultation_duration_seconds || 300) / 60)}min consult
                                        </div>
                                    </div>

                                    {/* CTA */}
                                    <div className="mt-5 flex items-center gap-2 text-blue-400 text-sm font-medium group-hover:gap-3 transition-all">
                                        Start Case
                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Bottom info */}
            <div className="mt-12 text-center">
                <p className="text-slate-500 text-sm mb-4">
                    After completing your consultation, sign up to receive your detailed AI feedback report.
                </p>
                <Link
                    href="/auth/sign-up"
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                >
                    Already have an account? Sign in →
                </Link>
            </div>
        </div>
    );
}

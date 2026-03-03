'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ClinicalLayout from '@/components/clinical-master/ClinicalLayout';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';

interface StationData {
    id: string;
    title: string;
    patient_name: string;
    candidate_instructions: string;
    reading_duration_seconds: number;
    consultation_duration_seconds: number;
    domain_name: string;
}

export default function TryReadingPhasePage() {
    const params = useParams();
    const router = useRouter();
    const stationId = params.stationId as string;

    const [station, setStation] = useState<StationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [readingComplete, setReadingComplete] = useState(false);

    useEffect(() => {
        async function fetchStation() {
            try {
                // Fetch from our public free-cases API and find the matching station
                const res = await fetch('/api/try/free-cases');
                if (!res.ok) throw new Error('Failed to fetch cases');
                const data = await res.json();

                const found = (data.stations || []).find((s: { id: string }) => s.id === stationId);
                if (!found) {
                    console.error('Station not found in free trial cases');
                    router.push('/try');
                    return;
                }

                // Now fetch full candidate_instructions using a separate query
                // We'll use the public API — the anon RLS policy allows reading free trial stations
                const detailRes = await fetch(`/api/try/station-detail?stationId=${stationId}`);
                if (detailRes.ok) {
                    const detail = await detailRes.json();
                    setStation({
                        id: found.id,
                        title: found.title,
                        patient_name: found.patient_name,
                        candidate_instructions: detail.candidate_instructions || '',
                        reading_duration_seconds: found.reading_duration_seconds || 180,
                        consultation_duration_seconds: found.consultation_duration_seconds || 300,
                        domain_name: found.domains?.name || 'Unknown',
                    });
                } else {
                    // Fallback: use what we have
                    setStation({
                        id: found.id,
                        title: found.title,
                        patient_name: found.patient_name,
                        candidate_instructions: '',
                        reading_duration_seconds: found.reading_duration_seconds || 180,
                        consultation_duration_seconds: found.consultation_duration_seconds || 300,
                        domain_name: found.domains?.name || 'Unknown',
                    });
                }
            } catch (err) {
                console.error('Error fetching station:', err);
                router.push('/try');
            } finally {
                setLoading(false);
            }
        }

        if (stationId) fetchStation();
    }, [stationId, router]);

    const handleTimerComplete = () => {
        setReadingComplete(true);
    };

    const handleStartConsultation = () => {
        const sessionId = crypto.randomUUID();
        router.push(`/try/session/${sessionId}?stationId=${stationId}`);
    };

    if (loading) {
        return (
            <ClinicalLayout showSidebar={true} showNotepad={true} candidateBrief="" stationId={stationId} sessionBasePath="/try/session">
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
            </ClinicalLayout>
        );
    }

    return (
        <ClinicalLayout
            showSidebar={true}
            showNotepad={true}
            currentStationId={stationId}
            stationTitle={station?.title || 'Station'}
            candidateBrief={station?.candidate_instructions || ''}
            stationId={stationId}
            sessionBasePath="/try/session"
        >
            {/* Header with Timer */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-[#17202b] shrink-0 z-20 relative shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                        <span className="material-symbols-outlined text-[20px]">medical_services</span>
                    </div>
                    <div>
                        <h1 className="text-base font-bold tracking-tight text-white leading-none">
                            Free Trial
                        </h1>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">{station?.title || 'Loading...'}</p>
                    </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <ConsultationTimer
                        durationSeconds={station?.reading_duration_seconds || 180}
                        label="Reading Time"
                        onComplete={handleTimerComplete}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleStartConsultation}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${readingComplete
                            ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/30 animate-pulse'
                            : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        Start Consultation
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#101922] relative overflow-hidden">
                <div className="px-8 py-4 border-b border-slate-800 bg-[#17202b]/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                        Station: Reading Material
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex justify-center">
                    {station?.candidate_instructions ? (
                        <div className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl min-h-[800px] relative">
                            <div className="p-12 md:p-16">
                                <h3 className="text-xl font-bold uppercase tracking-wide mb-8 border-b-2 border-slate-900 pb-2 inline-block">
                                    Materials for Candidate
                                </h3>

                                <div className="space-y-1 mb-8 font-medium text-base">
                                    <div className="flex gap-2">
                                        <span className="font-bold w-20">Name:</span>
                                        <span>{station.patient_name}</span>
                                    </div>
                                </div>

                                <div className="space-y-4 text-base leading-relaxed">
                                    {station.candidate_instructions.split('\n').map((line, index) => (
                                        <p key={index} className={line.includes(':') && line.match(/^[A-Z]/) ? 'font-semibold mt-4' : ''}>
                                            {line}
                                        </p>
                                    ))}

                                    <div className="pt-8 border-t border-slate-300">
                                        <p className="font-bold italic text-slate-600">End of notes</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-slate-400">No candidate brief available for this station.</p>
                        </div>
                    )}
                </div>
            </div>
        </ClinicalLayout>
    );
}

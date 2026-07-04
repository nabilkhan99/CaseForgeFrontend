'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Stage {
    name: string;
    subtitle: string;
    dotColor: string;
    bgColor: string;
    borderColor: string;
    barColor: string;
    tips: string[];
    startSecond: number;
    endSecond: number;
}

const STAGES: Stage[] = [
    {
        name: 'Golden Minute',
        subtitle: 'Initial Introduction',
        dotColor: 'bg-amber-500',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        barColor: 'bg-amber-400',
        tips: ['Introduce yourself', 'Ask an open question — "How can I help you today?"', 'Listen — don\'t interrupt', 'Catch early cues'],
        startSecond: 0,
        endSecond: 60,
    },
    {
        name: 'Data Gathering',
        subtitle: 'History, ICE & Diagnosis',
        dotColor: 'bg-blue-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        barColor: 'bg-blue-400',
        tips: ['Open questions first — follow their story', 'Explore ICE and psychosocial impact', 'Pick up and explore cues', 'Test differentials with closed questions', 'Ask red flag questions', 'Reach a working diagnosis'],
        startSecond: 60,
        endSecond: 360,
    },
    {
        name: 'Clinical Management',
        subtitle: 'Diagnosis, Plan & Decisions',
        dotColor: 'bg-emerald-500',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        barColor: 'bg-emerald-400',
        tips: ['Verbalise your diagnosis clearly', 'Offer a safe, evidence-based plan', 'Link options back to their ICE and context', 'Share risks and benefits in plain language', 'Consider co-morbidities and polypharmacy', 'Guide them to a decision — don\'t just hand them a menu'],
        startSecond: 360,
        endSecond: 660,
    },
    {
        name: 'Safety Net',
        subtitle: 'Follow-up & Close',
        dotColor: 'bg-red-500',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        barColor: 'bg-red-400',
        tips: ['What specific symptoms should they watch for?', 'What should they do and who to contact — 111 / A&E / 999', 'When should they return — not "if you\'re worried"', 'Have they understood?', 'Summarise and close'],
        startSecond: 660,
        endSecond: 720,
    },
];

interface CaseTimerProps {
    totalSeconds?: number;
}

export default function CaseTimer({ totalSeconds = 720 }: CaseTimerProps) {
    const [elapsed, setElapsed] = useState(0);
    const [running, setRunning] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const remaining = Math.max(0, totalSeconds - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    const currentStageIndex = STAGES.findIndex(
        s => elapsed >= s.startSecond && elapsed < s.endSecond
    );
    const activeStage = currentStageIndex >= 0 ? currentStageIndex : elapsed >= totalSeconds ? STAGES.length - 1 : 0;

    const start = useCallback(() => setRunning(true), []);
    const pause = useCallback(() => setRunning(false), []);
    const reset = useCallback(() => {
        setRunning(false);
        setElapsed(0);
    }, []);

    useEffect(() => {
        if (running && elapsed < totalSeconds) {
            intervalRef.current = setInterval(() => {
                setElapsed(prev => {
                    if (prev >= totalSeconds - 1) {
                        setRunning(false);
                        return totalSeconds;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [running, totalSeconds, elapsed]);

    return (
        <>
            {/* Desktop timer (inside Container card) */}
            <div className="hidden lg:flex flex-col">
                {/* Timer Display */}
                <div className="px-6 pt-6 pb-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted font-semibold mb-2">
                        Station Timer
                    </p>
                    <div className="text-5xl font-black text-heading tracking-tight tabular-nums font-mono">
                        {String(minutes).padStart(2, '0')}
                        <span className={`${running ? 'animate-pulse' : ''} text-muted/40`}>:</span>
                        {String(seconds).padStart(2, '0')}
                    </div>
                </div>

                {/* Progress Timeline */}
                <div className="px-6 py-4">
                    <div className="relative">
                        {STAGES.map((stage, i) => {
                            const isCompleted = elapsed >= stage.endSecond;
                            const isPending = i > activeStage || (!running && !isCompleted);
                            const isCurrent = i === activeStage;

                            return (
                                <div key={stage.name} className="relative flex gap-4 pb-5 last:pb-0">
                                    {/* Vertical line + circle */}
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`relative z-10 w-3 h-3 rounded-full border-2 transition-all duration-500 flex-shrink-0 ${isCompleted || isCurrent
                                                    ? `${stage.dotColor} border-transparent`
                                                    : 'bg-transparent border-black/[0.1]'
                                                }`}
                                        />
                                        {i < STAGES.length - 1 && (
                                            <div className="relative w-0.5 flex-1 min-h-[20px] bg-black/[0.06] mt-1">
                                                <div
                                                    className={`absolute top-0 left-0 w-full transition-all duration-1000 rounded-full ${isCompleted || (isCurrent && running) ? stage.barColor : ''}`}
                                                    style={
                                                        isCurrent && running
                                                            ? {
                                                                height: `${Math.min(100, ((elapsed - stage.startSecond) / (stage.endSecond - stage.startSecond)) * 100)}%`,
                                                            }
                                                            : isCompleted
                                                                ? { height: '100%' }
                                                                : { height: '0%' }
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className={`flex-1 -mt-0.5 transition-all duration-300 ${isPending && !isCurrent ? 'opacity-30' : 'opacity-100'}`}>
                                        <h4 className={`text-xs font-semibold ${isCurrent ? 'text-heading' : isCompleted ? 'text-body' : 'text-muted'}`}>
                                            {stage.name}
                                        </h4>
                                        <p className="text-[10px] text-muted mb-1">
                                            {stage.subtitle}
                                        </p>

                                        {isCurrent && (
                                            <div className={`mt-2 p-2.5 rounded-lg ${stage.bgColor} border ${stage.borderColor} transition-all duration-500`}>
                                                {stage.tips.map(tip => (
                                                    <p key={tip} className="text-[10px] text-body leading-relaxed flex items-start gap-1.5 mb-0.5 last:mb-0">
                                                        <span className="text-muted mt-0.5">&#8226;</span>
                                                        {tip}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Controls */}
                <div className="px-4 pb-5 mt-auto space-y-2">
                    {!running ? (
                        <button
                            onClick={start}
                            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            style={{ background: 'linear-gradient(135deg, #B45309, #D97706)', color: '#fff', boxShadow: '0 2px 8px rgba(180,83,9,0.2)' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            {elapsed > 0 ? 'Resume Station' : 'Start Timer'}
                        </button>
                    ) : (
                        <button
                            onClick={pause}
                            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            style={{ background: '#D97706', color: '#fff' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                            Pause Timer
                        </button>
                    )}
                    <button
                        onClick={reset}
                        className="w-full py-2 rounded-xl text-muted hover:text-body hover:bg-black/[0.02] text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        Reset Timer
                    </button>
                </div>
            </div>

            {/* Mobile timer bar -- fixed at bottom */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-raised/95 backdrop-blur-xl border-t border-black/[0.06] px-4 py-3 flex items-center justify-between gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                <div className="flex items-center gap-3">
                    <div className="text-2xl font-black text-heading tabular-nums font-mono">
                        {String(minutes).padStart(2, '0')}
                        <span className={`${running ? 'animate-pulse' : ''} text-muted/40`}>:</span>
                        {String(seconds).padStart(2, '0')}
                    </div>
                    {STAGES[activeStage] && (
                        <span className="text-[11px] text-muted font-medium">
                            {STAGES[activeStage].name}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {!running ? (
                        <button
                            onClick={start}
                            className="px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-[0.98]"
                            style={{ background: 'linear-gradient(135deg, #B45309, #D97706)', color: '#fff' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            {elapsed > 0 ? 'Resume' : 'Start'}
                        </button>
                    ) : (
                        <button
                            onClick={pause}
                            className="px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-[0.98]"
                            style={{ background: '#D97706', color: '#fff' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                            Pause
                        </button>
                    )}
                    <button
                        onClick={reset}
                        className="px-3 py-2.5 min-h-[44px] rounded-xl text-muted hover:bg-black/[0.03] flex items-center"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
}

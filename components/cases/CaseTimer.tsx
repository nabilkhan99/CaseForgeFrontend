'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Stage {
    name: string;
    subtitle: string;
    color: string;
    bgColor: string;
    borderColor: string;
    tips: string[];
    startSecond: number;
    endSecond: number;
}

const STAGES: Stage[] = [
    {
        name: 'Golden Minute',
        subtitle: 'Initial Introduction',
        color: 'bg-amber-400',
        bgColor: 'bg-amber-500/5',
        borderColor: 'border-amber-500/15',
        tips: ['Introduce yourself', 'Establish rapport', 'Set the agenda'],
        startSecond: 0,
        endSecond: 60,
    },
    {
        name: 'Data Gathering',
        subtitle: 'History & ICE',
        color: 'bg-blue-400',
        bgColor: 'bg-blue-500/5',
        borderColor: 'border-blue-500/15',
        tips: ['Discover ICE', 'Discover psycho-social context', 'Ask open and closed questions', 'Rule out Red Flags', 'Use a summary'],
        startSecond: 60,
        endSecond: 300,
    },
    {
        name: 'Clinical Management',
        subtitle: 'Diagnosis & Plan',
        color: 'bg-emerald-400',
        bgColor: 'bg-emerald-500/5',
        borderColor: 'border-emerald-500/15',
        tips: ['Share your working diagnosis', 'Explain management plan', 'Shared decision making'],
        startSecond: 300,
        endSecond: 480,
    },
    {
        name: 'Safety Net',
        subtitle: 'Follow-up & End',
        color: 'bg-red-400',
        bgColor: 'bg-red-500/5',
        borderColor: 'border-red-500/15',
        tips: ['Safety-net advice', 'Follow-up plan', 'Check understanding'],
        startSecond: 480,
        endSecond: 600,
    },
];

interface CaseTimerProps {
    totalSeconds?: number;
}

export default function CaseTimer({ totalSeconds = 600 }: CaseTimerProps) {
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
            {/* Desktop sidebar */}
            <div className="hidden md:flex w-[240px] flex-shrink-0 bg-[#0c0c0f] border-r border-zinc-800 flex-col h-full">
                {/* Timer Display */}
                <div className="px-6 pt-8 pb-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-semibold mb-2">
                        Station Timer
                    </p>
                    <div className="text-5xl font-black text-white tracking-tight tabular-nums font-mono">
                        {String(minutes).padStart(2, '0')}
                        <span className={`${running ? 'animate-pulse' : ''} text-zinc-700`}>:</span>
                        {String(seconds).padStart(2, '0')}
                    </div>
                </div>

                {/* Progress Timeline */}
                <div className="flex-1 px-6 py-4 overflow-y-auto no-scrollbar">
                    <div className="relative">
                        {STAGES.map((stage, i) => {
                            const isActive = i === activeStage && running;
                            const isCompleted = elapsed >= stage.endSecond;
                            const isPending = i > activeStage || (!running && !isCompleted);
                            const isCurrent = i === activeStage;

                            return (
                                <div key={stage.name} className="relative flex gap-4 pb-6 last:pb-0">
                                    {/* Vertical line + circle */}
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`relative z-10 w-3 h-3 rounded-full border-2 transition-all duration-500 flex-shrink-0 ${isCompleted
                                                    ? `${stage.color} border-transparent`
                                                    : isActive || isCurrent
                                                        ? `${stage.color} border-transparent`
                                                        : 'bg-transparent border-zinc-700'
                                                }`}
                                        />
                                        {i < STAGES.length - 1 && (
                                            <div className="relative w-0.5 flex-1 min-h-[20px] bg-zinc-800 mt-1">
                                                <div
                                                    className={`absolute top-0 left-0 w-full transition-all duration-1000 rounded-full ${isCompleted
                                                            ? `${stage.color} h-full`
                                                            : isCurrent && running
                                                                ? `${stage.color}`
                                                                : 'h-0'
                                                        }`}
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
                                        <h4 className={`text-xs font-semibold ${isCurrent ? 'text-white' : isCompleted ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                            {stage.name}
                                        </h4>
                                        <p className="text-[10px] text-zinc-600 mb-1">
                                            {stage.subtitle}
                                        </p>

                                        {isCurrent && (
                                            <div className={`mt-2 p-2.5 rounded-lg ${stage.bgColor} border ${stage.borderColor} transition-all duration-500`}>
                                                {stage.tips.map(tip => (
                                                    <p key={tip} className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-1.5 mb-0.5 last:mb-0">
                                                        <span className="text-zinc-600 mt-0.5">•</span>
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
                <div className="px-4 pb-6 mt-auto space-y-2">
                    {!running ? (
                        <button
                            onClick={start}
                            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all active:scale-[0.98]"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>play_arrow</span>
                            {elapsed > 0 ? 'Resume Station' : 'Start Station'}
                        </button>
                    ) : (
                        <button
                            onClick={pause}
                            className="w-full py-3 rounded-xl bg-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-amber-500 transition-all active:scale-[0.98]"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>pause</span>
                            Pause Timer
                        </button>
                    )}
                    <button
                        onClick={reset}
                        className="w-full py-2 rounded-xl text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>refresh</span>
                        Reset Timer
                    </button>
                </div>
            </div>

            {/* Mobile timer bar — fixed at bottom */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0f] border-t border-zinc-800 px-4 py-3 flex items-center justify-between gap-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                <div className="flex items-center gap-3">
                    <div className="text-2xl font-black text-white tabular-nums font-mono">
                        {String(minutes).padStart(2, '0')}
                        <span className={`${running ? 'animate-pulse' : ''} text-zinc-700`}>:</span>
                        {String(seconds).padStart(2, '0')}
                    </div>
                    {STAGES[activeStage] && (
                        <span className="text-[10px] text-zinc-500 font-medium">
                            {STAGES[activeStage].name}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    {!running ? (
                        <button
                            onClick={start}
                            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 active:scale-[0.98]"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>play_arrow</span>
                            {elapsed > 0 ? 'Resume' : 'Start'}
                        </button>
                    ) : (
                        <button
                            onClick={pause}
                            className="px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 active:scale-[0.98]"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>pause</span>
                            Pause
                        </button>
                    )}
                    <button
                        onClick={reset}
                        className="px-3 py-2.5 min-h-[44px] rounded-xl text-zinc-500 hover:bg-zinc-800/50 flex items-center"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>refresh</span>
                    </button>
                </div>
            </div>
        </>
    );
}

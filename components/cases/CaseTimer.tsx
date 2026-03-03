'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Stage {
    name: string;
    subtitle: string;
    color: string;
    bgColor: string;
    borderColor: string;
    glowColor: string;
    tips: string[];
    startSecond: number;
    endSecond: number;
}

const STAGES: Stage[] = [
    {
        name: 'Golden Minute',
        subtitle: 'Initial Introduction',
        color: 'bg-amber-400',
        bgColor: 'bg-amber-400/10',
        borderColor: 'border-amber-400/30',
        glowColor: 'shadow-amber-400/40',
        tips: ['Introduce yourself', 'Establish rapport', 'Set the agenda'],
        startSecond: 0,
        endSecond: 60,
    },
    {
        name: 'Data Gathering',
        subtitle: 'History & ICE',
        color: 'bg-blue-400',
        bgColor: 'bg-blue-400/10',
        borderColor: 'border-blue-400/30',
        glowColor: 'shadow-blue-400/40',
        tips: ['Discover ICE', 'Discover psycho-social context', 'Ask open and closed questions', 'Rule out Red Flags', 'Use a summary'],
        startSecond: 60,
        endSecond: 300,
    },
    {
        name: 'Clinical Management',
        subtitle: 'Diagnosis & Plan',
        color: 'bg-emerald-400',
        bgColor: 'bg-emerald-400/10',
        borderColor: 'border-emerald-400/30',
        glowColor: 'shadow-emerald-400/40',
        tips: ['Share your working diagnosis', 'Explain management plan', 'Shared decision making'],
        startSecond: 300,
        endSecond: 480,
    },
    {
        name: 'Safety Net',
        subtitle: 'Follow-up & End',
        color: 'bg-red-400',
        bgColor: 'bg-red-400/10',
        borderColor: 'border-red-400/30',
        glowColor: 'shadow-red-400/40',
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
        <div className="w-[240px] flex-shrink-0 bg-[#0B0F1A] border-r border-white/5 flex flex-col h-full">
            {/* Timer Display */}
            <div className="px-6 pt-8 pb-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-2">
                    Station Timer
                </p>
                <div className="text-5xl font-black text-white tracking-tight tabular-nums font-mono">
                    {String(minutes).padStart(2, '0')}
                    <span className="text-white/40">:</span>
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
                                    {/* Circle */}
                                    <div
                                        className={`relative z-10 w-4 h-4 rounded-full border-2 transition-all duration-500 flex-shrink-0 ${isCompleted
                                                ? `${stage.color} border-transparent shadow-md ${stage.glowColor}`
                                                : isActive || isCurrent
                                                    ? `${stage.color} border-transparent shadow-lg ${stage.glowColor} animate-pulse`
                                                    : 'bg-transparent border-gray-700'
                                            }`}
                                    />
                                    {/* Connecting line */}
                                    {i < STAGES.length - 1 && (
                                        <div className="relative w-0.5 flex-1 min-h-[20px] bg-gray-800 mt-1">
                                            {/* Fill progress */}
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
                                <div className={`flex-1 -mt-0.5 transition-all duration-300 ${isPending && !isCurrent ? 'opacity-40' : 'opacity-100'}`}>
                                    <h4 className={`text-sm font-bold ${isCurrent ? 'text-white' : isCompleted ? 'text-gray-300' : 'text-gray-500'}`}>
                                        {stage.name}
                                    </h4>
                                    <p className="text-[11px] text-gray-500 mb-1">
                                        {stage.subtitle}
                                    </p>

                                    {/* Expanded tips for current stage */}
                                    {isCurrent && (
                                        <div className={`mt-2 p-3 rounded-xl ${stage.bgColor} border ${stage.borderColor} transition-all duration-500`}>
                                            {stage.tips.map(tip => (
                                                <p key={tip} className="text-[11px] text-gray-300 leading-relaxed flex items-start gap-1.5 mb-1 last:mb-0">
                                                    <span className="text-gray-500 mt-0.5">•</span>
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
            <div className="px-4 pb-6 mt-auto">
                {!running ? (
                    <button
                        onClick={elapsed > 0 ? start : start}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all active:scale-[0.98]"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_arrow</span>
                        {elapsed > 0 ? 'Resume Station' : 'Start Station'}
                    </button>
                ) : (
                    <button
                        onClick={pause}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all active:scale-[0.98]"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>pause</span>
                        Pause Timer
                    </button>
                )}
                <button
                    onClick={reset}
                    className="w-full mt-2 py-2.5 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>refresh</span>
                    Reset Timer
                </button>
            </div>
        </div>
    );
}

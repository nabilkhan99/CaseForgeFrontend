'use client';

import { useState, useEffect } from 'react';

interface ConsultationTimerProps {
  durationSeconds: number;
  onComplete?: () => void;
  label?: string;
  autoStart?: boolean;
}

export default function ConsultationTimer({
  durationSeconds,
  onComplete,
  label = 'Reading Time',
  autoStart = true,
}: ConsultationTimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning) return;

    if (timeLeft <= 0) {
      onComplete?.();
      setIsRunning(false);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, timeLeft, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const toggleTimer = () => setIsRunning(!isRunning);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
        <span className="material-symbols-outlined text-primary text-[20px] animate-pulse">
          timer
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold font-mono text-slate-900 dark:text-white tabular-nums tracking-tight">
            {formattedTime}
          </span>
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            {label}
          </span>
        </div>
      </div>
      <button
        onClick={toggleTimer}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm font-medium border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
      >
        <span className="material-symbols-outlined text-[18px]">
          {isRunning ? 'pause' : 'play_arrow'}
        </span>
        <span>{isRunning ? 'Pause' : 'Resume'}</span>
      </button>
    </div>
  );
}

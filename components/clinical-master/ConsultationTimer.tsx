'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { deadlineFrom, remainingSeconds, formatCountdown } from '@/lib/clinical-master/countdown';

interface ConsultationTimerProps {
  durationSeconds: number;
  onComplete?: () => void;
  autoStart?: boolean;
  label?: string;
  className?: string;
}

export default function ConsultationTimer({
  durationSeconds,
  onComplete,
  autoStart = false,
  label,
  className = '',
}: ConsultationTimerProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const hasFiredRef = useRef(false);
  // Absolute end time, not a tick counter: a phone that locks its screen or a
  // backgrounded tab stops ticking, and the clock must still be right when it
  // comes back. See lib/clinical-master/countdown.ts.
  const deadlineRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleComplete = useCallback(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!isRunning) return;

    if (deadlineRef.current === null) {
      deadlineRef.current = deadlineFrom(Date.now(), durationSeconds);
    }

    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const left = remainingSeconds(deadline, Date.now());
      setTimeLeft(left);
      if (left <= 0) handleComplete();
    };

    tick();
    // Twice a second: a throttled tab may miss ticks, and the display should
    // re-sync promptly rather than at the next whole second when it wakes.
    intervalRef.current = setInterval(tick, 500);
    // Coming back from the lock screen or another app is the case that used to
    // drift the most, so recompute the moment the page is visible again.
    document.addEventListener('visibilitychange', tick);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isRunning, durationSeconds, handleComplete]);

  useEffect(() => {
    if (autoStart && !isRunning && !hasFiredRef.current) {
      setIsRunning(true);
    }
  }, [autoStart, isRunning]);

  const timeString = formatCountdown(timeLeft);

  // Warning states
  const isLow = timeLeft <= 120 && timeLeft > 30;
  const isCritical = timeLeft <= 30;

  const colorClass = isCritical
    ? 'text-danger'
    : isLow
    ? 'text-primary'
    : 'text-heading';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-[12px] text-muted">{label}</span>}
      <span
        className={`font-mono text-[18px] md:text-[16px] font-semibold tabular-nums ${colorClass}`}
        role="timer"
        aria-live="off"
        aria-label={label ? `${label}: ${timeString} remaining` : `${timeString} remaining`}
      >
        {timeString}
      </span>
    </div>
  );
}

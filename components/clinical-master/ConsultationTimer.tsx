'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleComplete = useCallback(() => {
    if (hasFiredRef.current) return;
    hasFiredRef.current = true;
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, handleComplete]);

  useEffect(() => {
    if (autoStart && !isRunning && !hasFiredRef.current) {
      setIsRunning(true);
    }
  }, [autoStart, isRunning]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

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
      <span className={`font-mono text-[18px] md:text-[16px] font-semibold tabular-nums ${colorClass}`}>
        {timeString}
      </span>
    </div>
  );
}

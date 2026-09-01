'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  deadlineFrom,
  remainingSeconds,
  remainingFraction,
  formatCountdown,
} from '@/lib/clinical-master/countdown';

interface ConsultationTimerProps {
  durationSeconds: number;
  onComplete?: () => void;
  autoStart?: boolean;
  label?: string;
  className?: string;
  /**
   * Draw the countdown as a ring around `children` with the digits underneath,
   * instead of as an inline label. Opt-in: the reading clocks on the station
   * pages keep the inline rendering.
   */
  ring?: boolean;
  /** Outer diameter of the ring in px. Ignored unless `ring` is set. */
  ringSize?: number;
  /** Ring thickness in px. */
  ringThickness?: number;
  /** Rendered in the middle of the ring — on the session pages, the orb. */
  children?: ReactNode;
}

/**
 * The one clock a consultation has.
 *
 * Two presentations, deliberately not two components. The hook already runs an
 * authoritative fire-once `setTimeout` for the consultation but never ticks, so
 * the only thing on the page that knows how much time is left is this — and a
 * ring drawn from a second `setInterval` somewhere else would be a second clock
 * that could disagree with this one on a throttled tab. The ring is therefore
 * drawn from the same `timeLeft` state, and the caller's content is passed
 * through as `children` so it sits inside the ring without being re-rendered by
 * it: an element handed down as a prop is not rebuilt when this component's own
 * state changes, so the orb inside the ring pays nothing for the tick.
 */
export default function ConsultationTimer({
  durationSeconds,
  onComplete,
  autoStart = false,
  label,
  className = '',
  ring = false,
  ringSize = 252,
  ringThickness = 4,
  children,
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

  const ariaLabel = label ? `${label}: ${timeString} remaining` : `${timeString} remaining`;

  if (ring) {
    // Every station in the library is 720 seconds, so this is drawn around a
    // 12:00 total in practice. (Worth knowing if the numbers ever look odd:
    // both session pages fall back to 720 when the station row has no
    // duration, but the token routes fall back to 480. Harmless while every
    // row is populated, wrong the day one is not.)
    const centre = ringSize / 2;
    const radius = Math.max(1, centre - ringThickness / 2 - 1);
    const circumference = 2 * Math.PI * radius;
    const fraction = remainingFraction(timeLeft, durationSeconds);

    const strokeColour = isCritical ? '#DC2626' : isLow ? '#B45309' : 'rgba(180,83,9,0.55)';

    return (
      <div className={`flex flex-col items-center gap-4 ${className}`}>
        <div
          className="relative flex items-center justify-center"
          style={{ width: ringSize, height: ringSize, maxWidth: '100%' }}
        >
          <svg
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="absolute inset-0 h-full w-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={centre}
              cy={centre}
              r={radius}
              fill="none"
              stroke="rgba(180,83,9,0.1)"
              strokeWidth={ringThickness}
            />
            <circle
              cx={centre}
              cy={centre}
              r={radius}
              fill="none"
              stroke={strokeColour}
              strokeWidth={ringThickness}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - fraction)}
              // The state behind this only moves twice a second; a linear
              // transition of exactly that length turns the steps into a
              // continuous sweep without ever running ahead of the clock. Kept
              // as utilities rather than an inline `style` so that
              // `motion-reduce:` can actually win — an inline declaration would
              // outrank the class and the tween would survive the preference.
              className="transition-[stroke-dashoffset,stroke] duration-500 ease-linear motion-reduce:transition-none"
            />
          </svg>
          {children}
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span
            className={`font-mono text-[26px] font-semibold tabular-nums leading-none ${colorClass}`}
            role="timer"
            aria-live="off"
            aria-label={ariaLabel}
          >
            {timeString}
          </span>
          <span className="text-[12px] text-muted">{label ?? 'remaining'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-[13px] text-muted">{label}</span>}
      <span
        className={`font-mono text-[18px] md:text-[15px] font-semibold tabular-nums ${colorClass}`}
        role="timer"
        aria-live="off"
        aria-label={ariaLabel}
      >
        {timeString}
      </span>
    </div>
  );
}

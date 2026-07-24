'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Playback for a consultation recording, shown with the feedback report.
 *
 * Renders nothing at all unless the session actually has audio — sessions from
 * before browser-side recording existed (anything before 25 July 2026, plus
 * the 3 June–25 July gap when no audio was captured) simply have no player.
 *
 * The bucket is private, so the source is a short-lived signed URL fetched
 * from /api/clinical-master/recording/[sessionId], which enforces access.
 */

interface RecordingPlayerProps {
  sessionId: string;
}

/** m:ss, or —:— while the duration is still unknown. */
function fmtTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—:—';
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function RecordingPlayer({ sessionId }: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUrl() {
      try {
        const res = await fetch(`/api/clinical-master/recording/${sessionId}`);
        if (cancelled) return;
        if (!res.ok) {
          setUnavailable(true);
          return;
        }
        const data = await res.json();
        if (typeof data.url === 'string') setUrl(data.url);
        else setUnavailable(true);
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    }

    void loadUrl();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (unavailable || !url) return null;

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setUnavailable(true));
    } else {
      audio.pause();
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio || duration === null) return;
    audio.currentTime = value;
    setElapsed(value);
  };

  return (
    <motion.section
      className="mt-5 rounded-[18px] border border-black/[0.06] bg-surface-raised px-5 py-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 70, damping: 20 }}
      aria-label="Consultation recording"
    >
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-heading">Listen back</h2>
        <p className="text-[12px] text-muted">Your consultation, as the marker heard it</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause recording' : 'Play recording'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:opacity-90"
        >
          {playing ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
            </svg>
          )}
        </button>

        <input
          type="range"
          min={0}
          max={duration ?? 0}
          step={1}
          value={elapsed}
          onChange={(event) => seek(Number(event.target.value))}
          disabled={duration === null}
          aria-label="Seek within the recording"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-primary disabled:cursor-default"
        />

        <p className="shrink-0 font-mono text-[12px] tabular-nums text-muted">
          {fmtTime(elapsed)} / {fmtTime(duration)}
        </p>
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          // Streamed containers can report Infinity until fully buffered.
          setDuration(Number.isFinite(value) ? value : null);
        }}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setElapsed(0);
        }}
        onError={() => setUnavailable(true)}
      />
    </motion.section>
  );
}

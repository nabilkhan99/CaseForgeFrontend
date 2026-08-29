'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import type { LecturesResponse, LectureSummary } from '@/app/api/lectures/route';
import { createClient } from '@/lib/supabase/client';
import {
  getLectureProgressEntry,
  saveLectureProgress,
} from '@/lib/supabase/queries/lectureProgress';
import { resumeTarget } from '@/lib/lectures/progress';

/**
 * One lecture, played from a signed URL fetched on mount.
 *
 * Native <video> on purpose — scrubbing, speed, fullscreen and captions all
 * come free, and no player library is worth the bundle for a plain talking
 * head. `preload="metadata"` so opening the page doesn't pull the whole file.
 *
 * The URL is short-lived and minted per view; it is never persisted anywhere,
 * so leaving the page and coming back re-signs rather than reusing.
 *
 * It is also short-lived enough to die mid-watch — a lecture longer than the
 * TTL, or a pause over lunch — and Storage answers the next range request with
 * a 400, which a bare <video> shows as nothing at all. So `onError` drops the
 * URL and offers a re-sign rather than leaving a dead player on screen.
 *
 * PROGRESS. The furthest position reached is written to `lecture_progress` so
 * the course list can tick a lecture off and offer to resume it. Everything
 * about that is deliberately subordinate to playback: the write is throttled,
 * fire-and-forget, and every failure is swallowed — a dropped progress row
 * costs a tick, an interrupted lecture costs the lesson. Signed-out viewers
 * (there is no /try lecture flow today, but the page does not assume it) write
 * nothing at all.
 */

/** Furthest position is written at most this often while playing. */
const PROGRESS_WRITE_INTERVAL_MS = 10_000;

export default function LecturePlayerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [url, setUrl] = useState<string | null>(null);
  const [lecture, setLecture] = useState<LectureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [resigning, setResigning] = useState(false);
  /** Flips once we know whether there is a user and what they had watched. */
  const [progressReady, setProgressReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userIdRef = useRef<string | null>(null);
  /** Furthest position already in the database. Never decreases. */
  const storedRef = useRef(0);
  /** Furthest position reached in THIS visit. Survives a mid-watch re-sign. */
  const furthestRef = useRef(0);
  const lastSavedRef = useRef(0);
  const lastWriteAtRef = useRef(0);
  const progressReadyRef = useRef(false);
  const resumeAppliedRef = useRef(false);

  /**
   * Mint (or re-mint) a playback URL. Returns the outcome rather than setting
   * state, so a caller that has been unmounted can drop it on the floor.
   */
  const signPlayback = useCallback(async (): Promise<{
    url: string | null;
    error: string | null;
  }> => {
    const res = await fetch(`/api/lectures/${id}/play`, { cache: 'no-store' });
    if (!res.ok) {
      return {
        url: null,
        error:
          res.status === 404
            ? "This lecture isn't available on your plan."
            : 'Could not start playback. Try again in a moment.',
      };
    }
    const data: { url?: string } = await res.json();
    return { url: data.url ?? null, error: null };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        // The list is the only place the title lives; a failure there is
        // cosmetic, so it must not block playback.
        const [play, listRes] = await Promise.all([
          signPlayback(),
          fetch('/api/lectures', { cache: 'no-store' }),
        ]);

        if (listRes.ok) {
          const list: LecturesResponse = await listRes.json();
          const match = (list.lectures ?? []).find((l) => l.id === id) ?? null;
          if (!cancelled) setLecture(match);
        }
        if (cancelled) return;
        setUrl(play.url);
        setError(play.error);
      } catch {
        if (!cancelled) setError('Could not start playback. Try again in a moment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, signPlayback]);

  // Runs alongside the signing above rather than after it: the seek can only
  // happen once BOTH this and the video's metadata have landed, and making it
  // wait for playback to be ready would make the resume visibly late.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadProgress() {
      try {
        const { data } = await createClient().auth.getUser();
        const userId = data.user?.id ?? null;
        if (cancelled) return;
        userIdRef.current = userId;
        if (userId) {
          const entry = await getLectureProgressEntry(userId, id);
          if (cancelled) return;
          storedRef.current = entry?.secondsWatched ?? 0;
          lastSavedRef.current = storedRef.current;
        }
      } catch {
        // No progress is a fine state to play a lecture in.
      } finally {
        if (!cancelled) {
          progressReadyRef.current = true;
          setProgressReady(true);
        }
      }
    }

    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const persistProgress = useCallback(() => {
    const userId = userIdRef.current;
    if (!userId || !id) return;
    const seconds = Math.floor(Math.max(storedRef.current, furthestRef.current));
    if (seconds <= 0 || seconds <= lastSavedRef.current) return;
    lastSavedRef.current = seconds;
    lastWriteAtRef.current = Date.now();
    storedRef.current = seconds;
    saveLectureProgress(userId, id, seconds).catch(() => {
      // Losing a tick is not worth interrupting a lecture over; the next
      // write covers the same ground because `seconds` only ever grows.
    });
  }, [id]);

  /**
   * Seek to where they left off, once we know both where that is and how long
   * the lecture runs. Fires from two directions because either can win the
   * race — the progress read, or the video's own metadata.
   */
  const applyResume = useCallback(() => {
    const video = videoRef.current;
    if (!video || !progressReadyRef.current || resumeAppliedRef.current) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    resumeAppliedRef.current = true;
    const target = resumeTarget(storedRef.current, furthestRef.current, video.duration);
    if (target !== null) video.currentTime = target;
  }, []);

  // A new signed URL means a fresh element with a fresh timeline to place them
  // on, so the seek is owed again.
  useEffect(() => {
    resumeAppliedRef.current = false;
  }, [url]);

  useEffect(() => {
    if (progressReady) applyResume();
  }, [progressReady, url, applyResume]);

  // Backgrounding a tab is the commonest way a lecture ends — no pause event,
  // no unmount, just a phone going into a pocket. The cleanup covers leaving
  // the page by any route.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') persistProgress();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      persistProgress();
    };
  }, [persistProgress]);

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    // Max, not assignment: scrubbing back to re-hear something must not undo
    // the fact that they have already been past it.
    furthestRef.current = Math.max(furthestRef.current, video.currentTime);
    if (Date.now() - lastWriteAtRef.current < PROGRESS_WRITE_INTERVAL_MS) return;
    persistProgress();
  }

  async function retryPlayback() {
    setResigning(true);
    setError(null);
    try {
      const play = await signPlayback();
      setUrl(play.url);
      setError(play.error);
      if (play.url) setExpired(false);
    } catch {
      setError('Could not start playback. Try again in a moment.');
    } finally {
      setResigning(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={lecture?.title ?? 'Lecture'}
        subtitle={lecture?.description ?? undefined}
        breadcrumbs={[{ label: 'Lectures', href: '/dashboard/lectures' }]}
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      ) : expired && !error ? (
        <div className="border-l-2 border-primary pl-4 py-2 text-[13px] text-heading">
          Playback link expired &mdash;{' '}
          <button
            onClick={retryPlayback}
            disabled={resigning}
            className="text-primary font-medium hover:underline disabled:opacity-40"
          >
            {resigning ? 'reloading…' : 'reload to continue'}
          </button>
        </div>
      ) : error || !url ? (
        <div className="border-l-2 border-danger pl-4 py-2 text-[13px] text-danger">
          {error ?? 'Could not start playback.'}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="rounded-[16px] overflow-hidden bg-black shadow-elevation-2"
        >
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            src={url}
            onLoadedMetadata={applyResume}
            onTimeUpdate={handleTimeUpdate}
            onPause={persistProgress}
            onEnded={persistProgress}
            onError={() => {
              // Almost always the signed URL aging out mid-watch; a genuinely
              // broken file re-signs once and fails again, which reads the same
              // to the user as "try reloading".
              setUrl(null);
              setExpired(true);
            }}
            className="w-full aspect-video bg-black"
          >
            <track kind="captions" />
          </video>
        </motion.div>
      )}
    </div>
  );
}

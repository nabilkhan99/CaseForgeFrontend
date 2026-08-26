'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import type { LecturesResponse, LectureSummary } from '@/app/api/lectures/route';

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
 */

export default function LecturePlayerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [url, setUrl] = useState<string | null>(null);
  const [lecture, setLecture] = useState<LectureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [resigning, setResigning] = useState(false);

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
          className="rounded-[20px] overflow-hidden bg-black"
          style={{ boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)' }}
        >
          <video
            controls
            playsInline
            preload="metadata"
            src={url}
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

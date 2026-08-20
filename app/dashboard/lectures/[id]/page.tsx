'use client';

import { useEffect, useState } from 'react';
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
 */

export default function LecturePlayerPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const [url, setUrl] = useState<string | null>(null);
  const [lecture, setLecture] = useState<LectureSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        // The list is the only place the title lives; a failure there is
        // cosmetic, so it must not block playback.
        const [playRes, listRes] = await Promise.all([
          fetch(`/api/lectures/${id}/play`, { cache: 'no-store' }),
          fetch('/api/lectures', { cache: 'no-store' }),
        ]);

        if (listRes.ok) {
          const list: LecturesResponse = await listRes.json();
          const match = (list.lectures ?? []).find((l) => l.id === id) ?? null;
          if (!cancelled) setLecture(match);
        }

        if (!playRes.ok) {
          if (!cancelled) {
            setError(
              playRes.status === 404
                ? "This lecture isn't available on your plan."
                : 'Could not start playback. Try again in a moment.',
            );
          }
          return;
        }

        const data: { url?: string } = await playRes.json();
        if (!cancelled) setUrl(data.url ?? null);
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
  }, [id]);

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
            className="w-full aspect-video bg-black"
          >
            <track kind="captions" />
          </video>
        </motion.div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { AdminRecording } from '@/app/api/admin/recordings/route';

/**
 * Every consultation with audio, newest first, each playable in place.
 *
 * Native audio controls on purpose: this is an internal tool where scrubbing,
 * speed and download matter more than bespoke chrome, and the browser gives
 * all three for free. `preload="none"` keeps a 200-row page from fetching
 * hundreds of megabytes before anything is clicked.
 */

/** "24 Jul 2026, 14:32" */
function fmtStartedAt(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function fmtTimestamp(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecordingsList() {
  const [recordings, setRecordings] = useState<AdminRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/recordings', { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? 'Not authorized.' : 'Failed to load recordings.');
        setRecordings([]);
        return;
      }
      const data = await res.json();
      setRecordings(data.recordings ?? []);
      setUpdatedAt(new Date());
    } catch {
      setError('Failed to load recordings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        {/* ── Header ── */}
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">
              Recordings
            </h1>
            <p className="mt-2 text-sm text-muted">
              Every consultation with audio — listen to what users actually said
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span>
              {updatedAt ? (
                <>
                  Updated <span className="font-mono">{fmtTimestamp(updatedAt)}</span>
                </>
              ) : (
                '—'
              )}
            </span>
            <Link
              href="/admin"
              className="text-primary hover:text-primary-light underline underline-offset-4"
            >
              ← Admin
            </Link>
            <button
              onClick={load}
              disabled={loading}
              className="text-primary hover:text-primary-light underline underline-offset-4 disabled:opacity-40"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-8 border-l-2 border-danger pl-4 py-2 text-sm text-danger">{error}</div>
        )}

        <section className="mt-12 border-t border-border">
          {loading && recordings.length === 0 ? (
            <p className="py-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : recordings.length === 0 ? (
            <p className="py-8 text-sm text-muted">
              No recordings yet. Only consultations sat after audio capture shipped
              (25 July 2026) have audio — earlier sessions are transcript-only.
            </p>
          ) : (
            recordings.map((recording, index) => (
              <motion.article
                key={recording.sessionId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4), ease: 'easeOut' }}
                className="border-b border-border py-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="text-[15px] font-semibold text-heading">
                    {recording.station ?? 'Unknown station'}
                  </h2>
                  <p className="font-mono text-[11px] tabular-nums text-muted">
                    {fmtStartedAt(recording.startedAt)}
                  </p>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                  <span>{recording.email ?? 'no email captured'}</span>
                  {recording.guest && (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      Free station
                    </span>
                  )}
                  <span>
                    {recording.overallScore === null
                      ? 'unmarked'
                      : `scored ${recording.overallScore}`}
                  </span>
                  <span>{recording.status}</span>
                </div>

                {recording.url ? (
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <audio controls preload="none" src={recording.url} className="h-9 w-full max-w-[520px]">
                      <track kind="captions" />
                    </audio>
                    <a
                      href={recording.url}
                      download
                      className="text-[12px] text-primary underline underline-offset-4 hover:text-primary-light"
                    >
                      Download
                    </a>
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] text-danger">
                    Audio file missing from storage.
                  </p>
                )}
              </motion.article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { AdminLecture } from '@/app/api/admin/lectures/route';
import { ALLOWED_LECTURE_EXTENSIONS, normalizeLectureExtension } from '@/lib/lectures/media';

/**
 * Content ops for the lecture course: add a lecture, upload its video, publish.
 *
 * The upload is browser → Supabase Storage over a signed PUT, never through a
 * function: a Vercel request body caps at ~4.5MB and a lecture is measured in
 * hundreds. XHR rather than fetch purely for `upload.onprogress` — a 500MB
 * upload with a spinner and no percentage is indistinguishable from a hang.
 */

const ACCEPT = ALLOWED_LECTURE_EXTENSIONS.map((e) => `.${e}`).join(',');

interface UploadState {
  lectureId: string;
  percent: number;
}

/** PUT the file straight at Storage, reporting progress. Resolves on 2xx. */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage rejected the upload (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

export default function LecturesAdmin() {
  const [lectures, setLectures] = useState<AdminLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [creating, setCreating] = useState(false);

  // One hidden input, retargeted at whichever row asked for a file.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/lectures', { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? 'Not authorized.' : 'Failed to load lectures.');
        setLectures([]);
        return;
      }
      const data = await res.json();
      setLectures(data.lectures ?? []);
    } catch {
      setError('Failed to load lectures.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createLecture(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/lectures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          sortOrder: Number(sortOrder) || 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not create the lecture.');
        return;
      }
      setTitle('');
      setDescription('');
      await load();
    } catch {
      setError('Could not create the lecture.');
    } finally {
      setCreating(false);
    }
  }

  async function togglePublished(lecture: AdminLecture) {
    setBusyId(lecture.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/lectures', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lecture.id, isPublished: !lecture.isPublished }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not update the lecture.');
        return;
      }
      await load();
    } catch {
      setError('Could not update the lecture.');
    } finally {
      setBusyId(null);
    }
  }

  function pickFile(lectureId: string) {
    uploadTargetRef.current = lectureId;
    fileInputRef.current?.click();
  }

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const lectureId = uploadTargetRef.current;
    // Reset immediately so re-picking the same file still fires a change event.
    event.target.value = '';
    if (!file || !lectureId) return;

    const extension = normalizeLectureExtension(file.name.split('.').pop());
    if (!extension) {
      setError(`Unsupported file type. Allowed: ${ALLOWED_LECTURE_EXTENSIONS.join(', ')}.`);
      return;
    }

    setError(null);
    setUpload({ lectureId, percent: 0 });
    try {
      const signRes = await fetch('/api/admin/lectures/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId, extension }),
      });
      const signed = signRes.ok ? await signRes.json() : null;
      if (!signed?.signedUrl) {
        const body = signRes.ok ? {} : await signRes.json().catch(() => ({}));
        setError(body.error ?? 'Could not start the upload.');
        return;
      }

      await putWithProgress(signed.signedUrl, file, (percent) =>
        setUpload({ lectureId, percent }),
      );

      const confirmRes = await fetch('/api/admin/lectures/upload-url', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId, path: signed.path }),
      });
      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}));
        setError(body.error ?? 'The upload finished but could not be confirmed.');
        return;
      }
      await load();
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setUpload(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        {/* ── Header ── */}
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Lectures</h1>
            <p className="mt-2 text-sm text-muted">
              The Complete-tier course — videos live in the private{' '}
              <span className="font-mono">lectures</span> bucket
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
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

        {/* ── Add a lecture ── */}
        <form onSubmit={createLecture} className="mt-10 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[220px] text-xs text-muted">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-heading"
            />
          </label>
          <label className="flex-1 min-w-[220px] text-xs text-muted">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-heading"
            />
          </label>
          <label className="w-24 text-xs text-muted">
            Order
            <input
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-heading font-mono"
            />
          </label>
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {creating ? 'Adding…' : 'Add lecture'}
          </button>
        </form>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileChosen}
          className="hidden"
        />

        {/* ── The course ── */}
        <section className="mt-12 border-t border-border">
          {loading && lectures.length === 0 ? (
            <p className="py-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : lectures.length === 0 ? (
            <p className="py-8 text-sm text-muted">
              No lectures yet. Add one above, then upload its video.
            </p>
          ) : (
            lectures.map((lecture, index) => {
              const uploading = upload?.lectureId === lecture.id;
              return (
                <motion.article
                  key={lecture.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4), ease: 'easeOut' }}
                  className="border-b border-border py-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <h2 className="text-[15px] font-semibold text-heading">
                      <span className="font-mono text-[11px] tabular-nums text-muted mr-2">
                        {lecture.sortOrder}
                      </span>
                      {lecture.title}
                    </h2>
                    <p className="font-mono text-[11px] tabular-nums text-muted">{lecture.id}</p>
                  </div>

                  {lecture.description && (
                    <p className="mt-1 text-[12px] text-muted">{lecture.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px]">
                    <span className={lecture.isPublished ? 'text-primary' : 'text-muted'}>
                      {lecture.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <span className={lecture.hasVideo ? 'text-muted' : 'text-danger'}>
                      {lecture.hasVideo ? 'Video uploaded' : 'No video'}
                    </span>

                    {uploading ? (
                      <span className="text-muted tabular-nums">
                        Uploading… {upload?.percent ?? 0}%
                      </span>
                    ) : (
                      !lecture.hasVideo && (
                        <button
                          onClick={() => pickFile(lecture.id)}
                          disabled={Boolean(upload)}
                          className="text-primary underline underline-offset-4 hover:text-primary-light disabled:opacity-40"
                        >
                          Upload video
                        </button>
                      )
                    )}

                    <button
                      onClick={() => togglePublished(lecture)}
                      disabled={busyId === lecture.id || (!lecture.hasVideo && !lecture.isPublished)}
                      className="text-primary underline underline-offset-4 hover:text-primary-light disabled:opacity-40"
                    >
                      {lecture.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                  </div>

                  {uploading && (
                    <div className="mt-3 h-1 w-full max-w-[520px] overflow-hidden rounded-full bg-black/[0.06]">
                      <motion.div
                        className="h-full bg-primary"
                        animate={{ width: `${upload?.percent ?? 0}%` }}
                        transition={{ ease: 'easeOut', duration: 0.2 }}
                      />
                    </div>
                  )}
                </motion.article>
              );
            })
          )}
        </section>

        <p className="mt-10 text-xs text-muted">
          Videos upload straight to Storage from this browser — they never cross a serverless
          function, which caps request bodies at ~4.5MB.
        </p>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { AdminLecture } from '@/app/api/admin/lectures/route';
import { ALLOWED_LECTURE_EXTENSIONS, normalizeLectureExtension } from '@/lib/lectures/media';
import { MAX_UPLOAD_BYTES } from '@/lib/lectures/limits';

/**
 * Content ops for the lecture course: add a lecture, upload its video, edit it,
 * publish it, replace a wrong file.
 *
 * The upload is browser → Supabase Storage over a signed PUT, never through a
 * function: a Vercel request body caps at ~4.5MB and a lecture is measured in
 * hundreds. XHR rather than fetch purely for `upload.onprogress` — a 500MB
 * upload with a spinner and no percentage is indistinguishable from a hang.
 *
 * Every mistake this page can make has an undo on this page, because an admin
 * who has to phone an engineer to fix a typo is the thing this page exists to
 * remove. That includes the nastiest one: an upload whose bytes landed but
 * whose confirm did not. Supabase will not re-mint for a key that already has
 * an object (upsert defaults to false), so the row is stuck until the object is
 * deleted — which is what "Clear video" does.
 */

const ACCEPT = ALLOWED_LECTURE_EXTENSIONS.map((e) => `.${e}`).join(',');

const GIGABYTE = 1024 ** 3;

interface UploadState {
  lectureId: string;
  percent: number;
}

interface EditState {
  id: string;
  title: string;
  description: string;
  sortOrder: string;
}

/**
 * The video's duration, read from the file the browser already holds. Nothing
 * server-side can demux a video, so this is the only chance to capture it —
 * and it is cosmetic, so an unreadable file resolves null rather than throwing.
 */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (value: number | null) => {
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const seconds = Math.round(video.duration);
      done(Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    };
    video.onerror = () => done(null);
    video.src = objectUrl;
  });
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
  const [edit, setEdit] = useState<EditState | null>(null);
  /** The lecture whose upload died at confirm — offer the clear-and-retry. */
  const [stuckId, setStuckId] = useState<string | null>(null);

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

  /** One PATCH for every editable field, publication included. */
  const patchLecture = useCallback(
    async (id: string, patch: Record<string, unknown>): Promise<boolean> => {
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch('/api/admin/lectures', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...patch }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? 'Could not update the lecture.');
          return false;
        }
        await load();
        return true;
      } catch {
        setError('Could not update the lecture.');
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  function togglePublished(lecture: AdminLecture) {
    return patchLecture(lecture.id, { isPublished: !lecture.isPublished });
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!edit) return;
    const sortOrder = Number(edit.sortOrder);
    if (!Number.isInteger(sortOrder)) {
      setError('Order must be a whole number.');
      return;
    }
    const saved = await patchLecture(edit.id, {
      title: edit.title.trim(),
      description: edit.description.trim() || null,
      sortOrder,
    });
    if (saved) setEdit(null);
  }

  /**
   * Detach the video: unpublishes, deletes the object, nulls the pointer. Both
   * "wrong file" and "confirm never landed" recover through here — the second
   * only recovers through here, since the key stays un-remintable until the
   * object is gone.
   */
  async function clearVideo(lecture: AdminLecture) {
    const warning = lecture.isPublished
      ? `Unpublish "${lecture.title}" and delete its video? Students lose access immediately.`
      : `Delete the video for "${lecture.title}"?`;
    if (!window.confirm(warning)) return;

    setBusyId(lecture.id);
    setError(null);
    try {
      const res = await fetch('/api/admin/lectures/upload-url', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId: lecture.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not clear the video.');
        return;
      }
      setStuckId(null);
      await load();
    } catch {
      setError('Could not clear the video.');
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

    // Mirrors the bucket's file_size_limit. Catching it here costs a second;
    // letting Storage catch it costs the whole upload and says only "413".
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `That file is ${(file.size / GIGABYTE).toFixed(1)}GB. The limit is ` +
          `${MAX_UPLOAD_BYTES / GIGABYTE}GB — re-encode it smaller and try again.`,
      );
      return;
    }

    setError(null);
    setStuckId(null);
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

      // Read the duration off the local file while it uploads — it is the only
      // moment the bytes are in reach of something that can decode them.
      const [durationSeconds] = await Promise.all([
        readDuration(file),
        putWithProgress(signed.signedUrl, file, (percent) => setUpload({ lectureId, percent })),
      ]);

      const confirmRes = await fetch('/api/admin/lectures/upload-url', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId, path: signed.path, durationSeconds }),
      });
      if (!confirmRes.ok) {
        const body = await confirmRes.json().catch(() => ({}));
        setError(body.error ?? 'The upload finished but could not be confirmed.');
        // The object is in the bucket but the row is not stamped, so a plain
        // retry will be refused: clearing the video is the only way back.
        setStuckId(lectureId);
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
              const editing = edit?.id === lecture.id;
              const stuck = stuckId === lecture.id;
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

                  {lecture.description && !editing && (
                    <p className="mt-1 text-[12px] text-muted">{lecture.description}</p>
                  )}

                  {editing && edit && (
                    <form onSubmit={saveEdit} className="mt-3 flex flex-wrap items-end gap-3">
                      <label className="flex-1 min-w-[220px] text-xs text-muted">
                        Title
                        <input
                          value={edit.title}
                          onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                          required
                          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-heading"
                        />
                      </label>
                      <label className="flex-1 min-w-[220px] text-xs text-muted">
                        Description
                        <input
                          value={edit.description}
                          onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-heading"
                        />
                      </label>
                      <label className="w-24 text-xs text-muted">
                        Order
                        <input
                          value={edit.sortOrder}
                          onChange={(e) => setEdit({ ...edit, sortOrder: e.target.value })}
                          inputMode="numeric"
                          className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-heading font-mono"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={busyId === lecture.id || !edit.title.trim()}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEdit(null)}
                        className="px-2 py-2 text-sm text-muted hover:text-heading"
                      >
                        Cancel
                      </button>
                    </form>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px]">
                    <span className={lecture.isPublished ? 'text-primary' : 'text-muted'}>
                      {lecture.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <span className={lecture.hasVideo ? 'text-muted' : 'text-danger'}>
                      {lecture.hasVideo ? 'Video uploaded' : 'No video'}
                    </span>
                    {lecture.durationSeconds ? (
                      <span className="text-muted tabular-nums">
                        {Math.round(lecture.durationSeconds / 60)} min
                      </span>
                    ) : null}

                    {uploading ? (
                      <span className="text-muted tabular-nums">
                        Uploading… {upload?.percent ?? 0}%
                      </span>
                    ) : (
                      !lecture.hasVideo &&
                      !stuck && (
                        <button
                          onClick={() => pickFile(lecture.id)}
                          disabled={Boolean(upload)}
                          className="text-primary underline underline-offset-4 hover:text-primary-light disabled:opacity-40"
                        >
                          Upload video
                        </button>
                      )
                    )}

                    {!uploading && (lecture.hasVideo || stuck) && (
                      <button
                        onClick={() => clearVideo(lecture)}
                        disabled={busyId === lecture.id || Boolean(upload)}
                        className="text-danger underline underline-offset-4 hover:opacity-80 disabled:opacity-40"
                      >
                        {lecture.hasVideo ? 'Replace video' : 'Clear failed upload'}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        setEdit(
                          editing
                            ? null
                            : {
                                id: lecture.id,
                                title: lecture.title,
                                description: lecture.description ?? '',
                                sortOrder: String(lecture.sortOrder),
                              },
                        )
                      }
                      className="text-primary underline underline-offset-4 hover:text-primary-light"
                    >
                      {editing ? 'Close' : 'Edit'}
                    </button>

                    <button
                      onClick={() => togglePublished(lecture)}
                      disabled={busyId === lecture.id || (!lecture.hasVideo && !lecture.isPublished)}
                      className="text-primary underline underline-offset-4 hover:text-primary-light disabled:opacity-40"
                    >
                      {lecture.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                  </div>

                  {stuck && (
                    <p className="mt-3 text-[12px] text-danger">
                      The file reached Storage but the lecture was never stamped, so re-uploading
                      to the same slot will be refused. Clear the failed upload, then upload again.
                    </p>
                  )}

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
          function, which caps request bodies at ~4.5MB. Maximum {MAX_UPLOAD_BYTES / GIGABYTE}GB
          per file; keep this tab open until the upload confirms.
        </p>
      </div>
    </div>
  );
}

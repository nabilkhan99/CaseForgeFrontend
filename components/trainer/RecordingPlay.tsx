'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface RecordingPlayProps {
  sessionId: string;
  /** For the accessible name — "Play Mark's consultation", not "Play". */
  studentName: string;
  caseTitle: string;
}

/**
 * Play control for one student's consultation audio.
 *
 * The signed URL is fetched on the first press, never on render. There is one
 * of these per row and the URLs are short-lived, so minting nine of them for a
 * list a trainer will play at most one item from would be nine pointless
 * round trips against Storage — and eight URLs that expire unused.
 *
 * Once opened it becomes a native `<audio controls>`, the same choice
 * /admin/recordings made: scrubbing, speed and the system volume are all
 * things the browser already does better than anything worth writing here, and
 * a trainer listening back to a consultation scrubs constantly.
 *
 * The 404 the endpoint returns for an unauthorized or recording-less session is
 * reported as "No audio" rather than an error — from the trainer's side those
 * are the same fact, and the row already only renders this control when the
 * overview said a recording exists.
 */
export default function RecordingPlay({ sessionId, studentName, caseTitle }: RecordingPlayProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    if (loading || url) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/clinical-master/recording/${sessionId}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) throw new Error('no url');
      setUrl(data.url as string);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <AnimatePresence initial={false}>
        <motion.audio
          controls
          autoPlay
          preload="none"
          src={url}
          className="h-9 w-full max-w-[280px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Your browser cannot play this recording.
        </motion.audio>
      </AnimatePresence>
    );
  }

  if (failed) {
    return <span className="text-[11px] text-muted">No audio</span>;
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={loading}
      aria-label={`Play ${studentName}'s consultation for ${caseTitle}`}
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted transition-colors hover:bg-black/[0.03] hover:text-heading disabled:opacity-50 sm:min-h-[32px] sm:min-w-[32px] focus-visible-ring"
    >
      {loading ? (
        <motion.span
          className="block h-3.5 w-3.5 rounded-full border-[1.5px] border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.14v13.72a.5.5 0 0 0 .76.43l11.2-6.86a.5.5 0 0 0 0-.86L8.76 4.71a.5.5 0 0 0-.76.43Z" />
        </svg>
      )}
    </button>
  );
}

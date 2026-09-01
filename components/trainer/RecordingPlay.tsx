'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

interface RecordingPlayProps {
  sessionId: string;
  /** For the accessible name and the dialog header — "Mark Chen", not "Play". */
  studentName: string;
  caseTitle: string;
  /** Already formatted for display ("28 Aug"); the list owns the format. */
  date: string;
}

/**
 * Playback speeds. 1x first in value, not in the row — the row reads left to
 * right slowest to fastest, which is the order the control is scanned in.
 *
 * 0.75x is the slow end rather than 0.5x: this is speech being studied, and
 * half speed is slurred enough to be harder to follow, not easier. 2x is the
 * fast end because a trainer skimming back to a moment they remember is the
 * other real use.
 */
const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

const DEFAULT_SPEED = 1;

/** "1x" and "1.25x" — never "1.00x". */
function speedLabel(speed: number): string {
  return `${speed}×`;
}

/**
 * Play control for one student's consultation audio, opening into a modal.
 *
 * WHY A MODAL. Playback used to swap the button for an inline `<audio>` inside
 * the row, which made the row taller than its neighbours, pushed the list about
 * on every press, and left a 280px-wide scrub bar on a phone — unusable for the
 * one thing a trainer does constantly, which is jump back ten seconds. A dialog
 * gives the transport the whole width and puts the case, the student and the
 * date next to it, so there is no doubt whose consultation is playing.
 *
 * The signed URL is still fetched on the first press, never on render. There is
 * one of these per row and the URLs are short-lived, so minting nine of them for
 * a list a trainer plays at most one item from would be nine pointless round
 * trips and eight expiries.
 *
 * PORTALLED, unlike ReferralModal. Every row in the session list is a
 * `motion.div`, and a transformed ancestor becomes the containing block for
 * `position: fixed` descendants — the same trap AppNavbar documents for its
 * dropdown overlay. Rendered in place, this dialog would be "full screen"
 * inside a 44px-tall row.
 *
 * ENTRANCE ONLY — NO AnimatePresence, AND THAT IS DELIBERATE. The first version
 * wrapped this in AnimatePresence with matching `exit` props. Measured in the
 * browser, the overlay never unmounted: it sat at `opacity: 0` indefinitely
 * after close, and because it is `fixed inset-0 z-[60]` with pointer events, it
 * silently swallowed every click on the Students tab from the first time a
 * recording was closed. An invisible page-wide click trap is a far worse bug
 * than a missing 180ms fade, so the dialog is now a plain conditional render
 * that unmounts the instant it closes. If an exit animation is ever wanted back,
 * verify the node actually leaves the DOM — not just that it looks gone.
 *
 * The 404 the endpoint returns for an unauthorized or recording-less session is
 * reported as "No audio" rather than an error — from the trainer's side those
 * are the same fact, and the row only renders this control when the overview
 * said a recording exists.
 */
export default function RecordingPlay({
  sessionId,
  studentName,
  caseTitle,
  date,
}: RecordingPlayProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);

  const titleId = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  async function openPlayer() {
    if (loading) return;
    // Already minted — reopen without a second round trip. The URL lives an
    // hour, which outlasts any single sitting with this list.
    if (url) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/clinical-master/recording/${sessionId}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) throw new Error('no url');
      setUrl(data.url as string);
      setOpen(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    // Paused explicitly as well as unmounted. Unmounting the element does stop
    // playback, but doing it in this order means the audio never outlives the
    // dialog by even a frame.
    audioRef.current?.pause();
    setOpen(false);
  }

  // Escape closes, focus moves to the dialog on open and back to the play
  // button on close, and the page behind is locked — without the lock the list
  // scrolls under the sheet on a phone, so closing drops you somewhere you did
  // not choose. Same rules as ReferralModal and the navbar's mobile menu.
  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(
      () => dialogRef.current?.focus({ preventScroll: true }),
      60,
    );

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
      restoreFocusTo.current?.focus?.();
    };
    // Keyed on `open` alone. `close` is redefined every render, so depending on
    // it would tear the listener down and rebuild it mid-dialog — and worse,
    // run the cleanup's focus restore while the dialog is still up.
  }, [open]);

  /**
   * Apply the rate to the element.
   *
   * `playbackRate` is a property of the media element, not an attribute, and it
   * is reset whenever a new source loads — so it is set here on every change
   * AND again from `onLoadedMetadata`, or a speed chosen before the audio was
   * ready would be silently discarded.
   */
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, url, open]);

  const trigger = (
    <button
      type="button"
      onClick={openPlayer}
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

  if (failed && !url) {
    return <span className="text-[11px] text-muted">No audio</span>;
  }

  return (
    <>
      {trigger}
      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {open && url && (
              <motion.div
                className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18 }}
                onClick={close}
              >
                <div className="fixed inset-0 bg-heading/40" aria-hidden="true" />

                {/* A bottom sheet on a phone and a centred card from `sm`. The
                    sheet is the shape a thumb expects and it puts the transport
                    within reach of one; above `sm` a full-width bar would be a
                    900px scrub line for a twelve-minute recording. */}
                <motion.div
                  ref={dialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={titleId}
                  tabIndex={-1}
                  onClick={(event) => event.stopPropagation()}
                  className="relative w-full rounded-t-2xl border border-hairline bg-surface-raised p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-elevation-4 outline-none sm:w-auto sm:min-w-[380px] sm:max-w-[440px] sm:rounded-2xl sm:pb-5"
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2
                        id={titleId}
                        className="text-[15px] font-semibold leading-snug text-heading"
                      >
                        {caseTitle}
                      </h2>
                      <p className="mt-1 text-[12px] text-muted">
                        {studentName}
                        {date && (
                          <>
                            <span aria-hidden="true" className="mx-1.5 text-black/20">
                              &middot;
                            </span>
                            <span className="font-mono">{date}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      aria-label="Close recording"
                      className="-mr-1.5 -mt-1.5 flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-black/[0.03] hover:text-heading focus-visible-ring"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>

                  {/* Native controls, the same choice /admin/recordings made:
                      scrubbing, volume and the system media keys are all things
                      the browser already does better than anything worth
                      writing here. */}
                  <audio
                    ref={audioRef}
                    controls
                    autoPlay
                    preload="metadata"
                    src={url}
                    onLoadedMetadata={(event) => {
                      event.currentTarget.playbackRate = speed;
                    }}
                    className="mt-4 h-10 w-full"
                  >
                    Your browser cannot play this recording.
                  </audio>

                  <div className="mt-4 border-t border-hairline pt-3.5">
                    <div
                      role="radiogroup"
                      aria-label="Playback speed"
                      className="flex flex-wrap items-center gap-1.5"
                    >
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                        Speed
                      </span>
                      {SPEEDS.map((option) => {
                        const active = option === speed;
                        return (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setSpeed(option)}
                            className={`flex min-h-[44px] items-center rounded-full border px-3 font-mono text-[12px] tabular-nums transition-colors sm:min-h-[32px] focus-visible-ring ${
                              active
                                ? 'border-primary bg-primary/[0.08] font-semibold text-primary'
                                : 'border-hairline text-muted hover:bg-black/[0.02] hover:text-heading'
                            }`}
                          >
                            {speedLabel(option)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </>,
          document.body,
        )}
    </>
  );
}

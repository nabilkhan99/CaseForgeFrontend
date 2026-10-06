'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { CasePhoto } from '@/lib/stations/casePhotos';

/**
 * The photo a patient "sent in before the call", shown where the candidate
 * needs it: under the brief (CasePhotoGallery) and in the live consultation
 * (CasePhotoTray). Both open the same full-screen viewer. Neither renders
 * anything for a case without photos, so every other case looks as it did.
 */

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true after: gates the portal. */
function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function photosLabel(count: number): string {
  return count === 1 ? 'Photograph' : 'Photographs';
}

/** Which photo is open in the viewer, plus the open/close/step handlers. */
function useLightbox(count: number) {
  const [index, setIndex] = useState<number | null>(null);
  const open = useCallback((i: number) => setIndex(i), []);
  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) => setIndex((i) => (i === null ? i : (i + delta + count) % count)),
    [count],
  );
  return { index, open, close, step };
}

function ExpandGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface CasePhotosProps {
  photos: readonly CasePhoto[];
  className?: string;
}

/** Under the candidate brief: the photos at reading size, tap to enlarge. */
export function CasePhotoGallery({ photos, className = '' }: CasePhotosProps) {
  const { index, open, close, step } = useLightbox(photos.length);
  if (photos.length === 0) return null;
  const single = photos.length === 1;

  return (
    <div className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{photosLabel(photos.length)}</div>
        <div className="text-[11px] text-muted">Tap to enlarge</div>
      </div>
      <div className={single ? '' : 'grid grid-cols-2 gap-3'}>
        {photos.map((photo, i) => (
          <figure key={photo.src} className="m-0">
            <motion.button
              type="button"
              onClick={() => open(i)}
              aria-label={`Enlarge photo: ${photo.alt}`}
              className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl bg-surface-warm ring-1 ring-black/[0.06] shadow-elevation-1 focus-visible-ring"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                width={photo.width}
                height={photo.height}
                sizes={single ? '(max-width: 640px) 100vw, 592px' : '(max-width: 640px) 50vw, 296px'}
                className={single ? 'h-auto w-full' : 'aspect-[4/3] h-full w-full object-cover'}
              />
              <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-heading shadow-elevation-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                <ExpandGlyph />
              </span>
            </motion.button>
            {photo.caption && (
              <figcaption className="mt-1.5 text-[12px] leading-snug text-muted">{photo.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
      <CasePhotoLightbox photos={photos} index={index} onClose={close} onStep={step} />
    </div>
  );
}

/** In the live consultation: small thumbnails under the top bar, tap to view. */
export function CasePhotoTray({ photos, className = '' }: CasePhotosProps) {
  const { index, open, close, step } = useLightbox(photos.length);
  if (photos.length === 0) return null;

  return (
    <>
      <motion.div
        className={`flex flex-shrink-0 items-center justify-center gap-2 px-4 pt-3 ${className}`}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      >
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{photosLabel(photos.length)}</span>
        {photos.map((photo, i) => (
          <motion.button
            key={photo.src}
            type="button"
            onClick={() => open(i)}
            aria-label={`View photo: ${photo.alt}`}
            className="relative h-11 w-11 flex-shrink-0 cursor-zoom-in overflow-hidden rounded-lg ring-1 ring-black/10 shadow-elevation-1 focus-visible-ring"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
          >
            <Image src={photo.src} alt="" width={photo.width} height={photo.height} sizes="44px" className="h-full w-full object-cover" />
          </motion.button>
        ))}
      </motion.div>
      <CasePhotoLightbox photos={photos} index={index} onClose={close} onStep={step} />
    </>
  );
}

interface LightboxProps {
  photos: readonly CasePhoto[];
  index: number | null;
  onClose: () => void;
  onStep: (delta: number) => void;
}

/**
 * Full-screen viewer. Portalled to <body> so a transformed or blurred ancestor
 * (the brief's entrance animation, the call screen's bars) cannot trap the
 * fixed overlay inside itself.
 */
function CasePhotoLightbox({ photos, index, onClose, onStep }: LightboxProps) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = index !== null;
  const many = photos.length > 1;

  useEffect(() => {
    if (!isOpen) return;
    const returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (many && event.key === 'ArrowRight') onStep(1);
      else if (many && event.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      returnFocusTo?.focus();
    };
  }, [isOpen, many, onClose, onStep]);

  if (!isClient) return null;
  const photo = index === null ? null : photos[index];

  return createPortal(
    <AnimatePresence>
      {photo && (
        <motion.div
          key="case-photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={photo.caption ?? photo.alt}
          className="fixed inset-0 z-[60] flex flex-col bg-stone-950/90 backdrop-blur-sm pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
          <div className="flex h-14 flex-shrink-0 items-center justify-between px-4">
            <span className="text-[12px] font-medium text-white/60">{many ? `${(index ?? 0) + 1} / ${photos.length}` : ''}</span>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close photo"
              className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible-ring"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={photo.src}
                className="flex max-h-full max-w-full items-center justify-center"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                onClick={(event) => event.stopPropagation()}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  sizes="(max-width: 1200px) 92vw, 1100px"
                  className="h-auto max-h-[calc(100dvh-10rem)] w-auto max-w-full rounded-lg object-contain shadow-elevation-4"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex min-h-[4.5rem] flex-shrink-0 items-center justify-center gap-4 px-4" onClick={(event) => event.stopPropagation()}>
            {many && (
              <button
                type="button"
                onClick={() => onStep(-1)}
                aria-label="Previous photo"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible-ring"
              >
                &larr;
              </button>
            )}
            {photo.caption && <p className="max-w-[60ch] text-center text-[13px] leading-snug text-white/80">{photo.caption}</p>}
            {many && (
              <button
                type="button"
                onClick={() => onStep(1)}
                aria-label="Next photo"
                className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible-ring"
              >
                &rarr;
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

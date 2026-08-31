'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { Accent, Pill } from './editorial';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5, ease: 'easeOut' as const },
};

/**
 * A one-minute excerpt from lecture one, sitting between the course
 * breakdown and the testimonials — proof of how the course actually teaches.
 * Poster + play overlay until first play; native controls from then on.
 */
export default function LecturePreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      /* Gesture rejection — leave the poster and overlay in place. */
    });
  };

  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div {...fadeUp} className="text-center">
          <Pill>Inside the course</Pill>
          <h2 className="mx-auto mt-7 max-w-2xl text-3xl font-medium leading-[1.14] tracking-tight text-heading sm:text-5xl">
            Watch a minute of <Accent>lecture one.</Accent>
          </h2>
        </motion.div>

        <motion.div
          {...fadeUp}
          className="relative mt-10 overflow-hidden rounded-3xl border border-heading/[0.06] bg-white/80 shadow-elevation-3 sm:mt-14"
        >
          <video
            ref={videoRef}
            className="block aspect-video w-full"
            src="/lecture/lecture-one-preview.mp4"
            poster="/lecture/lecture-one-preview.jpg"
            preload="metadata"
            playsInline
            controls={started}
            onPlay={() => setStarted(true)}
          />
          {!started && (
            <button
              type="button"
              onClick={startPlayback}
              aria-label="Play lecture preview"
              className="group absolute inset-0 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-elevation-2 transition-transform duration-200 group-hover:scale-105 group-hover:bg-white sm:h-[72px] sm:w-[72px]">
                <Play
                  className="ml-1 h-6 w-6 text-[#1C1C1A] sm:h-7 sm:w-7"
                  fill="currentColor"
                  aria-hidden="true"
                />
              </span>
            </button>
          )}
        </motion.div>
      </div>
    </section>
  );
}

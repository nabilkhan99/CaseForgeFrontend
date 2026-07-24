'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { Pill } from '@/components/landing/v5/editorial';

interface VideoCardData {
  handle: string;
  gradient: string;
  avatar: React.ReactNode;
  videoSrc?: string;
  poster?: string;
}

const KwameAvatar = (
  <svg
    viewBox="0 0 90 140"
    className="absolute inset-0 h-full w-full"
    aria-hidden="true"
  >
    <circle cx="45" cy="52" r="17" fill="#8D5524" />
    <path
      d="M45 36 a17 17 0 0 1 17 16 l-4 -2 -3 -6 -6 -4 -10 1 -7 5 -4 6 a17 17 0 0 1 17 -16z"
      fill="#1B1B1B"
    />
    <rect x="36" y="64" width="18" height="10" rx="4" fill="#8D5524" />
    <path d="M20 140 q0 -55 25 -55 q25 0 25 55z" fill="#2E6E5E" />
    <circle cx="39" cy="50" r="1.8" fill="#1B1B1B" />
    <circle cx="51" cy="50" r="1.8" fill="#1B1B1B" />
    <path
      d="M40 58 q5 4 10 0"
      stroke="#1B1B1B"
      strokeWidth="1.4"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const PriyaAvatar = (
  <svg
    viewBox="0 0 90 140"
    className="absolute inset-0 h-full w-full"
    aria-hidden="true"
  >
    <circle cx="45" cy="52" r="17" fill="#E8B88A" />
    <path
      d="M28 50 q0 -18 17 -18 q17 0 17 18 l0 12 q-3 -4 -3 -12 -6 4 -14 4 -8 0 -14 -8 q-3 6 -3 18z"
      fill="#3B2314"
    />
    <path d="M28 50 q0 30 6 34 l-8 0 q-2 -20 2 -34z" fill="#3B2314" />
    <path d="M62 50 q0 30 -6 34 l8 0 q2 -20 -2 -34z" fill="#3B2314" />
    <rect x="36" y="64" width="18" height="10" rx="4" fill="#E8B88A" />
    <path d="M20 140 q0 -55 25 -55 q25 0 25 55z" fill="#B05A7A" />
    <circle cx="39" cy="51" r="1.8" fill="#1B1B1B" />
    <circle cx="51" cy="51" r="1.8" fill="#1B1B1B" />
    <path
      d="M40 59 q5 4 10 0"
      stroke="#1B1B1B"
      strokeWidth="1.4"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const TomAvatar = (
  <svg
    viewBox="0 0 90 140"
    className="absolute inset-0 h-full w-full"
    aria-hidden="true"
  >
    <circle cx="45" cy="52" r="17" fill="#F1C9A5" />
    <path
      d="M45 35 a17 17 0 0 1 17 17 l-5 -1 q2 -8 -5 -11 -4 4 -12 4 -7 0 -9 -3 -3 3 -3 11 l-5 0 a17 17 0 0 1 22 -17z"
      fill="#C47E3A"
    />
    <rect x="36" y="64" width="18" height="10" rx="4" fill="#F1C9A5" />
    <path d="M20 140 q0 -55 25 -55 q25 0 25 55z" fill="#37536B" />
    <circle cx="39" cy="51" r="1.8" fill="#1B1B1B" />
    <circle cx="51" cy="51" r="1.8" fill="#1B1B1B" />
    <path
      d="M40 59 q5 3 10 0"
      stroke="#1B1B1B"
      strokeWidth="1.4"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M33 45 q6 -4 8 0 M49 45 q6 -4 8 0"
      stroke="#C47E3A"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const VIDEOS: VideoCardData[] = [
  {
    handle: '@priya.gpst3',
    gradient: 'linear-gradient(160deg,#9C6644,#6B4226)',
    avatar: PriyaAvatar,
    videoSrc: '/testimonials/testimonial-2.mp4',
    poster: '/testimonials/testimonial-2.jpg',
  },
  {
    handle: '@tom.talks.gp',
    gradient: 'linear-gradient(160deg,#5F7470,#2F3E46)',
    avatar: TomAvatar,
    videoSrc: '/testimonials/testimonial-3.mp4',
    poster: '/testimonials/testimonial-3.jpg',
  },
  {
    handle: '@dr.kwame.gp',
    gradient: 'linear-gradient(160deg,#3D5A80,#293241)',
    avatar: KwameAvatar,
    videoSrc: '/testimonials/testimonial-1.mp4',
    poster: '/testimonials/testimonial-1.jpg',
  },
];

function VideoCard({ handle, gradient, avatar, videoSrc, poster }: VideoCardData) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      // Pause any other testimonial that's currently playing, so only one
      // voice is ever heard at a time (duplicated across the mobile carousel).
      document.querySelectorAll<HTMLVideoElement>('video[data-testimonial]').forEach((other) => {
        if (other !== video) other.pause();
      });
      video.play().catch(() => {
        /* Autoplay/gesture rejection — leave the poster visible. */
      });
    } else {
      video.pause();
    }
  };

  return (
    <button
      type="button"
      onClick={videoSrc ? togglePlay : undefined}
      aria-label={videoSrc ? 'Play testimonial video' : handle}
      className="group/video relative block aspect-[9/16] w-full overflow-hidden rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      style={!videoSrc ? { background: gradient } : undefined}
    >
      {videoSrc ? (
        <video
          ref={videoRef}
          data-testimonial
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          poster={poster}
          playsInline
          loop
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      ) : (
        avatar
      )}
      <div
        className={`absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 transition-opacity duration-200 sm:h-12 sm:w-12 ${
          playing ? 'opacity-0' : 'opacity-100 group-hover/video:bg-white'
        }`}
      >
        <Play
          className="ml-0.5 h-4 w-4 text-[#1C1C1A] sm:h-5 sm:w-5"
          fill="currentColor"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

/**
 * Mobile: a TikTok-style carousel — one dominant centred video with the
 * neighbours peeking in at the edges, swipeable, looping infinitely. Three
 * copies of the set render side by side; when the scroll position drifts into
 * the first or last copy, it silently jumps one set-width back to the middle,
 * so swiping never reaches an end.
 */
function MobileVideoCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const extended = [...VIDEOS, ...VIDEOS, ...VIDEOS];

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const setWidth = scroller.scrollWidth / 3;
    // Start centred on the middle copy's first video.
    scroller.scrollLeft = setWidth;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const width = scroller.scrollWidth / 3;
        if (scroller.scrollLeft < width * 0.5) {
          scroller.scrollLeft += width;
        } else if (scroller.scrollLeft > width * 1.5) {
          scroller.scrollLeft -= width;
        }
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={scrollerRef}
      className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[10%] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden"
      aria-label="Video testimonials carousel"
    >
      {extended.map((video, i) => (
        <div key={`${video.handle}-${i}`} className="w-[80%] flex-shrink-0 snap-center">
          <VideoCard {...video} />
        </div>
      ))}
    </div>
  );
}

export default function VideoProof() {
  return (
    <section className="px-5 py-10 text-center sm:px-8 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <Pill>What doctors are saying about the course</Pill>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.06 }}
        className="mx-auto mt-7 max-w-2xl text-3xl font-medium leading-[1.12] tracking-tight text-heading sm:text-5xl"
      >
        Don&apos;t just take our word for it.
      </motion.h2>

      <div className="mt-12 sm:mt-14">
        <MobileVideoCarousel />

        <div className="mx-auto hidden max-w-5xl grid-cols-3 gap-4 sm:grid sm:gap-6">
          {VIDEOS.map((video, i) => (
            <motion.div
              key={video.handle}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <VideoCard {...video} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

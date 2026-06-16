'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import HeroPreview from './HeroPreview';

const UNDERLINE_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 8' preserveAspectRatio='none'><path d='M2 5 Q 50 0 100 4 T 198 3' stroke='%23a8520f' stroke-width='1.8' fill='none' stroke-linecap='round'/></svg>\")";

const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0 0.18  0 0 0 0.18 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

export default function LandingHero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: '#f3ebdb' }}
    >
      {/* Aesthetic background — scoped to hero */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 45% at 50% 18%, rgba(255, 232, 191, .55), transparent 70%),' +
            'radial-gradient(80% 60% at 100% 110%, rgba(194,100,28,.10), transparent 60%),' +
            'radial-gradient(70% 50% at 0% 100%, rgba(120,70,20,.07), transparent 60%),' +
            'linear-gradient(180deg, #f4ecdc 0%, #efe3c9 100%)',
        }}
      />
      {/* Grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: GRAIN_SVG,
          opacity: 0.35,
          mixBlendMode: 'multiply',
        }}
      />
      {/* Dotted orbits */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 rounded-full hidden md:block pointer-events-none"
        style={{
          width: 1480,
          height: 1480,
          top: 260,
          border: '1px dashed rgba(120,80,30,.10)',
        }}
      />
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 rounded-full hidden md:block pointer-events-none"
        style={{
          width: 1080,
          height: 1080,
          top: 360,
          border: '1px dashed rgba(120,80,30,.18)',
        }}
      />

      <div className="relative z-10 max-w-[1240px] mx-auto px-6 sm:px-8 pt-24 pb-12 md:pt-28 md:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <h1
            className="mx-auto text-[#1a1612]"
            style={{
              fontFamily: 'var(--font-display), ui-sans-serif, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(46px, 6.4vw, 92px)',
              lineHeight: 1,
              letterSpacing: '-0.035em',
              maxWidth: '16ch',
              textWrap: 'balance',
            }}
          >
            Would you pass the SCA{' '}
            <span
              className="relative inline-block"
              style={{
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: '1.04em',
                color: '#a8520f',
                letterSpacing: '-0.015em',
                lineHeight: 0.95,
                padding: '0 0.04em',
                margin: '0 -0.02em',
              }}
            >
              tomorrow?
              <span
                aria-hidden
                className="absolute pointer-events-none"
                style={{
                  left: '6%',
                  right: '6%',
                  bottom: '-0.08em',
                  height: 6,
                  backgroundImage: UNDERLINE_SVG,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundSize: '100% 100%',
                  opacity: 0.9,
                }}
              />
            </span>
          </h1>

          <p
            className="mx-auto mt-6 text-[#3a2f24]"
            style={{
              maxWidth: '52ch',
              fontSize: 'clamp(16px, 1.25vw, 19px)',
              lineHeight: 1.55,
            }}
          >
            Test yourself against our AI patients and see if you&rsquo;re ready
            to pass.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-7"
          style={{ maxWidth: 560 }}
          id="join"
        >
          <div
            className="grid gap-2.5 items-stretch grid-cols-1 sm:grid-cols-[1fr_auto]"
          >
            <Link
              href="/try"
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-medium text-[#fff8e9] transition hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a8520f]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3ebdb]"
              style={{
                background: 'linear-gradient(180deg, #d3711e, #b35712)',
                border: '1px solid rgba(120,55,8,.4)',
                boxShadow:
                  '0 1px 0 rgba(255,220,170,.45) inset, 0 8px 20px -8px rgba(160,75,15,.55)',
              }}
            >
              Try a free case
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/cases"
              className="inline-flex min-h-[50px] items-center justify-center rounded-xl px-5 py-3.5 text-[14px] font-medium text-[#3a2f24] transition hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a8520f]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3ebdb]"
              style={{
                backgroundColor: 'rgba(255,250,238,.85)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid #d9cdb3',
                boxShadow:
                  '0 1px 0 rgba(255,255,255,.7) inset, 0 6px 16px -12px rgba(80,40,10,.30)',
              }}
            >
              Browse cases
            </Link>
          </div>
          <p className="mt-3 text-center text-[12.5px] text-[#7b6a55]">
            No account needed for the trial. Save your results when you are ready.
          </p>
        </motion.div>

        <HeroPreview />
      </div>
    </section>
  );
}

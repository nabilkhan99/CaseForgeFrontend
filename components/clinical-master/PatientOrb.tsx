'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  followEnvelope,
  haloOpacity,
  haloScale,
  normaliseLevel,
  orbScale,
  sheenOpacity,
  syntheticEnvelope,
} from '@/lib/clinical-master/orbLevel';

/**
 * The patient, as a soft amber sphere that swells and brightens with their
 * voice. Replaces the 48-bar waveform and absorbs the avatar it used to sit
 * under — one object on the screen instead of two.
 *
 * ## Why this is cheaper than what it replaces
 *
 * The old AudioVisualizer animated 48 elements' `height` in PERCENTAGES through
 * Framer Motion. A percentage height is resolved against the parent, so every
 * one of those writes forced layout, 48 elements deep, every frame, for the
 * whole consultation. This writes `transform` and `opacity` on three elements
 * and nothing else — both are composited, neither triggers layout or paint —
 * and it only writes them while the patient is actually speaking.
 *
 * ## Why there is no React state in the loop
 *
 * The level is pulled through `getLevel`, a getter over refs that the session
 * hook exposes for exactly this. Nothing here calls `setState`, so a talking
 * patient does not re-render the session page, the live transcript or the
 * controls. The rAF callback writes to two DOM nodes and returns.
 *
 * ## Why the loop is throttled and why it stops
 *
 * This page holds a screen wake lock for a full 12 minutes, so the loop really
 * would run for 12 unbroken minutes on a phone — and on Safari, Firefox and iOS
 * a 20Hz `detectorTick` is running the echo-cancellation logic on the same
 * thread, with comments recording real sessions that broke when it was starved.
 * So: writes are capped at ~30Hz rather than display rate (voice envelopes carry
 * no information above that), and the loop is only mounted while `active` is
 * true — during the roughly half of a consultation when the doctor is talking
 * there is no rAF scheduled at all. Silence is handled by a CSS breathe on a
 * separate element, which lives on the compositor and costs no main thread.
 */

/** ~30Hz. Faster than the envelope needs and slower than a 120Hz display asks. */
const FRAME_MS = 1000 / 30;

/**
 * How the orb glides home once the patient stops. Applied only on the way out,
 * so the live loop's 33ms writes are never fighting a transition mid-sentence.
 */
const SETTLE_TRANSITION =
  'transform 600ms cubic-bezier(0.22,1,0.36,1), opacity 600ms cubic-bezier(0.22,1,0.36,1)';

export interface PatientOrbProps {
  /** The patient's initials, kept out of every transform so they stay crisp. */
  initials: string;
  /** True while the patient is producing audio. Gates the whole render loop. */
  active: boolean;
  /**
   * Reads the patient's playback level, 0..1, or null on a browser that does
   * not report one. Must be referentially stable — it goes in an effect's deps.
   */
  getLevel: () => number | null;
  /** Outer diameter in px. Never renders wider than its container. */
  size?: number;
  className?: string;
}

export default function PatientOrb({
  initials,
  active,
  getLevel,
  size = 208,
  className = '',
}: PatientOrbProps) {
  const shouldReduceMotion = useReducedMotion();

  const haloRef = useRef<HTMLDivElement | null>(null);
  const sphereRef = useRef<HTMLDivElement | null>(null);
  const sheenRef = useRef<HTMLDivElement | null>(null);
  const envelopeRef = useRef(0);

  const paint = useCallback((envelope: number) => {
    const halo = haloRef.current;
    if (halo) {
      halo.style.transform = `scale(${haloScale(envelope)})`;
      halo.style.opacity = String(haloOpacity(envelope));
    }
    const sphere = sphereRef.current;
    if (sphere) sphere.style.transform = `scale(${orbScale(envelope)})`;
    const sheen = sheenRef.current;
    if (sheen) sheen.style.opacity = String(sheenOpacity(envelope));
  }, []);

  useEffect(() => {
    // Reduced motion gets no loop at all — not a hidden one. The resting
    // gradient below is the whole animation in that mode. Reading the
    // preference in an effect rather than in the markup is deliberate: the
    // server cannot know it, so branching the rendered tree on it would hand
    // React different markup to hydrate (same reasoning as ArcGauge).
    if (shouldReduceMotion || !active) return;

    const layers = [haloRef.current, sphereRef.current, sheenRef.current];
    for (const layer of layers) {
      if (!layer) continue;
      layer.style.transition = 'none';
      // Promoted for the duration of the patient's turn only. Leaving it on
      // permanently would hold three composited layers alive through twelve
      // minutes of a phone's memory for nothing.
      layer.style.willChange = 'transform, opacity';
    }

    let frame = 0;
    let lastWriteAt = 0;
    const startedAt = performance.now();

    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      if (now - lastWriteAt < FRAME_MS) return;
      lastWriteAt = now;
      const raw = getLevel();
      const target = raw === null ? syntheticEnvelope(now - startedAt) : normaliseLevel(raw);
      envelopeRef.current = followEnvelope(envelopeRef.current, target);
      paint(envelopeRef.current);
    };

    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      envelopeRef.current = 0;
      for (const layer of layers) {
        if (!layer) continue;
        layer.style.transition = SETTLE_TRANSITION;
        layer.style.willChange = '';
      }
      paint(0);
    };
  }, [active, shouldReduceMotion, getLevel, paint]);

  return (
    <div
      // Decoration plus a duplicate of the patient's name, which is already on
      // the page as text. Nothing here is worth announcing.
      aria-hidden="true"
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size, maxWidth: '100%' }}
    >
      {/* Outer glow. Carries most of the "brightens with the voice" reading,
          because scaling and fading a pre-painted gradient is free where
          animating a box-shadow or a colour is a repaint every frame. */}
      <div
        ref={haloRef}
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.45) 0%, rgba(180,83,9,0.25) 42%, rgba(180,83,9,0.08) 62%, rgba(180,83,9,0) 74%)',
          transform: `scale(${haloScale(0)})`,
          opacity: haloOpacity(0),
        }}
      />

      {/* The idle breathe lives on its own element so the two transforms
          compose. A CSS animation outranks an inline style in the cascade, so
          putting both on one node would let the keyframes clobber every write
          the render loop makes. `motion-safe:` is the reduced-motion guard that
          costs no JS and cannot desync from the server's markup. */}
      <div
        className="absolute motion-safe:animate-orb-breathe"
        style={{ inset: '17%' }}
      >
        <div
          ref={sphereRef}
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 32% 26%, #FCD34D 0%, #F59E0B 38%, #C2650B 74%, #B45309 100%)',
            boxShadow:
              '0 12px 40px rgba(180,83,9,0.3), 0 2px 8px rgba(180,83,9,0.2), inset 0 -10px 26px rgba(120,53,15,0.32)',
            transform: `scale(${orbScale(0)})`,
          }}
        >
          <div
            ref={sheenRef}
            className="absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(circle at 33% 24%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.14) 38%, rgba(255,255,255,0) 62%)',
              opacity: sheenOpacity(0),
            }}
          />
        </div>
      </div>

      {/* Outside every transformed element on purpose: scaled text resamples
          and the initials have to stay readable while the orb is moving. */}
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold text-white"
        style={{
          fontSize: Math.round(size * 0.15),
          letterSpacing: '0.02em',
          textShadow: '0 1px 4px rgba(120,53,15,0.45)',
        }}
      >
        {initials}
      </span>
    </div>
  );
}

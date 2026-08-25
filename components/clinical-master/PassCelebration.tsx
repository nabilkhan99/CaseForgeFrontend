'use client';

import { useEffect, useRef, useState } from 'react';

/** Amber and olive from the palette. No confetti brights — this is an exam result. */
const PARTICLE_COLOURS = ['#B45309', '#D97706', '#4D7C0F', '#A16207', '#E8A34D'];
const PARTICLE_COUNT = 42;
const PARTICLE_MS = 1600;
/** Matches the bloom below and the 1.1s measured off the reference animation. */
const BLOOM_MS = 1100;

interface PassCelebrationProps {
  /** Only a passing verdict celebrates. A fail renders nothing at all. */
  passed: boolean;
  /** Stops a refresh of the same report replaying it. */
  sessionId: string;
}

/**
 * M1 + M3 — the moment a candidate finds out they passed.
 *
 * Two things happen together: an amber bloom grows out of the score itself
 * (not from a container edge, which is what makes it read as caused by the
 * number), and a short scatter of particles settles under gravity.
 *
 * A fail gets neither. The bar fill that was already there is the quiet
 * branch, and dramatising the worst moment of someone's week with a slow
 * reveal would be the opposite of the point.
 *
 * Fires on every pass, per product decision. It is deliberately restrained —
 * no sound, under two seconds, gone. Guarded per session id so reloading a
 * report you passed last month does not throw a party each time.
 */
export default function PassCelebration({ passed, sessionId }: PassCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!passed) return;

    // sessionStorage can throw in private modes; a celebration is never worth
    // taking the page down for.
    const key = `ff:celebrated:${sessionId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      /* no storage — just celebrate */
    }
    setRun(true);
  }, [passed, sessionId]);

  useEffect(() => {
    if (!run) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const parts = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2;
      const speed = 2.4 + Math.random() * 4.2;
      return {
        x: w / 2,
        y: h * 0.42,
        vx: Math.cos(angle) * speed * 1.5,
        vy: Math.sin(angle) * speed,
        r: 1.6 + Math.random() * 2.4,
        colour: PARTICLE_COLOURS[i % PARTICLE_COLOURS.length],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
      };
    });

    let start: number | null = null;
    const frame = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      ctx.clearRect(0, 0, w, h);
      if (elapsed > PARTICLE_MS) {
        frameRef.current = null;
        return;
      }
      const fadeFrom = PARTICLE_MS * 0.72;
      const alpha = elapsed < fadeFrom ? 1 : 1 - (elapsed - fadeFrom) / (PARTICLE_MS - fadeFrom);

      for (const p of parts) {
        p.vy += 0.14;
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        ctx.restore();
      }
      frameRef.current = requestAnimationFrame(frame);
    };

    frameRef.current = requestAnimationFrame(frame);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [run]);

  if (!passed || !run) return null;

  return (
    <>
      {/* M1 — the bloom. Anchored low-left, over the score rather than the
          panel's centre, so it reads as coming out of the number. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[18%] top-[46%] z-0 h-2.5 w-2.5 rounded-full motion-reduce:hidden"
        style={{
          background:
            'radial-gradient(circle, rgba(180,83,9,0.30) 0%, rgba(217,119,6,0.18) 42%, rgba(180,83,9,0) 72%)',
          transform: 'translate(-50%, -50%) scale(0)',
          animation: `ff-bloom ${BLOOM_MS}ms cubic-bezier(.16,.84,.36,1) forwards`,
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 h-full w-full motion-reduce:hidden"
      />
      <style>{`
        @keyframes ff-bloom {
          0%   { transform: translate(-50%,-50%) scale(0);  opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(46); opacity: 1; }
        }
      `}</style>
    </>
  );
}

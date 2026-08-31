'use client';

import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';

interface CountConfig {
  to: number;
  suffix?: string;
  after: string;
}

interface Stat {
  /** Stable React key, and the fallback headline when there is no count. */
  headline: string;
  subline: string;
  count?: CountConfig;
}

const STATS: Stat[] = [
  {
    headline: '25% of GP trainees',
    subline: 'already use our portfolio tool',
    count: { to: 25, suffix: '%', after: ' of GP trainees' },
  },
  {
    headline: '200 stations',
    subline: 'built from the RCGP curriculum',
    count: { to: 200, after: ' stations' },
  },
  {
    headline: 'Built by GP educators',
    subline: 'who know exactly what examiners are looking for',
  },
];

interface CountUpProps {
  to: number;
  suffix?: string;
  start: boolean;
}

/**
 * Counts up to `to`, but renders `to` as its resting value.
 *
 * The number is a headline proof point, so the markup must never say "0". The
 * final value is therefore the state's initial value: it is what the server
 * renders, what a client with JavaScript disabled keeps, what anyone on
 * `prefers-reduced-motion` keeps, and what is shown if the viewport observer
 * never fires. The count is a decoration layered on top of a correct number,
 * not the thing that produces it.
 */
function CountUp({ to, suffix = '', start }: CountUpProps) {
  const [shown, setShown] = useState(to);
  const count = useMotionValue(0);
  const prefersReducedMotion = useReducedMotion();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!start || prefersReducedMotion || hasRun.current) return;
    hasRun.current = true;

    count.set(0);
    setShown(0);
    const unsubscribe = count.on('change', (value) =>
      setShown(Math.round(value))
    );
    const controls = animate(count, to, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
    });

    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [start, prefersReducedMotion, to, count]);

  return (
    <>
      {shown}
      {suffix}
    </>
  );
}

/**
 * The three proof numbers that sit under the guarantee card. Kept as its own
 * component so the guarantee treatment can be reused on /pricing and the trial
 * feedback page without dragging the landing page's marketing stats along.
 */
export default function ProofNumbers() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <>
      {/* Framer Motion's `initial` is server-rendered as inline opacity:0, so
          without JavaScript the reveal never runs and the rail would stay
          invisible. These are headline proof points, so they degrade to
          plainly visible instead. */}
      <noscript>
        <style>{`[data-proof-numbers]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <motion.div
        ref={ref}
        data-proof-numbers=""
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-12 grid grid-cols-1 gap-10 border-t border-hairline pt-10 text-center sm:mt-14 sm:grid-cols-3 sm:gap-6 sm:pt-12"
      >
        {STATS.map((stat) => (
          <div key={stat.headline}>
            <p className="font-medium tracking-tight text-heading">
              {stat.count ? (
                <>
                  <span className="font-[family-name:var(--font-serif)] text-4xl font-normal italic text-primary sm:text-5xl">
                    <CountUp
                      to={stat.count.to}
                      suffix={stat.count.suffix}
                      start={inView}
                    />
                  </span>
                  <span className="text-2xl sm:text-3xl">
                    {stat.count.after}
                  </span>
                </>
              ) : (
                <span className="text-2xl leading-tight sm:text-3xl">
                  {stat.headline}
                </span>
              )}
            </p>
            <p className="mx-auto mt-2 max-w-[240px] text-sm leading-relaxed text-body">
              {stat.subline}
            </p>
          </div>
        ))}
      </motion.div>
    </>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from 'framer-motion';

interface CountConfig {
  to: number;
  suffix?: string;
  after: string;
}

interface Stat {
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

function CountUp({ to, suffix = '', start }: CountUpProps) {
  const count = useMotionValue(0);
  const display = useTransform(count, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (!start) return;
    const controls = animate(count, to, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [start, to, count]);

  return <motion.span>{display}</motion.span>;
}

export default function TrustBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <section className="px-5 py-10 sm:px-8 sm:py-16">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto grid max-w-5xl grid-cols-1 gap-10 text-center sm:grid-cols-3 sm:gap-6"
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
                  <span className="text-2xl sm:text-3xl">{stat.count.after}</span>
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
    </section>
  );
}

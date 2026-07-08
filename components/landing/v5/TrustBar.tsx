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
    headline: '20% of GP trainees',
    subline: 'already use our portfolio tool',
    count: { to: 20, suffix: '%', after: ' of GP trainees' },
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
    <section className="px-5 py-6 sm:px-8 sm:py-10">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-5xl divide-x divide-[#E4DDC9] text-center"
      >
        {STATS.map((stat) => (
          <div key={stat.headline} className="flex-1 px-2 sm:px-8">
            <p className="mb-1 text-sm font-medium text-heading sm:mb-2 sm:text-2xl">
              {stat.count ? (
                <>
                  <CountUp
                    to={stat.count.to}
                    suffix={stat.count.suffix}
                    start={inView}
                  />
                  {stat.count.after}
                </>
              ) : (
                stat.headline
              )}
            </p>
            <p className="text-[10.5px] leading-relaxed text-body sm:text-sm">
              {stat.subline}
            </p>
          </div>
        ))}
      </motion.div>
    </section>
  );
}

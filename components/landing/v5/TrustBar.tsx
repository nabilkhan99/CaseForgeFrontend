'use client';

import { motion } from 'framer-motion';

interface Stat {
  headline: string;
  subline: string;
}

const STATS: Stat[] = [
  {
    headline: '20% of GP trainees',
    subline: 'already use our portfolio tool',
  },
  {
    headline: '200 stations',
    subline: 'built from the RCGP curriculum',
  },
  {
    headline: 'Built by GP educators',
    subline: 'who know exactly what examiners are looking for',
  },
];

export default function TrustBar() {
  return (
    <section className="px-5 py-8 sm:px-8 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-5xl divide-x divide-[#E4DDC9] text-center"
      >
        {STATS.map((stat) => (
          <div key={stat.headline} className="flex-1 px-2 sm:px-8">
            <p className="mb-1 text-sm font-medium text-heading sm:mb-2 sm:text-2xl">
              {stat.headline}
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

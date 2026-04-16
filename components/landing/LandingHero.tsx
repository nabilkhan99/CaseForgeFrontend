'use client';

import { motion } from 'framer-motion';

import CaseCard from './CaseCard';

const HEADLINE_WORDS = ['Your', 'SCA', 'exam,'];
const HEADLINE_WORDS_2 = ['rehearsed', 'before', 'it', 'counts.'];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const wordVariant = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 90, damping: 18 },
  },
};

export default function LandingHero() {
  return (
    <section className="relative min-h-[90dvh] flex flex-col items-center justify-center pt-28 pb-12 px-6 overflow-hidden">
      {/* Ambient orb */}
      <div
        className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(180,83,9,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-[680px] w-full text-center">
        {/* Eyebrow */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.05 }}
        >
          <span className="text-[11px] font-mono font-medium tracking-[0.14em] uppercase text-primary">
            For GP Trainees Preparing for the SCA
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-[clamp(36px,5vw+1rem,72px)] font-bold text-heading tracking-[-0.03em] leading-[1.05] mb-7"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <span className="flex flex-wrap justify-center gap-x-[0.22em]">
            {HEADLINE_WORDS.map((word, i) => (
              <motion.span key={i} variants={wordVariant} className="inline-block">
                {word}
              </motion.span>
            ))}
          </span>
          <span className="flex flex-wrap justify-center gap-x-[0.22em]">
            {HEADLINE_WORDS_2.map((word, i) => (
              <motion.span
                key={`l2-${i}`}
                variants={wordVariant}
                className={
                  word === 'rehearsed' ? 'inline-block italic gradient-text' : 'inline-block'
                }
              >
                {word}
              </motion.span>
            ))}
          </span>
        </motion.h1>

        {/* Subline */}
        <motion.p
          className="text-[18px] text-body leading-[1.7] max-w-[480px] mx-auto mb-10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.65 }}
        >
          AI patients that talk back, push back, and score you on every domain. Pick a case and
          start a consultation in under 60 seconds.
        </motion.p>
      </div>

      {/* Case card */}
      <CaseCard className="relative z-10" />

    </section>
  );
}

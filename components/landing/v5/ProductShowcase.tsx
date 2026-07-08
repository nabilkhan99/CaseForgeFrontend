'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ChapterBrief from './chapters/ChapterBrief';
import ChapterConsultation from './chapters/ChapterConsultation';
import ChapterScore from './chapters/ChapterScore';

const AUTO_ADVANCE_MS = 5000;

interface Step {
  key: string;
  tab: string;
  title: string;
  copy: string;
  Mockup: () => React.JSX.Element;
}

const STEPS: readonly Step[] = [
  {
    key: 'brief',
    tab: 'The brief',
    title: 'Read your patient brief',
    copy: 'Every station starts with the same information a real SCA candidate gets.',
    Mockup: ChapterBrief,
  },
  {
    key: 'consultation',
    tab: 'The consultation',
    title: 'Have the conversation',
    copy: 'Your patient responds in real time with voice.',
    Mockup: ChapterConsultation,
  },
  {
    key: 'feedback',
    tab: 'The feedback',
    title: 'See exactly where you stand',
    copy: 'Instant, domain-level scores on the three SCA marking criteria.',
    Mockup: ChapterScore,
  },
] as const;

/** Compact tabbed product tour: one frame, three steps, gentle auto-advance. */
export default function ProductShowcase() {
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const interactedRef = useRef(false);

  const selectStep = useCallback((index: number) => {
    interactedRef.current = true; // manual choice stops the tour
    setActive(index);
  }, []);

  useEffect(() => {
    if (!inView || interactedRef.current) return;
    const id = setInterval(() => {
      if (interactedRef.current) return;
      setActive((current) => (current + 1) % STEPS.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <motion.section
      className="px-5 py-6 sm:px-8 sm:py-10"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      onViewportEnter={() => setInView(true)}
      onViewportLeave={() => setInView(false)}
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-5 text-xs font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:mb-6 sm:text-sm">
          How a station works
        </p>

        {/* Step tabs */}
        <div
          role="tablist"
          aria-label="Product tour steps"
          className="mx-auto mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-[#E4DDC9] bg-white p-1 sm:gap-1.5"
        >
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => selectStep(i)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors sm:px-4 sm:text-xs ${
                i === active
                  ? 'bg-[#1C1C1A] text-[#FAC775]'
                  : 'text-body hover:bg-surface-warm'
              }`}
            >
              <span className="mr-1 opacity-60">{String(i + 1).padStart(2, '0')}</span>
              {s.tab}
            </button>
          ))}
        </div>

        {/* Step caption — read first, then the mockup below. Same stacking
            trick to avoid height wobble between tabs. */}
        <div className="mb-5 grid">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.key}
              className="col-start-1 row-start-1"
              initial={false}
              animate={{ opacity: i === active ? 1 : 0 }}
              transition={{ duration: 0.24 }}
              aria-hidden={i !== active}
            >
              <p className="text-sm font-medium text-heading sm:text-base">{s.title}</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-body sm:text-sm">
                {s.copy}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Product frame — all steps stacked in one grid cell so the frame
            keeps the tallest step's height and never jumps between tabs.
            Capped in size so the whole tour fits one desktop viewport. */}
        <div className="mx-auto grid w-full max-w-md overflow-hidden rounded-2xl border border-[#E4DDC9] bg-white text-left shadow-elevation-2">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.key}
              className="col-start-1 row-start-1 flex flex-col justify-center"
              initial={false}
              animate={{ opacity: i === active ? 1 : 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              style={{ pointerEvents: i === active ? 'auto' : 'none' }}
              aria-hidden={i !== active}
            >
              <s.Mockup />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ChapterBrief from './chapters/ChapterBrief';
import ChapterConsultation from './chapters/ChapterConsultation';
import ChapterScore from './chapters/ChapterScore';
import Chrome from './Chrome';
import { CROSSHATCH_DARK, Pill } from './editorial';

const AUTO_ADVANCE_MS = 5000;

interface Step {
  key: string;
  tab: string;
  title: string;
  copy: string;
  chromeLabel: string;
  chromeMeta: string;
  /**
   * Every step is mounted at once (stacked in one grid cell), so a mockup
   * cannot animate on mount — it would play while hidden behind another tab
   * and be finished before the user ever selects it. Mockups receive `active`
   * and drive their own entrance from it instead.
   */
  Mockup: (props: { active: boolean }) => React.JSX.Element;
}

const STEPS: readonly Step[] = [
  {
    key: 'brief',
    tab: 'Brief',
    title: 'Read your patient brief',
    copy: 'Three minutes to prepare, same format as exam day.',
    chromeLabel: 'Patient brief',
    chromeMeta: '03:00',
    Mockup: ChapterBrief,
  },
  {
    key: 'consultation',
    tab: 'Consultation',
    title: 'Have the conversation',
    copy: 'Your patient responds in real time with voice.',
    chromeLabel: 'Station 047 — ECG request',
    chromeMeta: '07:32',
    Mockup: ChapterConsultation,
  },
  {
    key: 'feedback',
    tab: 'Feedback',
    title: 'See exactly where you stand',
    copy: 'Domain-level scores on the three SCA marking criteria, and the moments that cost you marks.',
    chromeLabel: 'Feedback report',
    chromeMeta: 'Scored',
    Mockup: ChapterScore,
  },
] as const;

/**
 * Compact tabbed product tour as the page's dark rhythm-break: one browser-
 * chrome frame, three steps, gentle auto-advance.
 */
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
      className="relative overflow-hidden bg-[#1C1917] px-5 py-14 sm:px-8 sm:py-20"
      style={CROSSHATCH_DARK}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      onViewportEnter={() => setInView(true)}
      onViewportLeave={() => setInView(false)}
    >
      {/* Warm glow at the top of the dark band */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[720px] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(217,119,6,0.13) 0%, transparent 65%)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <Pill dark>How a station works</Pill>

        {/* Step tabs */}
        <div
          role="tablist"
          aria-label="Product tour steps"
          className="mx-auto mt-7 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/[0.06] p-1 sm:gap-1.5"
        >
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => selectStep(i)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors sm:px-4 sm:text-xs ${
                i === active ? 'bg-[#EF9F27] text-[#2C2C2A]' : 'text-stone-300 hover:bg-white/10'
              }`}
            >
              <span className="mr-1 opacity-60">{String(i + 1).padStart(2, '0')}</span>
              {s.tab}
            </button>
          ))}
        </div>

        {/* Step caption — read first, then the frame below. Same stacking
            trick to avoid height wobble between tabs. */}
        <div className="mt-6 grid">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.key}
              className="col-start-1 row-start-1"
              initial={false}
              animate={{ opacity: i === active ? 1 : 0 }}
              transition={{ duration: 0.24 }}
              aria-hidden={i !== active}
            >
              <p className="text-lg font-medium text-white sm:text-2xl">{s.title}</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-stone-400">
                {s.copy}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Product frame — all steps stacked in one grid cell so the frame
            keeps the tallest step's height and never jumps between tabs. */}
        <div className="mx-auto mt-8 grid w-full max-w-md text-left sm:max-w-lg">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.key}
              className="col-start-1 row-start-1 flex flex-col"
              initial={false}
              animate={{ opacity: i === active ? 1 : 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              style={{ pointerEvents: i === active ? 'auto' : 'none' }}
              aria-hidden={i !== active}
            >
              <Chrome
                label={s.chromeLabel}
                meta={s.chromeMeta}
                className="h-full border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.55)]"
              >
                <s.Mockup active={i === active} />
              </Chrome>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

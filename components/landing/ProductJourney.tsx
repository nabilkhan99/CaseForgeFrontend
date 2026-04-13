'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import ProductWindow from './ProductWindow';
import ChapterBrief from './ChapterBrief';
import ChapterConsultation from './ChapterConsultation';
import ChapterScore from './ChapterScore';
import ChapterProgress from './ChapterProgress';

const CHAPTERS = [
  {
    number: '01',
    heading: 'Read your patient brief',
    body: 'Every station starts with a scenario. You get the same information a real SCA candidate gets — presenting complaint, patient background, and your task.',
    timer: '08:00',
    details: null,
  },
  {
    number: '02',
    heading: 'Have the conversation',
    body: "Your patient responds in real-time with voice. They'll answer your questions, volunteer symptoms when prompted, and push back if you're vague — just like the real exam.",
    timer: '04:26',
    details: [
      'Real-time voice · Deepgram + Cartesia',
      'Adaptive emotional responses',
      '8-minute timed consultations',
    ],
  },
  {
    number: '03',
    heading: 'See exactly where you stand',
    body: 'Instant, domain-level feedback scored on the three SCA marking criteria. Know your strengths. Know what to fix.',
    timer: 'COMPLETE',
    details: null,
  },
  {
    number: '04',
    heading: 'Improve with every session',
    body: 'Your consultation history builds a picture of your growth. See trends across domains, revisit feedback, and focus your practice where it matters most.',
    timer: '—',
    details: null,
  },
];

const CHAPTER_CONTENT = [
  <ChapterBrief key="brief" />,
  <ChapterConsultation key="consultation" />,
  <ChapterScore key="score" />,
  <ChapterProgress key="progress" />,
];

export default function ProductJourney() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const chapterIndex = Math.min(
      Math.floor(latest * CHAPTERS.length),
      CHAPTERS.length - 1
    );
    setActiveChapter(chapterIndex);
  });

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    return (
      <section id="journey" className="py-16 px-6">
        <div className="max-w-[600px] mx-auto">
          {CHAPTERS.map((chapter, i) => (
            <motion.div
              key={i}
              className="mb-20 last:mb-0"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ type: 'spring', stiffness: 60, damping: 20 }}
            >
              <div className="mb-8">
                <span className="text-[36px] font-bold font-mono text-primary/30">
                  {chapter.number}
                </span>
                <h2 className="text-[28px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mt-2 mb-4">
                  {chapter.heading}
                </h2>
                <p className="text-[16px] text-muted leading-[1.7]">{chapter.body}</p>
                {chapter.details && (
                  <div className="mt-4 flex flex-col gap-1.5">
                    {chapter.details.map((detail, j) => (
                      <span key={j} className="text-[12px] text-muted flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/30 flex-shrink-0" />
                        {detail}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ProductWindow label="Station 14 · Mrs. Thompson" timer={chapter.timer}>
                {CHAPTER_CONTENT[i]}
              </ProductWindow>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="journey"
      ref={containerRef}
      className="relative"
      style={{ height: `${CHAPTERS.length * 100}vh` }}
    >
      <div className="sticky top-0 h-screen flex items-center">
        <div className="max-w-[1200px] mx-auto w-full px-6 grid grid-cols-2 gap-20 items-center">
          {/* Left: chapter text */}
          <div className="relative min-h-[300px]">
            {CHAPTERS.map((chapter, i) => (
              <motion.div
                key={i}
                className="absolute top-0 left-0 right-0"
                initial={false}
                animate={{
                  opacity: activeChapter === i ? 1 : 0,
                  y: activeChapter === i ? 0 : activeChapter > i ? -20 : 20,
                }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                style={{ pointerEvents: activeChapter === i ? 'auto' : 'none' }}
              >
                <span className="text-[36px] font-bold font-mono text-primary/30">
                  {chapter.number}
                </span>
                <h2 className="text-[36px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mt-2 mb-5">
                  {chapter.heading}
                </h2>
                <p className="text-[16px] text-muted leading-[1.7] max-w-[400px]">
                  {chapter.body}
                </p>
                {chapter.details && (
                  <div className="mt-6 flex flex-col gap-2">
                    {chapter.details.map((detail, j) => (
                      <motion.span
                        key={j}
                        className="text-[12px] text-muted flex items-center gap-2"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{
                          opacity: activeChapter === i ? 1 : 0,
                          x: activeChapter === i ? 0 : -8,
                        }}
                        transition={{ delay: 0.2 + j * 0.1 }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/30 flex-shrink-0" />
                        {detail}
                      </motion.span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Right: product window */}
          <div>
            <ProductWindow
              label="Station 14 · Mrs. Thompson"
              timer={CHAPTERS[activeChapter].timer}
            >
              <motion.div
                key={activeChapter}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
              >
                {CHAPTER_CONTENT[activeChapter]}
              </motion.div>
            </ProductWindow>
          </div>
        </div>
      </div>
    </section>
  );
}

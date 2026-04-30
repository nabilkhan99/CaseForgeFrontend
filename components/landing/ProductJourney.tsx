'use client';

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ProductWindow from './ProductWindow';
import ChapterBrief from './ChapterBrief';
import ChapterConsultation from './ChapterConsultation';
import ChapterScore from './ChapterScore';
import ChapterProgress from './ChapterProgress';

const CHAPTERS = [
  {
    number: '01',
    eyebrow: 'THE BRIEF',
    heading: 'Read your ',
    headingBold: 'patient brief',
    body: 'Every station starts with a scenario. You get the same information a real SCA candidate gets — presenting complaint, patient background and your task.',
  },
  {
    number: '02',
    eyebrow: 'THE CONSULTATION',
    heading: 'Have the ',
    headingBold: 'conversation',
    body: "Your patient responds in real-time with voice. They'll answer your questions, volunteer symptoms when prompted, and push back if you're vague — just like the real exam.",
  },
  {
    number: '03',
    eyebrow: 'THE FEEDBACK',
    heading: 'See exactly ',
    headingBold: 'where you stand',
    body: 'Instant, domain-level feedback scored on the three SCA marking criteria. Know your strengths. Know what to fix.',
  },
  {
    number: '04',
    eyebrow: 'THE PROGRESS',
    heading: 'Improve with ',
    headingBold: 'every station',
    body: 'Your consultation history builds a picture of your growth. See trends across domains, revisit feedback, and focus your practice where it matters most.',
  },
];

const CHAPTER_CONTENT = [
  <ChapterBrief key="brief" />,
  <ChapterConsultation key="consultation" />,
  <ChapterScore key="score" />,
  <ChapterProgress key="progress" />,
];

export default function ProductJourney() {
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const observers: (IntersectionObserver | null)[] = sectionRefs.current.map((ref, i) => {
      if (!ref) return null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(i);
        },
        { threshold: 0.4 }
      );
      observer.observe(ref);
      return observer;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <section id="journey" className="py-14 lg:py-0">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-5">
        {CHAPTERS.map((chapter, i) => (
          <div
            key={i}
            ref={el => { sectionRefs.current[i] = el; }}
            className="py-14 lg:py-24"
          >
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ type: 'spring', stiffness: 50, damping: 20 }}
            >
              {/* ==================== DESKTOP ==================== */}
              <div className="hidden lg:grid lg:grid-cols-[440px_420px] gap-24 items-center justify-between">
                {/* Left column: thread + text */}
                <div className="flex gap-6">
                  {/* Thread strip — the line + node */}
                  <div className="flex flex-col items-center pt-1 shrink-0" style={{ width: 28 }}>
                    {/* Node: dot when active, hollow when not */}
                    <div
                      className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                        activeSection === i
                          ? 'bg-accent-soft border-accent-soft scale-110'
                          : 'bg-transparent border-border-card'
                      }`}
                    />
                    {/* Thread line segment below the node */}
                    {i < CHAPTERS.length - 1 && (
                      <div className="flex-1 w-px bg-border-card mt-2" />
                    )}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    {/* Step number */}
                    <span
                      className={`text-[28px] font-medium block leading-none transition-opacity duration-300 ${
                        activeSection === i ? 'text-accent-soft' : 'text-accent-soft/40'
                      }`}
                    >
                      {chapter.number}
                    </span>
                    {/* Eyebrow */}
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-accent-primary mt-3 mb-3">
                      {chapter.eyebrow}
                    </span>
                    {/* Headline */}
                    <h2 className="text-[44px] font-semibold text-text-primary leading-[1.1] mb-5">
                      {chapter.heading}<strong className="font-bold">{chapter.headingBold}</strong>
                    </h2>
                    {/* Body */}
                    <p className="text-lg text-text-secondary leading-[1.5] max-w-[400px]">
                      {chapter.body}
                    </p>
                  </div>
                </div>

                {/* Right column: card */}
                <div>
                  <ProductWindow label="" timer="">
                    {CHAPTER_CONTENT[i]}
                  </ProductWindow>
                </div>
              </div>

              {/* ==================== MOBILE ==================== */}
              <div className="lg:hidden flex flex-col gap-4">
                {/* Inline step number + eyebrow */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-accent-soft">{chapter.number}</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-primary">
                    · {chapter.eyebrow}
                  </span>
                </div>
                {/* Headline */}
                <h2 className="text-[32px] font-semibold text-text-primary leading-[1.1]">
                  {chapter.heading}<strong className="font-bold">{chapter.headingBold}</strong>
                </h2>
                {/* Body */}
                <p className="text-base text-text-secondary leading-[1.5]">
                  {chapter.body}
                </p>
                {/* Card */}
                <div className="w-full">
                  <ProductWindow label="" timer="">
                    {CHAPTER_CONTENT[i]}
                  </ProductWindow>
                </div>
              </div>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}

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
        { threshold: 0.5 }
      );
      observer.observe(ref);
      return observer;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <section id="journey" className="py-14 lg:py-0">
      <div className="max-w-[1200px] mx-auto px-6 relative">
        {/* Vertical thread — desktop only */}
        <div className="hidden lg:block absolute left-[38px] top-24 bottom-24 w-px bg-border-card" />

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
              {/* Desktop: two columns */}
              <div className="hidden lg:grid lg:grid-cols-[440px_1fr] gap-24 items-center">
                {/* Left: step number + eyebrow + headline + body */}
                <div className="relative">
                  {/* Step number with thread node */}
                  <div className="relative">
                    <span
                      className={`text-[28px] font-medium transition-opacity duration-300 ${
                        activeSection === i ? 'text-accent-soft opacity-100' : 'text-accent-soft/50'
                      }`}
                    >
                      {chapter.number}
                    </span>
                    {/* Active dot on thread */}
                    {activeSection === i && (
                      <span className="absolute -left-[26px] top-[14px] w-[9px] h-[9px] rounded-full bg-accent-soft hidden lg:block" />
                    )}
                  </div>
                  {/* Eyebrow */}
                  <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-accent-primary mt-2 mb-3">
                    {chapter.eyebrow}
                  </span>
                  {/* Headline */}
                  <h2 className="text-[44px] font-semibold text-text-primary leading-[1.1] mb-5">
                    {chapter.heading}<strong className="font-bold">{chapter.headingBold}</strong>
                  </h2>
                  {/* Body */}
                  <p className="text-lg text-text-secondary leading-relaxed max-w-[400px]">
                    {chapter.body}
                  </p>
                </div>

                {/* Right: card */}
                <div className="max-w-[420px]">
                  <ProductWindow label="Fourteen Fisherman" timer="">
                    {CHAPTER_CONTENT[i]}
                  </ProductWindow>
                </div>
              </div>

              {/* Mobile: stacked */}
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
                <p className="text-base text-text-secondary leading-relaxed">
                  {chapter.body}
                </p>
                {/* Card */}
                <div className="w-full">
                  <ProductWindow label="Fourteen Fisherman" timer="">
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

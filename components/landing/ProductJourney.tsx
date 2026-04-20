'use client';

import { motion } from 'framer-motion';
import ProductWindow from './ProductWindow';
import ChapterBrief from './ChapterBrief';
import ChapterConsultation from './ChapterConsultation';
import ChapterScore from './ChapterScore';
import ChapterProgress from './ChapterProgress';

const CHAPTERS = [
  {
    number: '01',
    heading: 'Read your patient brief',
    body: 'Every station starts with a scenario. You get the same information a real SCA candidate gets — presenting complaint, patient background and your task.',
    timer: '12:00',
    details: null,
  },
  {
    number: '02',
    heading: 'Have the conversation',
    body: "Your patient responds in real-time with voice. They'll answer your questions, volunteer symptoms when prompted, and push back if you're vague — just like the real exam.",
    timer: '06:26',
    details: [
      'Real-time voice · Deepgram + Cartesia',
      'Adaptive emotional responses',
      '12-minute timed consultations',
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
    heading: 'Improve with every station',
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
  return (
    <section id="journey" className="py-16 lg:py-24">
      <div className="max-w-[1200px] mx-auto px-6 space-y-16 lg:space-y-28">
        {CHAPTERS.map((chapter, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
          >
            {/* Desktop: two columns */}
            <div className="hidden lg:grid grid-cols-2 gap-20 items-start">
              {/* Left: chapter text */}
              <div>
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
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + j * 0.1 }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/30 flex-shrink-0" />
                        {detail}
                      </motion.span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: product window */}
              <div>
                <ProductWindow label="Fourteen Fisherman" timer={chapter.timer}>
                  {CHAPTER_CONTENT[i]}
                </ProductWindow>
              </div>
            </div>

            {/* Mobile/Tablet: stacked — heading first, then visual */}
            <div className="lg:hidden flex flex-col gap-4 max-w-[500px] mx-auto">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[24px] font-bold font-mono text-primary/30">
                    {chapter.number}
                  </span>
                  <h2 className="text-[22px] font-bold text-heading tracking-[-0.02em] leading-[1.15]">
                    {chapter.heading}
                  </h2>
                </div>
                <p className="text-[14px] text-muted leading-[1.7]">{chapter.body}</p>
                {chapter.details && (
                  <div className="mt-3 hidden lg:flex flex-wrap gap-x-4 gap-y-1">
                    {chapter.details.map((detail, j) => (
                      <span key={j} className="text-[11px] text-muted flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary/30 flex-shrink-0" />
                        {detail}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ProductWindow label="Fourteen Fisherman" timer={chapter.timer}>
                {CHAPTER_CONTENT[i]}
              </ProductWindow>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

'use client';

import { motion } from 'framer-motion';

const TESTIMONIALS = [
  {
    initials: 'SC',
    quote:
      'I failed my first SCA attempt. After two weeks of practising on here I passed comfortably. The AI feedback pinpointed exactly what I was missing.',
    name: 'Dr. Sarah Chen',
    meta: 'ST3 · London',
  },
  {
    initials: 'JM',
    quote:
      "It's the closest thing to a real consultation I've found. The patients actually push back when you're being vague.",
    name: 'Dr. James Mwangi',
    meta: 'ST2 · Birmingham',
  },
  {
    initials: 'RP',
    quote:
      'The domain-level scoring changed how I prepare. I stopped guessing and started targeting my weak areas.',
    name: 'Dr. Riya Patel',
    meta: 'ST3 · Manchester',
  },
];

const STATS = [
  { value: '340+', label: 'Trainees practising' },
  { value: '22', label: 'Deaneries' },
  { value: '4,200+', label: 'Sessions completed' },
  { value: '89%', label: 'Pass rate' },
];

export default function SocialProof() {
  return (
    <section className="py-[60px] px-6">
      <div className="max-w-[680px] mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <span className="text-[10px] font-mono font-semibold tracking-[0.12em] uppercase text-primary block mb-4">
            What Trainees Say
          </span>
          <h2 className="text-[28px] sm:text-[36px] font-bold text-heading tracking-[-0.02em] leading-[1.15]">
            Real results from real trainees
          </h2>
        </motion.div>

        {/* Testimonials — simple flowing list with dividers */}
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={i}
            className={
              i < TESTIMONIALS.length - 1
                ? 'pb-8 mb-8 border-b border-black/[0.06]'
                : 'mb-10'
            }
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', stiffness: 60, damping: 20, delay: i * 0.1 }}
          >
            <p className="text-[20px] sm:text-[24px] font-medium text-heading leading-[1.55] mb-4">
              {t.quote}
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
              >
                {t.initials}
              </div>
              <span className="text-[13px] text-muted">
                {t.name}, {t.meta}
              </span>
            </div>
          </motion.div>
        ))}

        {/* Stats row — single line */}
        <motion.div
          className="grid grid-cols-4 gap-0 border-t border-black/[0.06] pt-8"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center ${i > 0 ? 'border-l border-black/[0.06]' : ''}`}
            >
              <div className="text-[22px] sm:text-[28px] font-bold text-heading mb-0.5">
                {stat.value}
              </div>
              <div className="text-[10px] sm:text-[12px] text-muted">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

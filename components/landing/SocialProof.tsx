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

export default function SocialProof() {
  return (
    <section className="py-[120px] px-6">
      <div className="max-w-[680px] mx-auto">
        {/* Section label */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-[10px] font-mono font-semibold tracking-[0.12em] uppercase text-primary">
            What Trainees Say
          </span>
        </motion.div>

        {/* Testimonials */}
        {TESTIMONIALS.map((t, i) => (
          <motion.div
            key={i}
            className={
              i < TESTIMONIALS.length - 1
                ? 'pb-12 mb-12 border-b border-black/[0.06]'
                : ''
            }
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', stiffness: 60, damping: 20, delay: i * 0.1 }}
          >
            <p className="text-[24px] font-medium text-heading leading-[1.6] mb-4">
              {t.quote}
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
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

        {/* Stat line */}
        <motion.p
          className="text-center mt-10 text-[16px] text-muted"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <span className="text-[20px] font-semibold text-primary">340+</span> trainees
          practising across{' '}
          <span className="text-[20px] font-semibold text-primary">22</span> deaneries
        </motion.p>
      </div>
    </section>
  );
}

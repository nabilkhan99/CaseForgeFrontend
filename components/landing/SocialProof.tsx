'use client';

import { motion } from 'framer-motion';

const FEATURED = {
  initials: 'SC',
  quote:
    'I failed my first SCA attempt. After two weeks of practising on here I passed comfortably. The AI feedback pinpointed exactly what I was missing.',
  name: 'Dr. Sarah Chen',
  meta: 'ST3 · London',
  outcome: 'Score: 42 → 78',
};

const TESTIMONIALS = [
  {
    initials: 'JM',
    quote:
      "It's the closest thing to a real consultation I've found. The patients actually push back when you're being vague.",
    name: 'Dr. James Mwangi',
    meta: 'ST2 · Birmingham',
    outcome: 'Passed first attempt',
  },
  {
    initials: 'RP',
    quote:
      'The domain-level scoring changed how I prepare. I stopped guessing and started targeting my weak areas.',
    name: 'Dr. Riya Patel',
    meta: 'ST3 · Manchester',
    outcome: '12 sessions to pass',
  },
];

export default function SocialProof() {
  return (
    <section className="py-20 px-6">
      <div
        className="max-w-[1000px] mx-auto rounded-3xl px-8 py-14 sm:px-12 sm:py-16"
        style={{
          background:
            'linear-gradient(160deg, rgba(180,83,9,0.03) 0%, rgba(245,158,11,0.05) 50%, rgba(180,83,9,0.02) 100%)',
        }}
      >
        {/* Section header */}
        <motion.div
          className="text-center mb-14"
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

        {/* Featured testimonial */}
        <motion.div
          className="relative bg-white/80 backdrop-blur-sm rounded-2xl border border-black/[0.06] p-6 sm:p-8 md:p-10 mb-6"
          style={{ boxShadow: '0 8px 32px rgba(180,83,9,0.04)' }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 50, damping: 20 }}
        >
          <span className="text-6xl font-serif text-primary/15 leading-none select-none absolute top-4 left-6">
            &ldquo;
          </span>
          <p className="text-[20px] sm:text-[22px] font-medium text-heading leading-[1.6] mt-4 mb-8 max-w-[640px] mx-auto text-center">
            {FEATURED.quote}
          </p>
          <div className="flex items-center justify-center gap-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
            >
              {FEATURED.initials}
            </div>
            <div>
              <div className="text-[14px] font-semibold text-heading">{FEATURED.name}</div>
              <div className="text-[12px] text-muted">{FEATURED.meta}</div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-black/[0.08] mx-2" />
            <span
              className="hidden sm:inline-flex px-3 py-1.5 rounded-full text-[11px] font-bold"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}
            >
              {FEATURED.outcome}
            </span>
          </div>
        </motion.div>

        {/* Two smaller testimonials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              className="bg-white/60 backdrop-blur-sm rounded-2xl border border-black/[0.06] p-6 flex flex-col"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.15 + i * 0.1 }}
            >
              <span className="text-3xl font-serif text-primary/10 leading-none select-none">
                &ldquo;
              </span>
              <p className="text-[16px] font-medium text-heading leading-[1.6] mt-1 mb-6 flex-1">
                {t.quote}
              </p>
              <div className="flex items-center gap-3 mt-auto">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
                >
                  {t.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-heading">{t.name}</div>
                  <div className="text-[11px] text-muted">{t.meta}</div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
                  style={{ background: 'rgba(34,197,94,0.08)', color: '#16A34A' }}
                >
                  {t.outcome}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

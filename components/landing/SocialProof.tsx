'use client';

import { motion } from 'framer-motion';

const TESTIMONIALS = [
  {
    initials: 'SC',
    quote:
      'I failed my first SCA attempt. After two weeks of practising on here I passed comfortably. The AI feedback pinpointed exactly what I was missing.',
    name: 'Dr. Sarah Chen',
    role: 'ST3 · GP Trainee',
    location: 'London',
    score: { before: 48, after: 76 },
    highlight: 'Failed → Passed',
  },
  {
    initials: 'JM',
    quote:
      "It's the closest thing to a real consultation I've found. The patients actually push back when you're being vague — exactly like the exam.",
    name: 'Dr. James Mwangi',
    role: 'ST2 · GP Trainee',
    location: 'Birmingham',
    score: null,
    highlight: '23 sessions completed',
  },
  {
    initials: 'RP',
    quote:
      'The domain-level scoring changed how I prepare. I stopped guessing and started targeting my weak areas. My interpersonal skills jumped 20 points.',
    name: 'Dr. Riya Patel',
    role: 'ST3 · GP Trainee',
    location: 'Manchester',
    score: { before: 61, after: 84 },
    highlight: '+23 point improvement',
  },
];

const STATS = [
  { value: '340+', label: 'Trainees practising' },
  { value: '22', label: 'Deaneries' },
  { value: '4,200+', label: 'Sessions completed' },
  { value: '89%', label: 'Pass rate after 10+ sessions' },
];

export default function SocialProof() {
  return (
    <section className="py-[80px] px-6">
      <div className="max-w-[900px] mx-auto">
        {/* Section header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <span className="text-[10px] font-mono font-semibold tracking-[0.12em] uppercase text-primary block mb-4">
            What Trainees Say
          </span>
          <h2 className="text-[36px] font-bold text-heading tracking-[-0.02em] leading-[1.15]">
            Real results from real trainees
          </h2>
        </motion.div>

        {/* Featured testimonial — large, prominent */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <div className="relative">
            {/* Large amber quotation mark */}
            <div
              className="absolute -top-6 -left-2 text-[80px] font-serif leading-none select-none"
              style={{
                background: 'linear-gradient(135deg, #B45309, #F59E0B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: 0.15,
              }}
            >
              &ldquo;
            </div>
            <p className="text-[28px] sm:text-[32px] font-medium text-heading leading-[1.5] mb-6 relative z-10">
              {TESTIMONIALS[0].quote}
            </p>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[14px] font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B, #B45309)',
                  boxShadow: '0 4px 12px rgba(180,83,9,0.2)',
                }}
              >
                {TESTIMONIALS[0].initials}
              </div>
              <div>
                <div className="text-[14px] font-semibold text-heading">{TESTIMONIALS[0].name}</div>
                <div className="text-[12px] text-muted">
                  {TESTIMONIALS[0].role} · {TESTIMONIALS[0].location}
                </div>
              </div>
            </div>

            {/* Score improvement badge */}
            {TESTIMONIALS[0].score && (
              <motion.div
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(180,83,9,0.04)', border: '1px solid rgba(180,83,9,0.08)' }}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <div className="text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wide">Before</div>
                  <div className="text-[18px] font-bold text-stone-400 line-through">
                    {TESTIMONIALS[0].score.before}
                  </div>
                </div>
                <svg width="20" height="12" viewBox="0 0 20 12" fill="none" className="text-primary">
                  <path d="M1 6h16M13 1l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="text-center">
                  <div className="text-[10px] text-muted uppercase tracking-wide">After</div>
                  <div className="text-[18px] font-bold text-primary">{TESTIMONIALS[0].score.after}</div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Two smaller testimonials side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
          {TESTIMONIALS.slice(1).map((t, i) => (
            <motion.div
              key={i}
              className="relative"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ type: 'spring', stiffness: 60, damping: 20, delay: i * 0.15 }}
            >
              {/* Highlight pill */}
              <div
                className="inline-flex px-3 py-1 rounded-full text-[10px] font-semibold mb-4"
                style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
              >
                {t.highlight}
              </div>

              <p className="text-[18px] font-medium text-heading leading-[1.6] mb-5">
                {t.quote}
              </p>

              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-heading">{t.name}</div>
                  <div className="text-[11px] text-muted">
                    {t.role} · {t.location}
                  </div>
                </div>
              </div>

              {/* Score badge for Riya */}
              {t.score && (
                <motion.div
                  className="mt-4 flex items-center gap-2 text-[12px]"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                >
                  <span className="font-mono text-stone-400 line-through">{t.score.before}</span>
                  <span className="text-muted">→</span>
                  <span className="font-mono font-bold text-primary">{t.score.after}</span>
                  <span className="text-success text-[11px] font-semibold">
                    +{t.score.after - t.score.before} pts
                  </span>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Stats bar */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className={`text-center ${
                i > 0 ? 'sm:border-l sm:border-black/[0.06]' : ''
              }`}
            >
              <motion.div
                className="text-[28px] font-bold text-heading mb-1"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.1 }}
              >
                {stat.value}
              </motion.div>
              <div className="text-[12px] text-muted">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

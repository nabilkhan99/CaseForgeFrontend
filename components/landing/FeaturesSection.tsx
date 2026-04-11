'use client';

import { motion } from 'framer-motion';

const features = [
  {
    num: '01',
    title: 'Voice consultations',
    description: 'Speak naturally to AI patients who respond like real people. Each case adapts to your questioning style. Conversations branch based on what you ask — no scripts, no rails.',
  },
  {
    num: '02',
    title: 'Instant SCA scoring',
    description: 'After every session, get scored across all three SCA domains — data gathering, clinical management, and interpersonal skills. See exactly what you did well and what to fix.',
  },
  {
    num: '03',
    title: 'RCGP curriculum coverage',
    description: '78 cases spanning all 12 curriculum domains and 26 specialties. A visual map shows what you\'ve mastered, what needs work, and where to practice next.',
  },
];

function VoiceVisualisation() {
  return (
    <div className="flex items-end gap-[3px] h-12">
      {[0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72].map((delay, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-primary animate-pulse"
          style={{
            animationDelay: `${delay}s`,
            animationDuration: '1.2s',
            height: `${20 + Math.sin(i * 1.2) * 60}%`,
            opacity: 0.3 + Math.sin(i * 1.2) * 0.4,
          }}
        />
      ))}
    </div>
  );
}

function ScoringVisualisation() {
  return (
    <div className="flex gap-3 items-end h-14">
      <div className="w-6 rounded-t bg-primary/70" style={{ height: '70%' }} />
      <div className="w-6 rounded-t bg-primary-lighter/60" style={{ height: '55%' }} />
      <div className="w-6 rounded-t bg-primary/80" style={{ height: '85%' }} />
    </div>
  );
}

function CoverageVisualisation() {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[0.6, 0.3, 0.15, 0.8, 0.2, 0.5, 0.7, 0.1, 0.4, 0.3, 0.6, 0.9].map((opacity, i) => (
        <div
          key={i}
          className="w-4 h-4 rounded"
          style={{ background: opacity > 0.4 ? `rgba(22,163,74,${opacity})` : `rgba(180,83,9,${opacity})` }}
        />
      ))}
    </div>
  );
}

const visualisations = [
  <VoiceVisualisation key="voice" />,
  <ScoringVisualisation key="scoring" />,
  <CoverageVisualisation key="coverage" />,
];

export default function FeaturesSection() {
  return (
    <section className="max-w-[1200px] mx-auto px-12 py-[100px]">
      {/* Divider with label */}
      <div className="flex items-center gap-4 mb-0">
        <div className="flex-1 h-px bg-black/[0.06]" />
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted whitespace-nowrap">How it works</span>
        <div className="flex-1 h-px bg-black/[0.06]" />
      </div>

      {/* Section intro — LEFT aligned, not centered */}
      <div className="max-w-[500px] mt-[100px] mb-20">
        <h2 className="text-[44px] font-extrabold text-heading tracking-[-0.04em] leading-[1.05] mb-4">
          Three things.<br />One platform.
        </h2>
        <p className="text-[16px] text-[#78716C] leading-[1.7]">
          Practice consultations, get instant scores, and track your coverage across the entire RCGP curriculum.
        </p>
      </div>

      {/* Feature rows */}
      <div className="flex flex-col">
        {features.map((feature, index) => (
          <motion.div
            key={feature.num}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: index * 0.1 }}
            className="flex items-start gap-12 py-12 border-t border-black/[0.06] transition-colors hover:bg-gradient-to-r hover:from-primary/[0.02] hover:to-transparent group"
          >
            <span className="font-mono text-5xl font-bold text-primary/[0.12] leading-none min-w-[80px] tracking-[-0.03em]">
              {feature.num}
            </span>
            <div className="flex-1">
              <h3 className="text-[22px] font-bold text-heading tracking-[-0.02em] mb-2">{feature.title}</h3>
              <p className="text-[14px] text-[#78716C] leading-[1.7] max-w-[480px]">{feature.description}</p>
            </div>
            <div className="flex-[0.6] flex justify-end items-center">
              {visualisations[index]}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

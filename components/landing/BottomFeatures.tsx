'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const SPECIALTIES_ROW1 = [
  'Cardiovascular Health', 'Dermatology', 'Mental Health', 'Neurology',
  'Respiratory Health', 'Musculoskeletal Health', 'Ophthalmology', 'Gastroenterology', 'Genetics',
];
const SPECIALTIES_ROW2 = [
  'Haematology', 'Renal and Urology', 'Maternity and Reproductive Health',
  'Sexual Health', 'Ear, Nose and Throat', 'Metabolic Problems and Endocrinology',
  'Older Adults', 'People at the End of Life', 'Learning Disability',
];

function FeatureRow({
  label,
  heading,
  body,
  cta,
  href,
  children,
  index,
}: {
  label: string;
  heading: string;
  body: string;
  cta: string;
  href: string;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ type: 'spring', stiffness: 50, damping: 20 }}
    >
      {/* Desktop: two columns */}
      <div className="hidden lg:grid grid-cols-2 gap-20 items-start">
        {/* Text — left on even rows, right on odd rows */}
        <div className={index % 2 === 1 ? 'order-2' : ''}>
          <span className="text-[10px] font-mono font-semibold tracking-[0.12em] uppercase text-primary block mb-3">
            {label}
          </span>
          <h2 className="text-[32px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mb-4">
            {heading}
          </h2>
          <p className="text-[16px] text-muted leading-[1.7] max-w-[420px] mb-6">
            {body}
          </p>
          <Link href={href}>
            <motion.div
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold text-primary border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/[0.03] transition-all cursor-pointer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              {cta}
            </motion.div>
          </Link>
        </div>

        {/* Visual — right column */}
        <div className={index % 2 === 1 ? 'order-1' : ''}>
          {children}
        </div>
      </div>

      {/* Mobile: stacked */}
      <div className="lg:hidden">
        <span className="text-[10px] font-mono font-semibold tracking-[0.12em] uppercase text-primary block mb-3">
          {label}
        </span>
        <h2 className="text-[24px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mb-3">
          {heading}
        </h2>
        <p className="text-[14px] text-muted leading-[1.7] mb-5">
          {body}
        </p>
        <div className="mb-5">{children}</div>
        <Link href={href}>
          <div className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold text-primary border-2 border-primary/20">
            {cta}
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

function CarouselVisual() {
  return (
    <div
      className="rounded-[20px] overflow-hidden border border-black/[0.06] p-6"
      style={{ background: '#FFFCF8', boxShadow: '0 24px 64px rgba(180,83,9,0.06)' }}
    >
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-4">
        18 specialties covered
      </div>
      <div className="space-y-2.5 overflow-hidden">
        <div className="flex gap-2.5 motion-safe:animate-scroll-left">
          {[...SPECIALTIES_ROW1, ...SPECIALTIES_ROW1].map((s, i) => (
            <div
              key={i}
              className="flex-shrink-0 px-3.5 py-2 rounded-lg bg-white border border-black/[0.06] text-[12px] text-body font-medium whitespace-nowrap"
            >
              {s}
            </div>
          ))}
        </div>
        <div className="flex gap-2.5 motion-safe:animate-scroll-right">
          {[...SPECIALTIES_ROW2, ...SPECIALTIES_ROW2].map((s, i) => (
            <div
              key={i}
              className="flex-shrink-0 px-3.5 py-2 rounded-lg bg-white border border-black/[0.06] text-[12px] text-body font-medium whitespace-nowrap"
            >
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PracticeVisual() {
  return (
    <div
      className="rounded-[20px] overflow-hidden border border-black/[0.06] p-6"
      style={{ background: '#FFFCF8', boxShadow: '0 24px 64px rgba(180,83,9,0.06)' }}
    >
      <div className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-4">
        Built-in tools
      </div>
      {/* Mini timer */}
      <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-white border border-black/[0.06]">
        <div className="font-mono text-[28px] font-bold text-heading tracking-tight">12:00</div>
        <div className="flex-1">
          <div className="text-[11px] font-semibold text-amber-700 mb-1">Golden Minute</div>
          <div className="h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
            <div className="h-full w-[8%] rounded-full" style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }} />
          </div>
        </div>
      </div>
      {/* Mini mark scheme */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <div className="w-4 h-4 rounded border-2 border-emerald-300 bg-white flex-shrink-0" />
            <span className="text-[10px] text-body leading-tight">Explores patient concerns</span>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-red-50/50 border border-red-100">
            <div className="w-4 h-4 rounded border-2 border-red-300 bg-white flex-shrink-0" />
            <span className="text-[10px] text-body leading-tight">Fails to establish rapport</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <div className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500 flex-shrink-0 flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span className="text-[10px] text-emerald-800 leading-tight">Asks about red flags</span>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-red-50/50 border border-red-100">
            <div className="w-4 h-4 rounded border-2 border-red-300 bg-white flex-shrink-0" />
            <span className="text-[10px] text-body leading-tight">Misses safety netting</span>
          </div>
        </div>
      </div>
      <div className="mt-3 text-center">
        <span className="text-[10px] font-semibold text-primary bg-primary/[0.06] px-3 py-1 rounded-lg">
          2 / 8 indicators checked
        </span>
      </div>
    </div>
  );
}

function PortfolioVisual() {
  const collapsedSections: { label: string; icon: React.ReactNode }[] = [
    { label: 'Capabilities', icon: <span className="text-[12px] leading-none">🎯</span> },
    { label: 'Learning Needs', icon: <span className="text-[12px] leading-none">📒</span> },
    {
      label: 'Reflection',
      icon: (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="rounded-[20px] overflow-hidden border border-black/[0.06]"
      style={{ background: '#FFFCF8', boxShadow: '0 24px 64px rgba(180,83,9,0.06)' }}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-black/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[11px] font-mono text-primary">Portfolio AI</span>
        </div>
        <span className="text-[9px] font-mono text-muted uppercase tracking-wider">RCGP · Standard</span>
      </div>

      <div className="p-5 space-y-2.5">
        {/* Case title bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-black/[0.06]">
          <div className="text-[12px] font-semibold text-heading leading-tight">
            Acute Heart Failure Presentation
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-600">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-[9px] font-semibold text-emerald-700">Ready</span>
          </div>
        </div>

        {/* Brief Description — expanded */}
        <div
          className="p-3 rounded-xl border border-primary/10"
          style={{ background: 'linear-gradient(135deg, rgba(180,83,9,0.04), rgba(245,158,11,0.06))' }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] leading-none">📝</span>
              <span className="text-[10px] font-semibold text-heading uppercase tracking-wider">Brief Description</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold text-primary">Copy</span>
              <span className="text-[9px] text-muted">·</span>
              <span className="text-[9px] font-semibold text-primary">Improve</span>
            </div>
          </div>
          <div className="text-[10px] text-body leading-[1.65]">
            Middle-aged gentleman with classic features of new-onset heart failure. Progressive exertional dyspnoea with peripheral oedema over three weeks on a background of hypertension and T2DM...
          </div>
        </div>

        {/* Collapsed sections */}
        {collapsedSections.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-black/[0.06]"
          >
            <div className="flex items-center gap-1.5">
              {s.icon}
              <span className="text-[10px] font-semibold text-body">{s.label}</span>
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BottomFeatures() {
  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-[1200px] mx-auto px-6 space-y-16 lg:space-y-28">
        <FeatureRow
          index={0}
          label="Comprehensive Coverage"
          heading="200+ RCGP mapped stations"
          body="Every case mapped to the RCGP curriculum. Practice across every specialty you will face in the SCA — from cardiovascular to mental health."
          cta="Browse Case Library →"
          href="/cases"
        >
          <CarouselVisual />
        </FeatureRow>

        <FeatureRow
          index={1}
          label="Free Forever"
          heading="Practice with a friend"
          body="Every case comes with candidate briefs, patient scripts, and marking schemes. One of you plays the doctor, the other reads the patient script. Use the built-in timer and mark scheme to score each other in real time."
          cta="Practice Free Cases →"
          href="/cases"
        >
          <PracticeVisual />
        </FeatureRow>

        <FeatureRow
          index={2}
          label="Old Favourite"
          heading="The portfolio tool you already use"
          body="Over 20% of GP trainees in the UK already use our AI to write RCGP-standard clinical case reviews. Describe your case, select your capabilities, and get a structured review ready to submit — in seconds."
          cta="Open Portfolio Tool →"
          href="/portfolio"
        >
          <PortfolioVisual />
        </FeatureRow>
      </div>
    </section>
  );
}

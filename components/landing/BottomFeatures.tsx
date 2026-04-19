'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface SpecialtyItem {
  name: string;
  icon: React.ReactNode;
}

const SPECIALTIES_ROW1: SpecialtyItem[] = [
  { name: 'Cardiovascular', icon: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /> },
  { name: 'Dermatology', icon: <><path d="M7 11.5V14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2.5" /><path d="M12 2v4" /><circle cx="12" cy="9" r="3" /></> },
  { name: 'Mental Health', icon: <><path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20h6v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z" /><path d="M12 6v6" /><path d="M9.5 9h5" /></> },
  { name: 'Neurology', icon: <><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><path d="M12 6v2" /><path d="M12 16v2" /><path d="M8 12H6" /><path d="M18 12h-2" /></> },
  { name: 'Respiratory', icon: <><path d="M6.081 20C2.6 20 2 16.5 2 14c0-3 1.5-5 4-6" /><path d="M17.92 20c3.48 0 4.08-3.5 4.08-6 0-3-1.5-5-4-6" /><path d="M12 2v10" /><path d="M8 8l4 4 4-4" /></> },
  { name: 'Musculoskeletal', icon: <><path d="M12 2v8" /><path d="M4.93 10.93l2.83 2.83" /><path d="M16.24 10.93l-2.83 2.83" /><path d="M7.76 16.24l2.83 2.83" /><path d="M13.41 16.24l-2.83 2.83" /></> },
  { name: 'Ophthalmology', icon: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></> },
  { name: 'Gastroenterology', icon: <><ellipse cx="12" cy="12" rx="8" ry="5" /><path d="M12 7v10" /></> },
  { name: 'Genetics', icon: <><path d="M8 2s4 4 4 10-4 10-4 10" /><path d="M16 2s-4 4-4 10 4 10 4 10" /><path d="M5 7h14" /><path d="M5 17h14" /></> },
];

const SPECIALTIES_ROW2: SpecialtyItem[] = [
  { name: 'Haematology', icon: <><path d="M12 2c0 0-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z" /></> },
  { name: 'Renal & Urology', icon: <><path d="M8 2c-2 2-3 5-3 8s1 6 3 8" /><path d="M16 2c2 2 3 5 3 8s-1 6-3 8" /><path d="M12 6v12" /></> },
  { name: 'Maternity', icon: <><circle cx="12" cy="8" r="5" /><path d="M7 20c0-3 2-5 5-5s5 2 5 5" /></> },
  { name: 'Sexual Health', icon: <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /><path d="M12 8v8" /></> },
  { name: 'ENT', icon: <><path d="M5.5 8.5A4.5 4.5 0 0 1 10 4" /><path d="M3 12a9 9 0 0 0 18 0" /><path d="M12 12v6" /></> },
  { name: 'Endocrinology', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v4" /><path d="M12 18v4" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /><path d="M2 12h4" /><path d="M18 12h4" /></> },
  { name: 'Older Adults', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></> },
  { name: 'End of Life', icon: <><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></> },
  { name: 'Learning Disability', icon: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></> },
];

function SpecialtyPill({ item }: { item: SpecialtyItem }) {
  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-black/[0.06] whitespace-nowrap">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary flex-shrink-0"
      >
        {item.icon}
      </svg>
      <span className="text-[12px] text-body font-medium">{item.name}</span>
    </div>
  );
}

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
        27 curriculum topics covered
      </div>
      <div className="space-y-2.5 overflow-hidden">
        <div className="flex gap-2.5 motion-safe:animate-scroll-left">
          {[...SPECIALTIES_ROW1, ...SPECIALTIES_ROW1].map((s, i) => (
            <SpecialtyPill key={i} item={s} />
          ))}
        </div>
        <div className="flex gap-2.5 motion-safe:animate-scroll-right">
          {[...SPECIALTIES_ROW2, ...SPECIALTIES_ROW2].map((s, i) => (
            <SpecialtyPill key={i} item={s} />
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
      {/* Mini mark scheme — specific indicators */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <div className="w-4 h-4 rounded border-2 border-emerald-300 bg-white flex-shrink-0" />
            <span className="text-[10px] text-body leading-tight">Explores patient&apos;s ICE</span>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-red-50/50 border border-red-100">
            <div className="w-4 h-4 rounded border-2 border-red-300 bg-white flex-shrink-0" />
            <span className="text-[10px] text-body leading-tight">Uses closed questions only</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <div className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500 flex-shrink-0 flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span className="text-[10px] text-emerald-800 leading-tight">Asks about red flag symptoms</span>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-red-50/50 border border-red-100">
            <div className="w-4 h-4 rounded border-2 border-red-300 bg-white flex-shrink-0" />
            <span className="text-[10px] text-body leading-tight">Fails to safety-net the patient</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <div className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500 flex-shrink-0 flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <span className="text-[10px] text-emerald-800 leading-tight">Shares working diagnosis clearly</span>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-red-50/50 border border-red-100">
            <div className="w-4 h-4 rounded border-2 border-red-300 bg-white flex-shrink-0" />
            <span className="text-[10px] text-body leading-tight">No shared decision-making</span>
          </div>
        </div>
      </div>
      <div className="mt-3 text-center">
        <span className="text-[10px] font-semibold text-primary bg-primary/[0.06] px-3 py-1 rounded-lg">
          2 / 3 positive indicators checked
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
          body="Every case mapped to the RCGP curriculum. Practice across every specialty you will face in the SCA."
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
          body="Over 20% of GP trainees in the UK already use our AI to write clinical case reviews. Describe your case, select your capabilities, and get a structured review ready to submit — in seconds."
          cta="Open Portfolio Tool →"
          href="/portfolio"
        >
          <PortfolioVisual />
        </FeatureRow>
      </div>
    </section>
  );
}

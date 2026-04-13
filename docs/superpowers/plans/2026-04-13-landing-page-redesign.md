# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current landing page with a scroll-driven product narrative that tells the story of a consultation from start to finish.

**Architecture:** Single-page redesign using Next.js App Router + Framer Motion. The page is decomposed into focused components under `components/landing/`. The hero embeds an interactive case card linking to `/try/`. The product journey uses `position: sticky` + `useScroll` for a 4-chapter scroll-choreographed demo. All warm/light aesthetic on cream background.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion, Supabase (auth check only)

**Spec:** `docs/superpowers/specs/2026-04-13-landing-page-redesign.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `components/landing/LandingNavbar.tsx` | Floating pill nav with auth, scroll-driven bg |
| Create | `components/landing/LandingHero.tsx` | Hero with headline + interactive case card |
| Create | `components/landing/CaseCard.tsx` | Standalone patient scenario card component |
| Create | `components/landing/ProductJourney.tsx` | Scroll-driven 4-chapter orchestrator |
| Create | `components/landing/ProductWindow.tsx` | Shared window frame with top bar |
| Create | `components/landing/ChapterBrief.tsx` | Chapter 1: patient brief content |
| Create | `components/landing/ChapterConsultation.tsx` | Chapter 2: live consultation content |
| Create | `components/landing/ChapterScore.tsx` | Chapter 3: score dashboard content |
| Create | `components/landing/ChapterProgress.tsx` | Chapter 4: progress dashboard content |
| Create | `components/landing/WaveformBars.tsx` | Extracted waveform animation component |
| Create | `components/landing/SocialProof.tsx` | Flowing testimonials section |
| Create | `components/landing/FinalCTA.tsx` | Bottom CTA section |
| Create | `components/landing/LandingFooter.tsx` | Minimal single-row footer |
| Rewrite | `app/page.tsx` | Compose all landing sections |

Old landing components (`HeroSection.tsx`, `FeaturesSection.tsx`, `CTASection.tsx`, `Footer.tsx`, `HeroChatSimulation.tsx`, `FreeCasesSection.tsx`, `StationsCarousel.tsx`, `FeedbackAnalysisSection.tsx`, `InteractiveDemoSection.tsx`, `PortfolioToolSection.tsx`, `TestimonialsSection.tsx`) are NOT deleted — they become unused. We create new files with distinct names to avoid confusion.

---

### Task 1: WaveformBars Component

**Files:**
- Create: `CaseForgeFrontend/components/landing/WaveformBars.tsx`

- [ ] **Step 1: Create WaveformBars component**

Extract and clean up the waveform animation from the current page. This is a pure presentational component reused in Chapter 2.

```tsx
'use client';

import { motion } from 'framer-motion';

interface WaveformBarsProps {
  active?: boolean;
  bars?: number;
  className?: string;
}

export default function WaveformBars({ active = true, bars = 24, className = '' }: WaveformBarsProps) {
  return (
    <div className={`flex items-end gap-[3px] h-8 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-primary/50"
          animate={
            active
              ? {
                  height: [
                    `${20 + Math.sin(i * 0.8) * 16}%`,
                    `${50 + Math.sin(i * 0.5 + 1) * 40}%`,
                    `${20 + Math.sin(i * 0.8) * 16}%`,
                  ],
                }
              : { height: '20%' }
          }
          transition={
            active
              ? {
                  duration: 1.2 + (i % 4) * 0.15,
                  repeat: Infinity,
                  delay: (i % 5) * 0.08,
                  ease: 'easeInOut',
                }
              : {}
          }
          style={{ minHeight: '4px' }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `cd CaseForgeFrontend && npm run dev`

Open browser, temporarily import into page.tsx to confirm waveform renders. Then remove the temporary import.

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/WaveformBars.tsx && git commit -m "feat: add WaveformBars component for landing page"
```

---

### Task 2: LandingNavbar Component

**Files:**
- Create: `CaseForgeFrontend/components/landing/LandingNavbar.tsx`

- [ ] **Step 1: Create the navbar component**

```tsx
'use client';

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';

interface LandingNavbarProps {
  user: { id: string } | null;
}

export default function LandingNavbar({ user }: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollYProgress } = useScroll();

  const navBg = useTransform(
    scrollYProgress,
    [0, 0.08],
    ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0.95)']
  );
  const navShadow = useTransform(
    scrollYProgress,
    [0, 0.08],
    ['0 1px 0 rgba(0,0,0,0)', '0 1px 0 rgba(0,0,0,0.06)']
  );

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <motion.nav
        style={
          {
            maxWidth: 'min(92%, 1200px)',
            backgroundColor: navBg,
            boxShadow: navShadow,
          } as React.CSSProperties
        }
        className="w-full backdrop-blur-2xl border border-black/[0.06] rounded-[14px] px-5 py-3 flex items-center justify-between"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
      >
        {/* Wordmark */}
        <Link href="/" className="flex items-center group cursor-pointer">
          <span className="text-[14px] font-semibold text-heading tracking-tight">
            Fourteen Fisherman
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <a
            href="#journey"
            className="text-[13px] text-body hover:text-heading transition-colors duration-150"
          >
            How it works
          </a>
          <Link
            href="/pricing"
            className="text-[13px] text-body hover:text-heading transition-colors duration-150"
          >
            Pricing
          </Link>
          <div className="w-px h-4 bg-black/10" />
          {user ? (
            <Link href="/dashboard">
              <motion.div
                className="primary-button text-[13px] !py-2 !px-5"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                Dashboard
              </motion.div>
            </Link>
          ) : (
            <>
              <Link
                href="/auth/sign-in"
                className="text-[13px] text-body hover:text-heading transition-colors duration-150"
              >
                Sign in
              </Link>
              <Link href="/try">
                <motion.div
                  className="primary-button text-[13px] !py-2 !px-5"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try a free case
                </motion.div>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <motion.button
          className="md:hidden w-8 h-8 flex flex-col items-center justify-center gap-[5px] cursor-pointer"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full origin-center"
            animate={mobileOpen ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full"
            animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
          <motion.span
            className="block w-5 h-[1.5px] bg-heading rounded-full origin-center"
            animate={mobileOpen ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          />
        </motion.button>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="absolute top-16 left-0 right-0 mx-4 glass-panel rounded-2xl p-4 flex flex-col gap-1"
            style={{ maxWidth: 'min(92%, 1200px)', margin: '0 auto' }}
          >
            <a
              href="#journey"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              How it works
            </a>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
            >
              Pricing
            </Link>
            <div className="my-1 border-t border-black/[0.06]" />
            {user ? (
              <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                <div className="primary-button text-[14px] w-full justify-center">
                  Dashboard
                </div>
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-xl text-[14px] text-body hover:text-heading hover:bg-black/[0.03] transition-all duration-150"
                >
                  Sign in
                </Link>
                <Link href="/try" onClick={() => setMobileOpen(false)}>
                  <div className="primary-button text-[14px] w-full justify-center mt-1">
                    Try a free case
                  </div>
                </Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/LandingNavbar.tsx && git commit -m "feat: add LandingNavbar with floating pill design"
```

---

### Task 3: CaseCard Component

**Files:**
- Create: `CaseForgeFrontend/components/landing/CaseCard.tsx`

- [ ] **Step 1: Create the interactive case card**

```tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface CaseCardProps {
  className?: string;
}

const CASE_DATA = {
  stationId: 'demo',
  patientName: 'Mrs. Margaret Thompson',
  initials: 'MT',
  age: 62,
  gender: 'Female',
  occupation: 'Retired teacher',
  duration: 12,
  presentingComplaint:
    'Headache for three days, worse in the mornings. Patient is concerned about the severity.',
  task: 'Explore the patient\'s symptoms, address their concerns, and formulate an appropriate management plan.',
  domains: ['Data Gathering', 'Clinical Management', 'Interpersonal Skills'],
};

export default function CaseCard({ className = '' }: CaseCardProps) {
  return (
    <motion.div
      className={`relative max-w-[480px] w-full mx-auto ${className}`}
      initial={{ opacity: 0, y: 30, rotate: 1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.8 }}
    >
      <div
        className="rounded-[20px] overflow-hidden border border-black/[0.06]"
        style={{
          background: '#FFFCF8',
          boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)',
        }}
      >
        {/* Amber left accent */}
        <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full" style={{ background: 'linear-gradient(180deg, #B45309, #D97706)' }} />

        <div className="p-6 pl-7">
          {/* Patient identity row */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-semibold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
            >
              {CASE_DATA.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-heading">
                {CASE_DATA.patientName}
              </div>
              <div className="text-[12px] text-muted">
                {CASE_DATA.age} · {CASE_DATA.gender} · {CASE_DATA.occupation}
              </div>
            </div>
            <div className="px-3 py-1 rounded-full text-[11px] font-semibold font-mono flex-shrink-0" style={{ background: 'rgba(180,83,9,0.08)', color: '#B45309' }}>
              {CASE_DATA.duration} min
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-black/[0.05] mb-5" />

          {/* Presenting complaint */}
          <div className="mb-5">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Presenting Complaint
            </div>
            <p className="text-[15px] text-body leading-[1.7]">
              {CASE_DATA.presentingComplaint}
            </p>
          </div>

          {/* Your task */}
          <div className="mb-6">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Your Task
            </div>
            <p className="text-[15px] text-body leading-[1.7]">
              {CASE_DATA.task}
            </p>
          </div>

          {/* Domain tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CASE_DATA.domains.map((domain) => (
              <span
                key={domain}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
              >
                {domain}
              </span>
            ))}
          </div>

          {/* CTA */}
          <Link href="/try" className="block">
            <motion.div
              className="w-full py-3.5 rounded-xl text-center text-[14px] font-semibold text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                boxShadow: '0 4px 12px rgba(180,83,9,0.2)',
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Start consultation →
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/CaseCard.tsx && git commit -m "feat: add CaseCard component with patient scenario display"
```

---

### Task 4: LandingHero Component

**Files:**
- Create: `CaseForgeFrontend/components/landing/LandingHero.tsx`

- [ ] **Step 1: Create the hero section**

```tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import CaseCard from './CaseCard';

const HEADLINE_WORDS = ['Your', 'SCA', 'exam,'];
const HEADLINE_WORDS_2 = ['rehearsed', 'before', 'it', 'counts.'];

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const wordVariant = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 90, damping: 18 },
  },
};

export default function LandingHero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 px-6 overflow-hidden">
      {/* Ambient orb */}
      <div
        className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(180,83,9,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-[680px] w-full text-center">
        {/* Eyebrow */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.05 }}
        >
          <span className="text-[11px] font-mono font-medium tracking-[0.14em] uppercase text-primary">
            For GP Trainees Preparing for the SCA
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-[clamp(48px,5vw+1rem,72px)] font-bold text-heading tracking-[-0.03em] leading-[1.05] mb-7"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <span className="flex flex-wrap justify-center gap-x-[0.22em]">
            {HEADLINE_WORDS.map((word, i) => (
              <motion.span key={i} variants={wordVariant} className="inline-block">
                {word}
              </motion.span>
            ))}
          </span>
          <span className="flex flex-wrap justify-center gap-x-[0.22em]">
            {HEADLINE_WORDS_2.map((word, i) => (
              <motion.span
                key={`l2-${i}`}
                variants={wordVariant}
                className={word === 'rehearsed' ? 'inline-block italic gradient-text' : 'inline-block'}
              >
                {word}
              </motion.span>
            ))}
          </span>
        </motion.h1>

        {/* Subline */}
        <motion.p
          className="text-[18px] text-body leading-[1.7] max-w-[480px] mx-auto mb-10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 70, damping: 18, delay: 0.65 }}
        >
          AI patients that talk back, push back, and score you on every domain.
          Pick a case and start a consultation in under 60 seconds.
        </motion.p>
      </div>

      {/* Case card */}
      <CaseCard className="relative z-10" />

      {/* Browse all cases link */}
      <motion.div
        className="mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <Link
          href="/try"
          className="text-[13px] text-muted hover:text-primary transition-colors duration-150"
        >
          or browse all 78 cases →
        </Link>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-muted">
          <path
            d="M10 4v12M5 11l5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/LandingHero.tsx && git commit -m "feat: add LandingHero with headline and interactive case card"
```

---

### Task 5: ProductWindow Component

**Files:**
- Create: `CaseForgeFrontend/components/landing/ProductWindow.tsx`

- [ ] **Step 1: Create the shared window frame**

```tsx
'use client';

import { ReactNode } from 'react';

interface ProductWindowProps {
  label: string;
  timer: string;
  children: ReactNode;
}

export default function ProductWindow({ label, timer, children }: ProductWindowProps) {
  return (
    <div
      className="rounded-[20px] overflow-hidden border border-black/[0.06]"
      style={{
        background: '#FFFCF8',
        boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-5 border-b border-black/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[11px] font-mono text-muted">{label}</span>
        </div>
        <span className="text-[12px] font-mono text-primary">{timer}</span>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/ProductWindow.tsx && git commit -m "feat: add ProductWindow frame component"
```

---

### Task 6: Chapter Content Components

**Files:**
- Create: `CaseForgeFrontend/components/landing/ChapterBrief.tsx`
- Create: `CaseForgeFrontend/components/landing/ChapterConsultation.tsx`
- Create: `CaseForgeFrontend/components/landing/ChapterScore.tsx`
- Create: `CaseForgeFrontend/components/landing/ChapterProgress.tsx`

- [ ] **Step 1: Create ChapterBrief**

```tsx
'use client';

import { motion } from 'framer-motion';

export default function ChapterBrief() {
  return (
    <div className="p-6">
      {/* Patient identity row */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-semibold flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}
        >
          MT
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-heading">Mrs. Margaret Thompson</div>
          <div className="text-[12px] text-muted">62 · Female · Retired teacher</div>
        </div>
        <div
          className="px-3 py-1 rounded-full text-[11px] font-semibold font-mono flex-shrink-0"
          style={{ background: 'rgba(180,83,9,0.08)', color: '#B45309' }}
        >
          12 min
        </div>
      </div>

      <div className="border-t border-black/[0.05] mb-5" />

      <div className="mb-5">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Presenting Complaint
        </div>
        <p className="text-[15px] text-body leading-[1.7]">
          Headache for three days, worse in the mornings. Patient is concerned about the severity.
        </p>
      </div>

      <div className="mb-6">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
          Your Task
        </div>
        <p className="text-[15px] text-body leading-[1.7]">
          Explore the patient&apos;s symptoms, address their concerns, and formulate an appropriate management plan.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {['Data Gathering', 'Clinical Management', 'Interpersonal Skills'].map((domain) => (
          <span
            key={domain}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
          >
            {domain}
          </span>
        ))}
      </div>

      <motion.div
        className="w-full py-3.5 rounded-xl text-center text-[14px] font-semibold text-white cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #B45309, #D97706)',
          boxShadow: '0 4px 12px rgba(180,83,9,0.2)',
        }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        Begin consultation →
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Create ChapterConsultation**

```tsx
'use client';

import { motion } from 'framer-motion';
import WaveformBars from './WaveformBars';

const MESSAGES = [
  {
    role: 'patient' as const,
    text: "I've had this terrible headache for three days now. It's mostly in the mornings when I wake up.",
  },
  {
    role: 'doctor' as const,
    text: "I'm sorry to hear that, Mrs. Thompson. Can you show me where exactly you feel the pain?",
  },
  {
    role: 'patient' as const,
    text: "It's right here, at the back of my head. Sometimes behind my eyes too. I'm worried it might be something serious.",
  },
  {
    role: 'doctor' as const,
    text: 'I understand your concern. Have you noticed anything else — any changes in your vision, or feeling sick with it?',
  },
];

interface ChapterConsultationProps {
  visibleMessages?: number;
}

export default function ChapterConsultation({ visibleMessages = 4 }: ChapterConsultationProps) {
  const shown = MESSAGES.slice(0, visibleMessages);

  return (
    <div className="flex flex-col h-full">
      {/* Patient header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/[0.04]">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}>
          MT
        </div>
        <div>
          <div className="text-[13px] font-semibold text-heading">Mrs. Thompson</div>
          <div className="text-[11px] text-muted">Headache · 3 days</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-success"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-[10px] font-semibold text-success uppercase tracking-[0.04em]">
            Live
          </span>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 p-5 flex flex-col gap-3 min-h-[200px]">
        {shown.map((msg, i) => (
          <motion.div
            key={i}
            className={`flex ${msg.role === 'doctor' ? 'justify-end' : 'justify-start'}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24, delay: i * 0.15 }}
          >
            <div
              className={`max-w-[75%] px-4 py-3 text-[13px] leading-[1.6] ${
                msg.role === 'patient'
                  ? 'bg-black/[0.03] border border-black/[0.05] text-body rounded-2xl rounded-bl-sm'
                  : 'text-white rounded-2xl rounded-br-sm'
              }`}
              style={
                msg.role === 'doctor'
                  ? { background: 'linear-gradient(135deg, #B45309, #D97706)' }
                  : {}
              }
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Voice bar */}
      <div className="px-5 py-3 border-t border-black/[0.05] flex items-center gap-3" style={{ background: 'rgba(255,252,248,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex-1">
          <WaveformBars active bars={24} />
        </div>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="white">
            <path d="M6 0C4.35 0 3 1.35 3 3v5c0 1.65 1.35 3 3 3s3-1.35 3-3V3c0-1.65-1.35-3-3-3z" />
          </svg>
        </div>
        <span className="text-[12px] font-mono text-muted w-12 text-right">04:26</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ChapterScore**

```tsx
'use client';

import { motion } from 'framer-motion';

const DOMAINS = [
  { label: 'Data Gathering', pct: 82 },
  { label: 'Clinical Management', pct: 71 },
  { label: 'Interpersonal Skills', pct: 88 },
];

const FEEDBACK = [
  {
    icon: '✓',
    color: '#B45309',
    text: "Strong open questions exploring the patient's ideas, concerns, and expectations throughout the consultation",
  },
  {
    icon: '⚡',
    color: '#D97706',
    text: 'Consider safety-netting for red flag symptoms earlier — ask about visual disturbance, neck stiffness, and fever',
  },
];

export default function ChapterScore() {
  return (
    <div className="p-7">
      {/* Score header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-1">
            Session Complete
          </div>
          <div className="flex items-end gap-1.5">
            <motion.span
              className="text-[56px] font-extrabold leading-none"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              78
            </motion.span>
            <span className="text-[13px] text-muted mb-2">out of 100 · Station 14</span>
          </div>
        </div>
        <motion.div
          className="px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase"
          style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.4 }}
        >
          ✓ Pass
        </motion.div>
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-6" />

      {/* Domain scores */}
      <div className="flex flex-col gap-4 mb-6">
        {DOMAINS.map((d, i) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-[13px] text-stone-500 w-[140px] font-medium flex-shrink-0">
              {d.label}
            </span>
            <div className="flex-1 h-2 bg-black/[0.04] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
                initial={{ width: 0 }}
                animate={{ width: `${d.pct}%` }}
                transition={{
                  type: 'spring',
                  stiffness: 40,
                  damping: 18,
                  delay: 0.5 + i * 0.15,
                }}
              />
            </div>
            <span className="font-mono text-[13px] font-semibold text-heading w-[36px] text-right">
              {d.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-6" />

      {/* Feedback items */}
      <div className="flex flex-col gap-2.5">
        {FEEDBACK.map((item, i) => (
          <motion.div
            key={i}
            className="flex items-start gap-2.5 p-3.5 rounded-xl text-[13px] text-stone-500 leading-[1.6]"
            style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 + i * 0.1 }}
          >
            <span className="flex-shrink-0 mt-0.5" style={{ color: item.color }}>
              {item.icon}
            </span>
            {item.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ChapterProgress**

```tsx
'use client';

import { motion } from 'framer-motion';

const PROGRESS_DATA = [52, 58, 64, 69, 72, 78];

const DOMAIN_TRENDS = [
  { name: 'Data Gathering', score: 82, delta: '+14%', positive: true },
  { name: 'Clinical Management', score: 71, delta: '+8%', positive: true },
  { name: 'Interpersonal Skills', score: 88, delta: '+12%', positive: true },
];

const STATS = [
  { value: '6', label: 'sessions completed' },
  { value: '78', label: 'average score' },
  { value: '12%', label: 'improvement', highlight: true },
];

export default function ChapterProgress() {
  const maxY = 100;
  const minY = 40;
  const chartWidth = 100;
  const chartHeight = 120;
  const points = PROGRESS_DATA.map((val, i) => ({
    x: (i / (PROGRESS_DATA.length - 1)) * chartWidth,
    y: chartHeight - ((val - minY) / (maxY - minY)) * chartHeight,
  }));

  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className="p-7">
      {/* Progress chart */}
      <div className="mb-6">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">
          Your Progress
        </div>
        <div className="relative" style={{ height: chartHeight + 24 }}>
          <svg
            viewBox={`-4 -4 ${chartWidth + 8} ${chartHeight + 28}`}
            className="w-full"
            preserveAspectRatio="none"
          >
            {/* Area fill */}
            <motion.path
              d={areaPath}
              fill="rgba(180,83,9,0.06)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            />
            {/* Line */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="#B45309"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            />
            {/* Latest point dot */}
            <motion.circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3"
              fill="#B45309"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.4, type: 'spring' }}
            />
            {/* X-axis labels */}
            {points.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={chartHeight + 16}
                textAnchor="middle"
                className="text-[8px] fill-muted font-mono"
              >
                S{i + 1}
              </text>
            ))}
          </svg>
          {/* Score label for latest point */}
          <motion.div
            className="absolute text-[12px] font-semibold text-primary font-mono"
            style={{
              right: 0,
              top: `${(points[points.length - 1].y / (chartHeight + 24)) * 100 - 8}%`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            78
          </motion.div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-6" />

      {/* Domain trends */}
      <div className="flex flex-col gap-3 mb-6">
        {DOMAIN_TRENDS.map((d) => (
          <div key={d.name} className="flex items-center justify-between">
            <span className="text-[12px] text-stone-500">{d.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-heading">{d.score}%</span>
              <span className={`text-[11px] font-medium ${d.positive ? 'text-success' : 'text-muted'}`}>
                ↑ {d.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-black/[0.05] mb-6" />

      {/* Stats row */}
      <div className="flex items-center justify-between">
        {STATS.map((stat, i) => (
          <div key={stat.label} className="flex flex-col items-center flex-1">
            {i > 0 && (
              <div className="absolute h-8 w-px bg-black/[0.06]" style={{ left: `${(i / STATS.length) * 100}%` }} />
            )}
            <motion.span
              className={`text-[24px] font-semibold ${stat.highlight ? 'text-success' : 'text-heading'}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.15 }}
            >
              {stat.value}
            </motion.span>
            <span className="text-[11px] text-muted text-center">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit all chapter components**

```bash
cd CaseForgeFrontend && git add components/landing/ChapterBrief.tsx components/landing/ChapterConsultation.tsx components/landing/ChapterScore.tsx components/landing/ChapterProgress.tsx && git commit -m "feat: add chapter content components for product journey"
```

---

### Task 7: ProductJourney Orchestrator

**Files:**
- Create: `CaseForgeFrontend/components/landing/ProductJourney.tsx`

- [ ] **Step 1: Create the scroll-driven journey orchestrator**

```tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import ProductWindow from './ProductWindow';
import ChapterBrief from './ChapterBrief';
import ChapterConsultation from './ChapterConsultation';
import ChapterScore from './ChapterScore';
import ChapterProgress from './ChapterProgress';

const CHAPTERS = [
  {
    number: '01',
    heading: 'Read your patient brief',
    body: "Every station starts with a scenario. You get the same information a real SCA candidate gets — presenting complaint, patient background, and your task.",
    timer: '08:00',
    details: null,
  },
  {
    number: '02',
    heading: 'Have the conversation',
    body: "Your patient responds in real-time with voice. They'll answer your questions, volunteer symptoms when prompted, and push back if you're vague — just like the real exam.",
    timer: '04:26',
    details: ['Real-time voice · Deepgram + Cartesia', 'Adaptive emotional responses', '8-minute timed consultations'],
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
    heading: 'Improve with every session',
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeChapter, setActiveChapter] = useState(0);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    const chapterIndex = Math.min(
      Math.floor(latest * CHAPTERS.length),
      CHAPTERS.length - 1
    );
    setActiveChapter(chapterIndex);
  });

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    return (
      <section id="journey" className="py-16 px-6">
        <div className="max-w-[600px] mx-auto">
          {CHAPTERS.map((chapter, i) => (
            <motion.div
              key={i}
              className="mb-20 last:mb-0"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ type: 'spring', stiffness: 60, damping: 20 }}
            >
              {/* Chapter text */}
              <div className="mb-8">
                <span className="text-[36px] font-bold font-mono text-primary/30">
                  {chapter.number}
                </span>
                <h2 className="text-[28px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mt-2 mb-4">
                  {chapter.heading}
                </h2>
                <p className="text-[16px] text-muted leading-[1.7]">{chapter.body}</p>
                {chapter.details && (
                  <div className="mt-4 flex flex-col gap-1.5">
                    {chapter.details.map((detail, j) => (
                      <span key={j} className="text-[12px] text-muted flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/30 flex-shrink-0" />
                        {detail}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Product window */}
              <ProductWindow label="Station 14 · Mrs. Thompson" timer={chapter.timer}>
                {CHAPTER_CONTENT[i]}
              </ProductWindow>
            </motion.div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      id="journey"
      ref={containerRef}
      className="relative"
      style={{ height: `${CHAPTERS.length * 100}vh` }}
    >
      <div className="sticky top-0 h-screen flex items-center">
        <div className="max-w-[1200px] mx-auto w-full px-6 grid grid-cols-2 gap-20 items-center">
          {/* Left: chapter text */}
          <div>
            {CHAPTERS.map((chapter, i) => (
              <motion.div
                key={i}
                className="absolute"
                initial={false}
                animate={{
                  opacity: activeChapter === i ? 1 : 0,
                  y: activeChapter === i ? 0 : activeChapter > i ? -20 : 20,
                }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                style={{ pointerEvents: activeChapter === i ? 'auto' : 'none' }}
              >
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
                        animate={{
                          opacity: activeChapter === i ? 1 : 0,
                          x: activeChapter === i ? 0 : -8,
                        }}
                        transition={{ delay: 0.2 + j * 0.1 }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/30 flex-shrink-0" />
                        {detail}
                      </motion.span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Right: product window */}
          <div>
            <ProductWindow
              label="Station 14 · Mrs. Thompson"
              timer={CHAPTERS[activeChapter].timer}
            >
              <motion.div
                key={activeChapter}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
              >
                {CHAPTER_CONTENT[activeChapter]}
              </motion.div>
            </ProductWindow>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/ProductJourney.tsx && git commit -m "feat: add scroll-driven ProductJourney orchestrator"
```

---

### Task 8: SocialProof Component

**Files:**
- Create: `CaseForgeFrontend/components/landing/SocialProof.tsx`

- [ ] **Step 1: Create the testimonials section**

```tsx
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
            className={i < TESTIMONIALS.length - 1 ? 'pb-12 mb-12 border-b border-black/[0.06]' : ''}
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
```

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/SocialProof.tsx && git commit -m "feat: add SocialProof section with flowing testimonials"
```

---

### Task 9: FinalCTA and LandingFooter Components

**Files:**
- Create: `CaseForgeFrontend/components/landing/FinalCTA.tsx`
- Create: `CaseForgeFrontend/components/landing/LandingFooter.tsx`

- [ ] **Step 1: Create FinalCTA**

```tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function FinalCTA() {
  return (
    <section className="py-[160px] px-6">
      <div className="max-w-[560px] mx-auto text-center">
        <motion.h2
          className="text-[40px] font-bold text-heading tracking-[-0.02em] mb-3"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          Start your first consultation
        </motion.h2>

        <motion.p
          className="text-[16px] text-stone-500 mb-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.1 }}
        >
          Pick a case. Talk to your patient. Get scored. No account needed.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 100, damping: 16, delay: 0.2 }}
        >
          <Link href="/try">
            <motion.div
              className="inline-flex items-center gap-2 px-12 py-4 rounded-[14px] text-[14px] font-semibold text-white cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                boxShadow: '0 8px 24px rgba(180,83,9,0.18)',
              }}
              whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(180,83,9,0.25)' }}
              whileTap={{ scale: 0.98 }}
            >
              Try a free case →
            </motion.div>
          </Link>
        </motion.div>

        <motion.p
          className="mt-4 text-[13px] text-muted"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </motion.p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create LandingFooter**

```tsx
import Link from 'next/link';

export default function LandingFooter() {
  return (
    <footer className="border-t border-black/[0.06] py-12 px-6">
      <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="text-center sm:text-left">
          <div className="text-[14px] font-semibold text-heading">Fourteen Fisherman</div>
          <div className="text-[12px] text-muted mt-1">
            Built by GP trainees, for GP trainees. © {new Date().getFullYear()}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="text-[13px] text-stone-500 hover:text-heading transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="text-[13px] text-stone-500 hover:text-heading transition-colors">
            Terms
          </Link>
          <Link href="/contact" className="text-[13px] text-stone-500 hover:text-heading transition-colors">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/FinalCTA.tsx components/landing/LandingFooter.tsx && git commit -m "feat: add FinalCTA and LandingFooter components"
```

---

### Task 10: Rewrite app/page.tsx

**Files:**
- Rewrite: `CaseForgeFrontend/app/page.tsx`

- [ ] **Step 1: Replace page.tsx with the new composition**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingHero from '@/components/landing/LandingHero';
import ProductJourney from '@/components/landing/ProductJourney';
import SocialProof from '@/components/landing/SocialProof';
import FinalCTA from '@/components/landing/FinalCTA';
import LandingFooter from '@/components/landing/LandingFooter';

export default function LandingPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  return (
    <div className="min-h-screen bg-surface font-sans">
      <LandingNavbar user={user} />
      <LandingHero />
      <ProductJourney />
      <SocialProof />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
```

- [ ] **Step 2: Verify the full page renders**

Run: `cd CaseForgeFrontend && npm run dev`

Open `http://localhost:3000` and verify:
- Nav renders with floating pill, scroll-driven background change
- Hero shows headline with word stagger animation, case card with amber accent
- Scrolling through the product journey shows chapters transitioning
- Social proof shows flowing testimonials
- Final CTA shows oversized button
- Footer shows single row

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/page.tsx && git commit -m "feat: rewrite landing page with scroll-driven product narrative"
```

---

### Task 11: Build Verification and Polish

**Files:**
- Possibly modify: any component that shows build errors

- [ ] **Step 1: Run production build**

```bash
cd CaseForgeFrontend && npm run build
```

Fix any TypeScript or build errors that appear. Common issues:
- Missing `'use client'` directives on components using hooks
- ESLint warnings about `any` types on Framer Motion style props (suppress with `// eslint-disable-next-line`)
- Unused imports from old landing components

- [ ] **Step 2: Run lint**

```bash
cd CaseForgeFrontend && npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Test responsive breakpoints**

Open browser dev tools and verify at:
- Desktop (1280px): two-column product journey with sticky window
- Tablet (768px): stacked layout, no sticky
- Mobile (375px): full-width cards, smaller headlines, hamburger nav

- [ ] **Step 4: Commit any fixes**

```bash
cd CaseForgeFrontend && git add -A && git commit -m "fix: resolve build errors and polish responsive layout"
```

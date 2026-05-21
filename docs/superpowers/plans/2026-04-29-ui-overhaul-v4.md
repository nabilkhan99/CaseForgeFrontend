# UI Overhaul v4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the improvementv4.md spec — style token foundation, landing page hero revert + "how it works" overhaul, case library dropdown + icon de-dup, individual case feedback/mark-scheme/score fixes, and portfolio feedback modal rework.

**Architecture:** Three PRs in dependency order. PR1 establishes design tokens + landing page changes. PR2 adds case library + individual case page improvements (feedback modal, mark scheme persistence, score format, learning point colours). PR3 reworks the portfolio feedback widget. Each PR builds on the tokens from PR1.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 3, Framer Motion, lucide-react (already installed), Supabase (feedback table migration)

**Spec reference:** `/Users/nabilkhan/Desktop/fourteenfisherman/improvementv4.md`

---

## File Map

### New files
- `components/ui/FeedbackModal.tsx` — shared feedback modal (cases + portfolio)
- `supabase/migrations/<timestamp>_create_feedback_table.sql` — feedback storage

### Modified files
- `tailwind.config.ts` — new colour roles, type tokens
- `components/landing/LandingHero.tsx` — hero revert (two-phone image, new headline)
- `components/landing/ProductJourney.tsx` — eyebrows, vertical thread, IntersectionObserver, layout
- `components/landing/ChapterBrief.tsx` — remove Medical Records + Recent Notes
- `components/landing/ChapterConsultation.tsx` — remove bullets, tighten avatar gap, fix timer %
- `components/landing/ChapterScore.tsx` — remove Strengths + To Improve lists
- `components/landing/ChapterProgress.tsx` — remove Recent Stations list
- `components/landing/BottomFeatures.tsx` — mobile trims (2+2 indicators, remove Brief Description)
- `app/cases/page.tsx` — clinical-topic dropdown, lucide-react icons, card chrome, text-secondary
- `components/cases/CaseBankCard.tsx` — card chrome (border + shadow)
- `components/cases/CaseDetailTabs.tsx` — accept external checked state, feedback button in tab bar
- `app/cases/[id]/page.tsx` — lift mark scheme state, total score X/Y, feedback modal integration
- `components/FeedbackWidget.tsx` — rework to centred modal using shared FeedbackModal
- `app/api/feedback/route.ts` — API route to insert feedback into Supabase

---

## PR1: Foundations + Landing Page (§1 + §2)

### Task 1: Add design tokens to Tailwind config

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add new colour role tokens**

In `tailwind.config.ts`, add a `designTokens` section under `extend.colors`. These map to the spec's §1.2 colour roles without breaking existing tokens:

```ts
// Add inside extend.colors, after existing entries:
'bg-page': '#F5EEE3',
'bg-card': '#FBF7F1',
'text-primary': '#1F1A14',
'text-secondary': '#5A4F45',
'text-muted-warm': '#8A7E72',
'accent-primary': '#C2410C',
'accent-soft': '#F4A98A',
'border-card': 'rgba(31, 26, 20, 0.08)',
```

Keep all existing tokens (`primary`, `heading`, `body`, `muted`, `surface`, etc.) — they're used throughout. The new tokens are additive for the spec-specific styles.

- [ ] **Step 2: Add card chrome shadow token**

Add a new shadow under `extend.boxShadow`:

```ts
'card-chrome': '0 1px 2px rgba(31, 26, 20, 0.04), 0 4px 8px rgba(31, 26, 20, 0.04)',
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add v4 design tokens — colour roles, card chrome shadow"
```

---

### Task 2: Revert hero to two-phone image layout

**Files:**
- Modify: `components/landing/LandingHero.tsx`

The current hero already has the two-phone JSX layout with `DeviceFrame` components. The spec says to revert to this version with the two-phone image. Current code already renders two phones on desktop and hides them on mobile — this matches the spec closely.

**Changes needed:**
1. Remove the mobile single-phone card (`lg:hidden` section, lines 251-260) — spec says "no hero image on mobile"
2. Update headline text — current is already "Would you pass the SCA tomorrow?" with gradient on "tomorrow" (correct)
3. Remove the eyebrow text "For GP Trainees Preparing for the SCA" (not in spec)
4. Add subheader text: "Test yourself against our AI patients and find out if you're ready to pass."
5. Make hero `min-height: 100vh` on desktop, content-sized on mobile
6. Vertically centre left column content against phones

- [ ] **Step 1: Update hero section wrapper for full-viewport desktop**

Replace the opening `<section>` tag:

```tsx
<section className="relative overflow-hidden pt-24 pb-4 lg:min-h-screen lg:flex lg:items-center lg:pb-0">
```

This makes the hero fill the viewport on desktop while sizing to content on mobile.

- [ ] **Step 2: Update left column — remove eyebrow, add subheader**

Replace the left column's `<motion.div>` content (the one with initial/animate). Remove the `<span>` eyebrow ("For GP Trainees..."). Keep the `<h1>` headline as-is (it already has the gradient "tomorrow"). After the `</h1>` closing, add the subheader:

```tsx
<p className="text-lg text-text-secondary leading-relaxed max-w-[440px] mb-5 lg:mb-6 mx-auto lg:mx-0">
  Test yourself against our AI patients and find out if you're ready to pass.
</p>
```

- [ ] **Step 3: Remove mobile phone card**

Delete the entire `{/* Mobile: single pass card */}` block (the `<motion.div className="lg:hidden ...">` section that renders `<ScreenContent />`). On mobile, only the headline + subheader + CTA buttons show.

- [ ] **Step 4: Ensure left column is vertically centred**

The grid already uses `items-center`. Verify the grid wrapper has:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 lg:gap-8 xl:gap-16 items-center">
```

- [ ] **Step 5: Make CTA full-width on mobile**

Update the CTA container to be `flex-col` on mobile:

```tsx
<motion.div
  ...
  className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
>
```

And make the waitlist button full-width on mobile by adding `w-full sm:w-auto` and centering text:

```tsx
className="w-full sm:w-auto px-6 lg:px-8 py-3.5 lg:py-4 rounded-full text-white font-semibold flex items-center justify-center gap-2 cursor-pointer text-[14px] lg:text-base"
```

Same for the View cases button:
```tsx
className="w-full sm:w-auto px-6 lg:px-8 py-3.5 lg:py-4 rounded-full font-semibold border border-black/10 hover:bg-black/[0.03] transition-colors cursor-pointer text-heading text-[14px] lg:text-base text-center"
```

- [ ] **Step 6: Verify on dev server**

Run: `npm run dev`
Check desktop: two phones visible, full-height hero, left column centred vertically.
Check mobile (resize to 375px): no phone image, headline + subheader + full-width CTA.

- [ ] **Step 7: Commit**

```bash
git add components/landing/LandingHero.tsx
git commit -m "feat: revert hero to two-phone layout, add subheader, full-viewport desktop"
```

---

### Task 3: Overhaul "How it works" — ProductJourney with eyebrows, vertical thread, layout

**Files:**
- Modify: `components/landing/ProductJourney.tsx`

This is the most complex landing page change. The component currently renders 4 chapters in a two-column grid (desktop) and stacked (mobile). We need to:
1. Add eyebrow tags (THE BRIEF, THE CONSULTATION, THE FEEDBACK, THE PROGRESS)
2. Bold the operative phrase in each headline
3. Change body text from `text-muted` to `text-text-secondary`
4. Remove the `details` bullets from chapter 02
5. Add vertical thread with IntersectionObserver (desktop only)
6. Mobile: inline step number with eyebrow (`01 · THE BRIEF`), hide vertical thread
7. Adjust column widths: left 440px, right 420px, 96px gap
8. Section padding: 96px top/bottom desktop, 56px mobile

- [ ] **Step 1: Update CHAPTERS data — add eyebrows, format headings, remove details**

```tsx
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
```

- [ ] **Step 2: Add IntersectionObserver hook for active section tracking**

Add at the top of the `ProductJourney` component:

```tsx
import { useRef, useState, useEffect } from 'react';

// Inside the component:
const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
const [activeSection, setActiveSection] = useState(0);

useEffect(() => {
  const observers = sectionRefs.current.map((ref, i) => {
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
```

- [ ] **Step 3: Rewrite desktop layout with vertical thread**

Replace the desktop grid (`hidden lg:grid`) with:

```tsx
{/* Desktop: two columns with vertical thread */}
<div className="hidden lg:grid grid-cols-[440px_1fr] gap-24 items-center max-w-[960px]">
  {/* Left: step number + eyebrow + headline + body */}
  <div className="relative">
    {/* Step number */}
    <span
      className={`text-[28px] font-medium transition-opacity duration-300 ${
        activeSection === i ? 'text-accent-soft opacity-100' : 'text-accent-soft opacity-50'
      }`}
    >
      {chapter.number}
    </span>
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
```

- [ ] **Step 4: Add the vertical thread element**

The vertical thread is a 1px line running down the left side connecting all 4 sections. Implement it as an absolutely positioned element within a relative wrapper around all sections:

```tsx
{/* Vertical thread — desktop only */}
<div className="hidden lg:block absolute left-[14px] top-0 bottom-0 w-px bg-border-card" />
```

The step numbers sit on this line. Position the thread at `left: 14px` (half of the 28px step number width). Each step number gets a small accent dot when active:

```tsx
{/* Active dot on thread */}
{activeSection === i && (
  <span className="absolute left-[10px] top-[14px] w-[9px] h-[9px] rounded-full bg-accent-soft" />
)}
```

Wrap the entire sections loop in a `<div className="relative">` to contain the thread.

- [ ] **Step 5: Rewrite mobile layout**

Replace the mobile/tablet layout (`lg:hidden`) with:

```tsx
{/* Mobile: stacked */}
<div
  className="lg:hidden flex flex-col gap-4 px-0"
  ref={el => { sectionRefs.current[i] = el; }}
>
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
```

- [ ] **Step 6: Update section spacing**

Update the section wrapper's `<div className="max-w-[1200px] ...">` spacing:

```tsx
<div className="max-w-[1200px] mx-auto px-6 space-y-0">
```

And wrap each chapter iteration in padding:

```tsx
<div className="py-24 lg:py-24" style={{ paddingTop: i === 0 ? undefined : undefined }}>
```

Desktop: 96px (py-24 = 96px). Mobile: 56px — add `max-lg:py-14` (56px).

- [ ] **Step 7: Verify on dev server**

Run: `npm run dev`
Desktop: vertical thread visible, step numbers on the line, active section highlights on scroll, columns vertically centred.
Mobile: inline `01 · THE BRIEF` format, single-column stack, each section fits in one viewport.

- [ ] **Step 8: Commit**

```bash
git add components/landing/ProductJourney.tsx
git commit -m "feat: how-it-works overhaul — eyebrows, vertical thread, responsive layout"
```

---

### Task 4: Trim chapter card content

**Files:**
- Modify: `components/landing/ChapterBrief.tsx`
- Modify: `components/landing/ChapterConsultation.tsx`
- Modify: `components/landing/ChapterScore.tsx`
- Modify: `components/landing/ChapterProgress.tsx`

- [ ] **Step 1: ChapterBrief — remove Medical Records and Recent Notes**

In `ChapterBrief.tsx`, delete the "Medical Records" block (lines 60-87) and the "Recent Notes" block (lines 89-102). Keep: Patient Name, Age, Father's Name, Situation, Reason for Encounter, and the Begin Consultation CTA.

- [ ] **Step 2: ChapterConsultation — tighten avatar gap, fix timer percentage**

In `ChapterConsultation.tsx`:

a) Reduce the `min-h` of the main voice area. Change `min-h-[300px]` to `min-h-[200px]` on the container (line 125). This pulls the avatar block upward relative to the header.

b) Reduce the `mb` spacing on the `AudioVisualizer` container from `mb-4` to `mb-0` and reduce the speaking indicator `mb-6` to `mb-3`.

c) Fix the timer percentage: on line 176, change `54% remaining` to `70% remaining`:

```tsx
<span className="font-mono text-primary font-semibold">70% remaining</span>
```

- [ ] **Step 3: ChapterScore — remove Strengths and To Improve lists**

In `ChapterScore.tsx`, delete:
- The `<div className="border-t ..." />` divider (line 141)
- The entire `<div className="space-y-3">` block (lines 144-208) containing both Strengths and Improvements sections.

Keep: score donut, PASS label, summary line, three domain bars, Key Moment callout.

- [ ] **Step 4: ChapterProgress — remove Recent Stations list**

In `ChapterProgress.tsx`, delete:
- The second `<div className="border-t ..." />` divider (line 171)
- The entire Recent Stations block (lines 173-196).

Keep: Average Score, Stations Completed, Score Timeline (S1-S6), Domain Growth bars (these are already `hidden lg:block`).

- [ ] **Step 5: Verify on dev server**

Run: `npm run dev`
Check all 4 "how it works" sections on both desktop and mobile. Each section should be more compact after the trims.

- [ ] **Step 6: Commit**

```bash
git add components/landing/ChapterBrief.tsx components/landing/ChapterConsultation.tsx components/landing/ChapterScore.tsx components/landing/ChapterProgress.tsx
git commit -m "feat: trim how-it-works card content per v4 spec"
```

---

### Task 5: Mobile trims for Practice with a Friend + Portfolio Tool sections

**Files:**
- Modify: `components/landing/BottomFeatures.tsx`

- [ ] **Step 1: PracticeVisual — show only 2+2 indicators on mobile**

The `PracticeVisual` component currently shows 4 rows of positive/negative indicators. On mobile, we need only 2 rows (2 positive + 2 negative).

Wrap the 3rd and 4th indicator rows (the last two `<div className="flex gap-2">` blocks) in a `hidden lg:block` wrapper:

```tsx
<div className="hidden lg:block space-y-2">
  {/* Third indicator row */}
  <div className="flex gap-2">
    ...
  </div>
  {/* Fourth indicator row */}
  <div className="flex gap-2">
    ...
  </div>
</div>
```

Keep the first two indicator rows visible on all viewports.

- [ ] **Step 2: PortfolioVisual — remove Brief Description on mobile**

In the `PortfolioVisual` component, add `hidden lg:block` to the Brief Description expanded block (the `<div>` with `p-3 rounded-xl border border-primary/10` styling, lines 196-214):

```tsx
<div
  className="hidden lg:block p-3 rounded-xl border border-primary/10"
  style={{ background: 'linear-gradient(...)' }}
>
  ...
</div>
```

- [ ] **Step 3: Verify on dev server**

Run: `npm run dev`
Mobile: Practice section shows 2 indicator rows only. Portfolio section shows no Brief Description.
Desktop: Both sections unchanged.

- [ ] **Step 4: Commit**

```bash
git add components/landing/BottomFeatures.tsx
git commit -m "feat: mobile trims — 2+2 indicators, hide portfolio brief description"
```

---

## PR2: Case Library + Individual Cases (§3 + §4)

### Task 6: Case library — clinical-topic dropdown + lucide icons + card chrome

**Files:**
- Modify: `app/cases/page.tsx`
- Modify: `components/cases/CaseBankCard.tsx`

- [ ] **Step 1: Replace getDomainIcon with lucide-react icons**

Delete the entire `getDomainIcon` function (lines 11-100). Replace with a map from domain name to Lucide icon component:

```tsx
import {
  Flower, HeartPulse, Hand, Ear, Activity, Eye, Soup, Bath, Droplet,
  Bug, Puzzle, Baby, Smile, Bone, Brain, Sparkles, Armchair, Ribbon,
  Backpack, FlaskConical, Wind, Heart, Wine, Siren,
  Dna, CircleDot, Stethoscope, Globe, MessageSquare, Pill,
  Users, ShieldPlus, Flame, BookOpen,
} from 'lucide-react';

const DOMAIN_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'allergy and immunology': Flower,
  'cardiovascular health': HeartPulse,
  'dermatology': Hand,
  'ear, nose and throat': Ear,
  'metabolic problems and endocrinology': Activity,
  'ophthalmology': Eye,
  'gastroenterology': Soup,
  'gender, reproductive & sexual health': Bath,
  'haematology': Droplet,
  'infectious disease and travel health': Bug,
  'learning disability': Puzzle,
  'maternity and reproductive health': Baby,
  'mental health': Smile,
  'musculoskeletal health': Bone,
  'neurology': Brain,
  'neurodiversity and neurodevelopment conditions': Sparkles,
  'older adults': Armchair,
  'people at the end of life': Ribbon,
  'people with long-term conditions including cancer': Ribbon,
  'patient < 19 years old': Backpack,
  'renal and urology': FlaskConical,
  'respiratory health': Wind,
  'sexual health': Heart,
  'smoking, alcohol and substance misuse': Wine,
  'urgent & unscheduled care': Siren,
  'genetics': Dna,
  'gynaecology and breast': CircleDot,
  'population and planetary health': Globe,
  'professional conversation / dilemma': MessageSquare,
  'prescribing': Pill,
  'ethnicity, culture, diversity': Users,
  'health disadvantage & vulnerability': ShieldPlus,
  'mental health & addiction': Flame,
  'investigation / results': BookOpen,
  'long-term conditions': Users,
  'older adults & frailty': Armchair,
  'undifferentiated disease': Stethoscope,
};

function getDomainIcon(domainName: string) {
  const key = domainName.toLowerCase();
  const Icon = Object.entries(DOMAIN_ICON_MAP).find(([k]) => key.includes(k) || k.includes(key))?.[1] || Stethoscope;
  return <Icon size={18} className="text-primary" />;
}
```

Note: Some Lucide icons may not exist (e.g. `Soup`, `Bath`, `Bone`). If build fails on import, substitute:
- `Soup` → `UtensilsCrossed`
- `Bath` → `Droplets`
- `Bone` → `Dumbbell`
- `Siren` → `AlertTriangle`
- `Backpack` → `GraduationCap`

Run the build to verify which icons exist and swap any missing ones.

- [ ] **Step 2: Replace search bar with clinical-topic dropdown**

Replace the search input (lines 182-197) with a dropdown `<select>`:

```tsx
<div className="relative flex-1 max-w-xl">
  <select
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    className="w-full px-4 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-black/[0.06] text-heading focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all text-base md:text-sm appearance-none cursor-pointer"
  >
    <option value="">All Topics</option>
    {domains.map(d => (
      <option key={d.id} value={d.name}>{d.name}</option>
    ))}
  </select>
  {/* Dropdown chevron */}
  <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </span>
</div>
```

Update the filter logic — `searchQuery` now holds a domain name (or empty for "All"):

```tsx
const filteredDomains = useMemo(() => {
  if (!searchQuery.trim()) return domains;
  return domains.filter(d => d.name === searchQuery);
}, [domains, searchQuery]);
```

- [ ] **Step 3: Apply text-secondary to body text**

In the header description (line 170), change `text-body` to `text-text-secondary`:

```tsx
<p className="text-base text-text-secondary">
```

- [ ] **Step 4: Apply card chrome to CaseBankCard**

In `components/cases/CaseBankCard.tsx`, update the card container classes (line 53):

```tsx
<div className="group relative rounded-2xl bg-bg-card border border-border-card shadow-card-chrome hover:border-primary/[0.15] hover:shadow-elevation-2 transition-all duration-200 cursor-pointer p-5 h-full flex flex-col">
```

This applies the §1.4 card chrome: `bg-card` background, `border-card` border, `card-chrome` shadow, `rounded-2xl` (16px).

- [ ] **Step 5: Verify build and icons**

Run: `npm run build`
Fix any missing Lucide icons by substituting.

Run: `npm run dev`
Check case library page: dropdown works, icons are unique per domain, cards have visible border + shadow.

- [ ] **Step 6: Commit**

```bash
git add app/cases/page.tsx components/cases/CaseBankCard.tsx
git commit -m "feat: case library — clinical-topic dropdown, lucide icons, card chrome"
```

---

### Task 7: Create shared FeedbackModal component

**Files:**
- Create: `components/ui/FeedbackModal.tsx`

- [ ] **Step 1: Create the FeedbackModal component**

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: 'case' | 'portfolio';
  sourceId?: string;
}

export default function FeedbackModal({ isOpen, onClose, sourceType, sourceId }: FeedbackModalProps) {
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: comment.trim(),
          email: email.trim() || null,
          source_type: sourceType,
          source_id: sourceId || null,
        }),
      });
    } catch {
      // Fail silently — feedback is non-critical
    }

    setIsSubmitting(false);
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
      onClose();
      setComment('');
      setEmail('');
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/30 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-2xl shadow-elevation-4 border border-border-card overflow-hidden"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
                <h3 className="text-base font-semibold text-heading">Send Feedback</h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/[0.04] transition-colors text-muted hover:text-heading"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {showSuccess ? (
                <div className="px-6 py-12 text-center space-y-2">
                  <p className="text-heading font-medium">Thank you!</p>
                  <p className="text-text-secondary text-sm">Your feedback helps us improve.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                  <div>
                    <label htmlFor="fb-comment" className="block text-sm font-medium text-heading mb-1.5">
                      Your feedback
                    </label>
                    <textarea
                      id="fb-comment"
                      required
                      rows={4}
                      className="w-full rounded-xl border border-black/[0.08] focus:border-primary/30 focus:ring-2 focus:ring-primary/20 text-sm p-3 text-heading placeholder:text-muted resize-none transition-all"
                      placeholder="What's on your mind?"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="fb-email" className="block text-sm font-medium text-heading mb-1.5">
                      Email <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <input
                      type="email"
                      id="fb-email"
                      className="w-full rounded-xl border border-black/[0.08] focus:border-primary/30 focus:ring-2 focus:ring-primary/20 text-sm p-3 text-heading placeholder:text-muted transition-all"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !comment.trim()}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                    style={{
                      background: '#C2410C',
                    }}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes (component is not imported yet).

- [ ] **Step 3: Commit**

```bash
git add components/ui/FeedbackModal.tsx
git commit -m "feat: create shared FeedbackModal component"
```

---

### Task 8: Create feedback API route + Supabase migration

**Files:**
- Create: `app/api/feedback/route.ts`
- Create Supabase migration for feedback table

- [ ] **Step 1: Create the Supabase migration**

Use the Supabase MCP `apply_migration` tool to create the feedback table:

```sql
CREATE TABLE public.feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comment text NOT NULL,
  email text,
  source_type text NOT NULL CHECK (source_type IN ('case', 'portfolio')),
  source_id text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (feedback is non-authenticated)
CREATE POLICY "Allow anonymous feedback inserts"
  ON public.feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only service role can read feedback
CREATE POLICY "Service role can read feedback"
  ON public.feedback
  FOR SELECT
  TO service_role
  USING (true);
```

- [ ] **Step 2: Create the API route**

```tsx
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { comment, email, source_type, source_id } = body;

    if (!comment || !source_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['case', 'portfolio'].includes(source_type)) {
      return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from('feedback').insert({
      comment,
      email: email || null,
      source_type,
      source_id: source_id || null,
    });

    if (error) {
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add app/api/feedback/route.ts
git commit -m "feat: feedback API route + Supabase migration"
```

---

### Task 9: Fix mark scheme persistence + total score X/Y format

**Files:**
- Modify: `app/cases/[id]/page.tsx`
- Modify: `components/cases/CaseDetailTabs.tsx`

The bug: `InteractiveMarkScheme` stores its `checked` state internally. When `CaseDetailTabs` switches tabs, the mark scheme unmounts and its state resets. Fix: lift the checked state to the parent page.

- [ ] **Step 1: Update InteractiveMarkScheme to accept external state**

In `app/cases/[id]/page.tsx`, change the `InteractiveMarkScheme` component to accept `checked` state and `onToggle` callback as props instead of managing its own state:

Add to the interface:

```tsx
interface InteractiveMarkSchemeProps {
  content: string | null;
  onScoreChange?: (positiveChecked: number, negativeChecked: number) => void;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
}
```

Update the component signature:

```tsx
function InteractiveMarkScheme({ content, onScoreChange, checked, onToggle }: InteractiveMarkSchemeProps) {
```

Remove the internal `useState` for `checked`:
```tsx
// DELETE: const [checked, setChecked] = useState<Record<string, boolean>>({});
```

Replace `toggleCheck` to use the prop:
```tsx
// DELETE the toggleCheck function
// Use onToggle directly in onClick handlers:
onClick={() => onToggle(`pos-${i}`)}
// and:
onClick={() => onToggle(`neg-${i}`)}
```

- [ ] **Step 2: Lift checked state to the parent page**

In `CaseDetailPage`, add three checked state holders (one per domain):

```tsx
const [d1Checked, setD1Checked] = useState<Record<string, boolean>>({});
const [d2Checked, setD2Checked] = useState<Record<string, boolean>>({});
const [d3Checked, setD3Checked] = useState<Record<string, boolean>>({});

const toggleD1 = useCallback((key: string) => {
  setD1Checked(prev => ({ ...prev, [key]: !prev[key] }));
}, []);
const toggleD2 = useCallback((key: string) => {
  setD2Checked(prev => ({ ...prev, [key]: !prev[key] }));
}, []);
const toggleD3 = useCallback((key: string) => {
  setD3Checked(prev => ({ ...prev, [key]: !prev[key] }));
}, []);
```

Pass these to the mark scheme content:

```tsx
<InteractiveMarkScheme content={caseData.data_gathering} onScoreChange={onD1ScoreChange} checked={d1Checked} onToggle={toggleD1} />
<InteractiveMarkScheme content={caseData.clinical_management} onScoreChange={onD2ScoreChange} checked={d2Checked} onToggle={toggleD2} />
<InteractiveMarkScheme content={caseData.relating_to_others} onScoreChange={onD3ScoreChange} checked={d3Checked} onToggle={toggleD3} />
```

Now when tabs switch, the mark scheme unmounts and remounts but the checked state persists in the parent.

- [ ] **Step 3: Compute total positive indicator count and display X / Y**

Add a helper to count total positives from the mark scheme data. In `CaseDetailPage`:

```tsx
function countPositiveIndicators(content: string | null): number {
  if (!content) return 0;
  const rows = parseMarkdownTable(content);
  return rows.filter(r => r.positive).length;
}

const totalPositiveIndicators =
  countPositiveIndicators(caseData.data_gathering) +
  countPositiveIndicators(caseData.clinical_management) +
  countPositiveIndicators(caseData.relating_to_others);
```

Update the total score display (line 629):

```tsx
<span className="text-sm font-black text-heading tabular-nums">
  {Math.max(0, totalScore)} / {totalPositiveIndicators}
</span>
```

- [ ] **Step 4: Verify on dev server**

Run: `npm run dev`
Navigate to a case, go to Mark Scheme tab, tick some indicators, switch to Candidate tab, switch back — ticks should persist.
Total score should show as `X / Y` format.

- [ ] **Step 5: Commit**

```bash
git add app/cases/[id]/page.tsx
git commit -m "fix: mark scheme state persists across tab switches, total score as X/Y"
```

---

### Task 10: Add feedback button to individual case pages

**Files:**
- Modify: `components/cases/CaseDetailTabs.tsx`
- Modify: `app/cases/[id]/page.tsx`

- [ ] **Step 1: Add feedback button to CaseDetailTabs**

Update `CaseDetailTabsProps` to accept a feedback button element:

```tsx
interface CaseDetailTabsProps {
  candidateContent: React.ReactNode;
  patientScriptContent?: React.ReactNode;
  markSchemeContent: React.ReactNode;
  learningPointsContent: React.ReactNode;
  feedbackButton?: React.ReactNode;
}
```

In the tab bar `<div>`, add the feedback button right-aligned:

```tsx
<div className="flex items-center gap-1 px-4 md:px-5 pt-4 pb-0 overflow-x-auto no-scrollbar">
  {tabs.map(tab => (
    /* existing tab buttons */
  ))}
  {/* Feedback button — right-aligned */}
  {feedbackButton && (
    <div className="ml-auto flex-shrink-0">
      {feedbackButton}
    </div>
  )}
</div>
```

- [ ] **Step 2: Wire up FeedbackModal in the case detail page**

In `app/cases/[id]/page.tsx`, import and use the modal:

```tsx
import FeedbackModal from '@/components/ui/FeedbackModal';

// Inside CaseDetailPage:
const [feedbackOpen, setFeedbackOpen] = useState(false);
```

Create the feedback button element:

```tsx
const feedbackButton = (
  <button
    onClick={() => setFeedbackOpen(true)}
    className="px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:brightness-110 text-white"
    style={{ background: '#C2410C' }}
  >
    Feedback
  </button>
);
```

Pass it to `CaseDetailTabs`:

```tsx
<CaseDetailTabs
  candidateContent={candidateContent}
  patientScriptContent={patientScriptContent}
  markSchemeContent={markSchemeContent}
  learningPointsContent={learningPointsContent}
  feedbackButton={feedbackButton}
/>
```

Add the modal at the bottom of the page (before closing `</div>`):

```tsx
<FeedbackModal
  isOpen={feedbackOpen}
  onClose={() => setFeedbackOpen(false)}
  sourceType="case"
  sourceId={id}
/>
```

- [ ] **Step 3: Mobile layout — feedback button on title line**

On mobile (below `lg` breakpoint), also show a feedback button next to the case title. Update the title section:

```tsx
{/* Title + mobile feedback */}
<div className="flex items-start justify-between gap-3 mb-8">
  <h1 className="text-2xl md:text-3xl font-bold text-heading tracking-tight">
    {caseData.title}
  </h1>
  {/* Mobile feedback button */}
  <button
    onClick={() => setFeedbackOpen(true)}
    className="lg:hidden flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white mt-1"
    style={{ background: '#C2410C' }}
  >
    Feedback
  </button>
</div>
```

Hide the tab bar feedback button on mobile by adding `hidden lg:block` to the feedback button in `CaseDetailTabs`.

- [ ] **Step 4: Verify on dev server**

Run: `npm run dev`
Desktop: feedback button visible in tab header row, right-aligned.
Mobile: feedback button on the title line.
Click: modal opens centred, dismissible by backdrop or close button. Submit sends to `/api/feedback`.

- [ ] **Step 5: Commit**

```bash
git add components/cases/CaseDetailTabs.tsx app/cases/[id]/page.tsx
git commit -m "feat: add feedback button + modal to individual case pages"
```

---

## PR3: Portfolio Tool (§5)

### Task 11: Rework portfolio FeedbackWidget to use shared modal

**Files:**
- Modify: `components/FeedbackWidget.tsx`

- [ ] **Step 1: Refactor FeedbackWidget to use FeedbackModal**

Replace the entire content of `FeedbackWidget.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import FeedbackModal from '@/components/ui/FeedbackModal';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="w-full flex flex-col items-end py-12 px-6 mt-auto z-40 relative">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="px-5 py-2.5 min-h-[44px] rounded-full border border-primary/20 text-primary bg-white/70 hover:bg-white hover:border-primary/40 transition-all duration-200 flex items-center gap-2 text-sm font-medium backdrop-blur-sm"
        >
          Feedback
        </motion.button>
      </div>

      <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sourceType="portfolio"
      />
    </>
  );
}
```

This:
- Removes the inline modal/panel that was anchored to the button
- Uses the shared centred FeedbackModal component
- Tags submissions with `source_type: 'portfolio'`
- Removes the PostHog `analytics.trackFeedback` call (feedback now goes to Supabase)
- Removes the emoji from the button text

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes. If the `analytics` import was the only consumer, the import removal is clean.

- [ ] **Step 3: Verify on dev server**

Run: `npm run dev`
Navigate to `/portfolio`. Click "Feedback" — centred modal appears. Submit — feedback saved to Supabase with `source_type: 'portfolio'`.

- [ ] **Step 4: Commit**

```bash
git add components/FeedbackWidget.tsx
git commit -m "refactor: portfolio feedback uses shared FeedbackModal with Supabase backend"
```

---

## Self-Review

**Spec coverage check:**
| Spec section | Task | Status |
|---|---|---|
| §1.1 Type scale | Applied inline in Tasks 2-5 | Covered |
| §1.2 Colour roles | Task 1 | Covered |
| §1.3 Spacing scale | Applied inline (no off-scale values) | Covered |
| §1.4 Card chrome | Task 1 (shadow), Task 6 (CaseBankCard) | Covered |
| §2.1 Hero revert | Task 2 | Covered |
| §2.2 Site-wide alignment | Note: this is a visual adjustment best done during implementation by tweaking px values to align with the logo glyph. The implementer should check each section's left padding against the navbar logo position. | Partially — visual tuning needed |
| §2.3 How it works content | Tasks 3 + 4 | Covered |
| §2.4 Desktop layout | Task 3 | Covered |
| §2.5 Mobile layout | Task 3 | Covered |
| §2.6 Practice section mobile | Task 5 | Covered |
| §2.7 Portfolio section mobile | Task 5 | Covered |
| §3.1 Case library | Task 6 | Covered |
| §4.1 Feedback button/modal | Tasks 7, 8, 10 | Covered |
| §4.1 Mark scheme persistence | Task 9 | Covered |
| §4.1 Total score X/Y | Task 9 | Covered |
| §4.1 Learning point headings | Already implemented — `LEARNING_POINT_COLORS` in CaseDetailTabs.tsx applies consistently | Covered (no change needed) |
| §5.1 Portfolio feedback rework | Task 11 | Covered |

**§2.2 alignment note:** The site-wide alignment fix (aligning content to logo glyph edge) requires measuring the exact pixel offset of the logo inside the navbar pill. The navbar pill has `px-5` (20px) padding, and the logo is the first element. The implementer should set all section content to use a matching left offset. This is best done visually during implementation — set `max-w-[1200px]` containers to use `px-6` and adjust if needed to match the logo position at `max-width: min(92%, 1200px)`.

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**Type consistency:** `FeedbackModalProps` interface is consistent across Task 7 (definition), Task 10 (case usage), and Task 11 (portfolio usage). `InteractiveMarkSchemeProps` is defined and used consistently in Task 9.

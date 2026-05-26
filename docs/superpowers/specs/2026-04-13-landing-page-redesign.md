# Landing Page Redesign — Fourteen Fisherman

**Date**: 2026-04-13
**Status**: Approved
**Approach**: "The Story" — scroll-driven product narrative on warm editorial foundation

---

## Design Philosophy

The landing page tells the story of a consultation from start to finish. Each scroll section reveals the next chapter of the product experience. The page IS the product tour — no feature lists, no card grids, no generic SaaS patterns.

**Inspiration sources**:
- **YC**: Editorial minimalism, extreme whitespace, flowing inline testimonials, warm cream backgrounds, typography-driven confidence
- **Framer**: Bold headlines, scroll-driven motion, product-forward showcasing
- **Exa**: Interactive demo embedded in hero, functional CTA as the first interaction
- **Figma**: Color-zoned sections, pull quotes as section dividers, product UI as primary visual

**Design constraints**:
- All warm/light — no dark sections
- Color palette: amber `#B45309`, stone neutrals
- Font: Plus Jakarta Sans everywhere
- Heavy Framer Motion: scroll reveals, spring physics, staggered entrances, scroll-linked transforms
- No boxes, no card grids — typography-driven flowing content
- Product-forward — every "chapter" is a rich, detailed product mockup

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#B45309` | Amber primary |
| `--primary-light` | `#D97706` | Amber light |
| `--primary-lighter` | `#F59E0B` | Amber lighter |
| `--heading` | `#1C1917` | Near-black headings |
| `--body` | `#44403C` | Body text |
| `--muted` | `#A8A29E` | Meta text, labels |
| `--stone-light` | `#78716C` | Secondary text |
| `--surface` | `#FAFAF7` | Page background (warm cream) |
| `--window-bg` | `#FFFCF8` | Product window background (warmer white) |
| `--border` | `rgba(0,0,0,0.06)` | Subtle borders |
| `--success` | `#16A34A` | Pass/positive indicators |
| `--success-bg` | `rgba(34,197,94,0.1)` | Success badge background |
| `--amber-gradient` | `linear-gradient(135deg, #B45309, #D97706)` | Primary gradient |
| `--amber-shadow` | `rgba(180,83,9,0.06)` | Warm shadow color |

---

## Typography

| Element | Size | Weight | Color | Notes |
|---------|------|--------|-------|-------|
| Hero headline | `clamp(48px, 5vw + 1rem, 72px)` | 700 | `--heading` | "rehearsed" word in italic amber gradient |
| Section headings | 36px | 700 | `--heading` | Chapter headings in product journey |
| Quote text | 24px | 500 | `--heading` | Testimonial quotes |
| Body | 16–18px | 400 | `--body` | Descriptions, sublines |
| Labels | 10–11px | 600 | `--muted` or `--primary` | Uppercase, mono, letter-spacing 0.1–0.12em |
| Chapter numbers | 36px | 700 | `--primary` at 30% opacity | "01", "02", etc. |
| Stats numbers | 20–24px | 600 | `--primary` | Inline stat highlights |
| Nav links | 13px | 500 | `--body` | Hover → `--heading` |
| CTA buttons | 14px | 600 | white | On amber gradient background |

---

## What Gets Preserved

1. Color palette (amber + stone neutrals)
2. Plus Jakarta Sans font
3. `/try/` flow routing (case card links to existing try flow)
4. Supabase auth check (Dashboard vs Sign in in nav)
5. `WaveformBars` component (reused in Chapter 2)

## What Gets Removed

Everything else. The current hero, feature sections, scoring mockup, trust dots, typing chat simulation, floating score cards — all replaced.

---

## Section 1: Navigation

**Type**: Floating pill navbar, fixed, centered

**Structure**:
```
[Fourteen Fisherman]          [How it works]  [Pricing]  |  [Sign in]  [Try a free case →]
```

- **Wordmark**: "Fourteen Fisherman" in 14px semibold Plus Jakarta Sans. No icon/logo box. Clean text only.
- **Center links**: "How it works" · "Pricing" — 13px, `--body`, hover → `--heading`, 150ms transition
- **Divider**: 1px vertical rule, 16px height, `rgba(0,0,0,0.10)`
- **Sign in**: 13px text link, `--body`
- **Try a free case**: Amber gradient pill button, 13px semibold white, `padding: 8px 20px`, `border-radius: 999px`
- **Container**: `max-width: min(92%, 1200px)`, `backdrop-blur: 24px`, `border: 1px solid rgba(0,0,0,0.06)`, `border-radius: 14px`, `padding: 12px 20px`
- **Scroll behavior**: starts `background: rgba(255,255,255,0.72)`, scrolls to `rgba(255,255,255,0.95)` with `box-shadow: 0 1px 0 rgba(0,0,0,0.06)` — driven by `useScroll` + `useTransform`
- **Auth-aware**: If logged in, "Sign in" becomes hidden, "Try a free case" becomes "Dashboard"

**Mobile** (`md` breakpoint):
- Wordmark + hamburger only
- Dropdown: links + auth CTAs stacked vertically in glass panel

**Motion**:
- Initial: `{ opacity: 0, y: -12 }` → `{ opacity: 1, y: 0 }` with spring

---

## Section 2: Hero

**Layout**: Full viewport height (`min-h-screen`), flex centered, `pt-32 pb-20 px-6`

**Background**: `--surface` (`#FAFAF7`). One subtle ambient orb: `radial-gradient(circle, rgba(180,83,9,0.05) 0%, transparent 70%)` top-right, 500px diameter.

**Content stack** (centered, max-width 680px):

### 2.1 Eyebrow
- Text: "FOR GP TRAINEES PREPARING FOR THE SCA"
- Style: 11px, `--primary`, uppercase, letter-spacing `0.14em`, mono weight
- Motion: `{ opacity: 0, y: -8 }` → visible, spring, delay 0.05

### 2.2 Headline
- Text: `Your SCA exam,\nrehearsed before it counts.`
- Style: `clamp(48px, 5vw + 1rem, 72px)`, weight 700, `--heading`, tracking `-0.03em`, `line-height: 1.05`, centered
- "rehearsed" styled with: `font-style: italic`, `background: linear-gradient(135deg, #B45309, #D97706)`, `background-clip: text`, `color: transparent`
- Motion: Word-by-word stagger, 80ms per word, spring `stiffness: 90, damping: 18`

### 2.3 Subline
- Text: "AI patients that talk back, push back, and score you on every domain. Pick a case and start a consultation in under 60 seconds."
- Style: 18px, `--body`, `line-height: 1.7`, max-width 480px, centered
- Motion: `{ opacity: 0, y: 14 }` → visible, spring, delay 0.65

### 2.4 Interactive Case Card
- Position: centered, 32px below subline
- Container: `border-radius: 20px`, `background: --window-bg`, `border: 1px solid rgba(0,0,0,0.06)`, `box-shadow: 0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)`, `max-width: 480px`, `width: 100%`
- **Left accent**: 3px wide amber gradient strip on the left edge inside the rounded border
- **Data source**: Pull a real station from Supabase `stations` table (or hardcode a representative case)

**Card inner layout** (padding 24px):

**Patient identity row**:
- Avatar: 48px circle, amber gradient bg, white "MT" initials 16px semibold
- Name: "Mrs. Margaret Thompson" — 15px semibold, `--heading`
- Meta: "62 · Female · Retired teacher" — 12px, `--muted`
- Duration pill: `background: rgba(180,83,9,0.08)`, `color: #B45309`, 11px mono semibold, `border-radius: 999px`, `padding: 4px 12px`, text "12 min"

**Divider**: 1px `rgba(0,0,0,0.05)`, 20px margin top/bottom

**Presenting complaint**:
- Label: "PRESENTING COMPLAINT" — 10px, `--muted`, letter-spacing `0.1em`, uppercase
- Text: "Headache for three days, worse in the mornings. Patient is concerned about the severity." — 15px, `--body`, line-height 1.7

**Your task**:
- Label: "YOUR TASK" — same label style
- Text: "Explore the patient's symptoms, address their concerns, and formulate an appropriate management plan." — 15px, `--body`, line-height 1.7

**Domain tags row** (24px below):
- Three inline tags: "Data Gathering" · "Clinical Management" · "Interpersonal Skills"
- Each: `border-radius: 8px`, `padding: 6px 12px`, `background: rgba(180,83,9,0.06)`, `color: #92400E`, 11px semibold, `gap: 8px`

**CTA button** (32px below):
- Full width inside card
- `border-radius: 12px`, `background: linear-gradient(135deg, #B45309, #D97706)`, `color: white`, 14px semibold, `padding: 14px 0`, centered text
- Text: "Start consultation →"
- `box-shadow: 0 4px 12px rgba(180,83,9,0.2)`
- Links to `/try/station/[stationId]`

**Below card**: "or browse all 78 cases →" — 13px, `--muted`, centered, `--primary` on hover, 16px below card

### 2.5 Scroll Indicator
- Minimal chevron SVG, centered, bottom of viewport
- `animate={{ y: [0, 6, 0] }}`, duration 2s, infinite, ease

**Card motion**: Slides up from `{ opacity: 0, y: 30 }` with spring, delay 0.8, slight initial rotation `rotate: 1` settling to `rotate: 0`

---

## Section 3: Scroll-Driven Product Journey

**Layout**: Container max-width 1200px, centered. 4 chapters, each ~100vh. The product window uses `position: sticky` to stay pinned while chapter text scrolls alongside.

**Sticky container**: The product window frame pins at `top: 120px` (below nav) and stays while 4 chapters of text scroll past on the left side.

**Grid**: `grid-cols-1 lg:grid-cols-2`, `gap: 20`, items-center on desktop. On mobile, each chapter stacks vertically (text above, window below, no sticky behavior).

**Scroll mechanics**:
- `useScroll({ target: journeyRef })` tracks overall journey progress (0→1)
- `useTransform(scrollProgress, [0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1], [...])` maps to chapter transitions
- Window content cross-fades between chapters using `AnimatePresence` with `mode="wait"`
- Chapter text fades in/out based on its scroll position within the viewport

### Product Window Frame (shared)

- `border-radius: 20px`
- `background: #FFFCF8`
- `border: 1px solid rgba(0,0,0,0.06)`
- `box-shadow: 0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)`
- **Top bar**: 48px height, `border-bottom: 1px solid rgba(0,0,0,0.05)`
  - Left: 8px amber dot (`#B45309`) + "Station 14 · Mrs. Thompson" in 11px mono, `--muted`
  - Right: Timer in 12px mono, `--primary` — changes per chapter (08:00 → 04:26 → COMPLETE → —)

### Chapter 1: "Read your brief"

**Text side**:
- Chapter number: "01" — 36px, `--primary` at 30% opacity, mono weight
- Heading: "Read your patient brief" — 36px, weight 700, `--heading`
- Body: "Every station starts with a scenario. You get the same information a real SCA candidate gets — presenting complaint, patient background, and your task." — 16px, `--muted`, line-height 1.7, max-width 400px

**Window content**: Patient brief view (same design as the hero case card interior but within the window frame):
- Patient identity row (avatar, name, meta, duration pill)
- Divider
- Presenting complaint section
- Your task section
- Domain tags
- "Begin consultation" button

**Scroll animation**: Brief content fades in line by line as user scrolls deeper into this chapter.

### Chapter 2: "Have the conversation"

**Text side**:
- "02" chapter number
- Heading: "Have the conversation" — 36px, weight 700
- Body: "Your patient responds in real-time with voice. They'll answer your questions, volunteer symptoms when prompted, and push back if you're vague — just like the real exam." — 16px
- Three detail lines (staggered fade-in, 12px, `--muted`):
  - "Real-time voice · Deepgram + Cartesia"
  - "Adaptive emotional responses"  
  - "8-minute timed consultations"

**Window content**: Live consultation view:

**Patient header strip**:
- 40px avatar, name "Mrs. Thompson" 13px semibold, meta "Headache · 3 days" 11px muted
- Right: 6px green circle pulsing + "LIVE" 10px semibold green uppercase

**Transcript area** (messages revealed progressively on scroll):

Patient messages (left-aligned):
- `max-width: 75%`, `background: rgba(0,0,0,0.03)`, `border: 1px solid rgba(0,0,0,0.05)`
- `border-radius: 16px 16px 16px 4px`, `padding: 12px 16px`, 13px `--body`, line-height 1.6

Doctor messages (right-aligned):
- `max-width: 70%`, `background: linear-gradient(135deg, #B45309, #D97706)`
- `border-radius: 16px 16px 4px 16px`, `padding: 12px 16px`, 13px white, line-height 1.6
- 12px gap between messages

Transcript content:
1. Patient: "I've had this terrible headache for three days now. It's mostly in the mornings when I wake up."
2. Doctor: "I'm sorry to hear that, Mrs. Thompson. Can you show me where exactly you feel the pain?"
3. Patient: "It's right here, at the back of my head. Sometimes behind my eyes too. I'm worried it might be something serious."
4. Doctor: "I understand your concern. Have you noticed anything else — any changes in your vision, or feeling sick with it?"

Each message animates in: `{ opacity: 0, y: 8 }` → `{ opacity: 1, y: 0 }` spring

**Voice bar** (bottom of window):
- 64px height, `border-top: 1px solid rgba(0,0,0,0.05)`, `background: rgba(255,252,248,0.8)`, `backdrop-blur: 12px`
- Left: WaveformBars component (24 bars, 3px wide, `--primary` at 50% opacity)
- Center: 44px circle mic button, amber gradient bg, white mic SVG
- Right: "04:26" in 12px mono, `--muted`

### Chapter 3: "See your score"

**Text side**:
- "03" chapter number
- Heading: "See exactly where you stand" — 36px, weight 700
- Body: "Instant, domain-level feedback scored on the three SCA marking criteria. Know your strengths. Know what to fix." — 16px

**Window content**: Score dashboard:

**Score header**:
- Label: "SESSION COMPLETE" — 10px uppercase, `--muted`, letter-spacing 0.1em
- Score: "78" — 56px, weight 800, amber gradient text (background-clip)
- Sub: "out of 100 · Station 14" — 13px, `--muted`
- Pass pill (right-aligned): `background: rgba(34,197,94,0.1)`, `color: #16A34A`, 11px semibold uppercase, `padding: 6px 16px`, `border-radius: 999px`, text "✓ Pass"

**Divider**: 1px rule, 24px margin

**Domain scores** (three rows, 16px gap):
- Label: 13px, `--stone-light`, 140px width
- Bar track: flex-grow, 8px height, `border-radius: 999px`, `background: rgba(0,0,0,0.04)`
- Bar fill: 8px, `border-radius: 999px`, `background: linear-gradient(90deg, #B45309, #F59E0B)`, width animates 0→target% with spring, 150ms stagger
- Score: 13px mono, `--heading`, semibold, right-aligned
- Values: Data Gathering 82%, Clinical Management 71%, Interpersonal Skills 88%

**Divider**: 1px rule, 24px margin

**Feedback items** (two items, 10px gap):
- Container: `border-radius: 12px`, `background: rgba(0,0,0,0.02)`, `border: 1px solid rgba(0,0,0,0.04)`, `padding: 14px 16px`
- Icon + text: ✓ `--primary` or ⚡ `--primary-light`, 13px `--stone-light` line-height 1.6
- Strength: "Strong open questions exploring the patient's ideas, concerns, and expectations throughout the consultation"
- Improve: "Consider safety-netting for red flag symptoms earlier — ask about visual disturbance, neck stiffness, and fever"

**Scroll animation**: Score counter 0→78. Pass pill spring bounce. Bars fill staggered. Feedback slides up 80ms apart.

### Chapter 4: "Track your progress"

**Text side**:
- "04" chapter number
- Heading: "Improve with every session" — 36px, weight 700
- Body: "Your consultation history builds a picture of your growth. See trends across domains, revisit feedback, and focus your practice where it matters most." — 16px

**Window content**: Progress dashboard:

**Progress chart**:
- Label: "YOUR PROGRESS" — 10px uppercase label
- Sparkline: 100% width, 120px height, 6 data points, smooth amber line (`stroke: #B45309`, width 2), gradient fill below (`rgba(180,83,9,0.06)`)
- X-axis: S1–S6, 10px mono muted
- Latest point: 6px amber dot, label "78"
- Animation: path draws left→right on scroll (`pathLength` animation)

**Divider**: 1px rule

**Domain trends** (three compact rows):
- Domain name: 12px, `--stone-light`
- Mini sparkline: 40px wide, 3 points, amber stroke
- Current score: 13px semibold
- Delta: "↑ 12%" in 11px `--success` green (or "→ 0%" muted)

**Stats row** (bottom, three stats with 1px vertical rule separators):
- Each: number in 24px semibold `--heading`, label in 11px `--muted`
- "6" / sessions completed
- "78" / average score
- "12%" / improvement (number in green)

**Scroll animation**: Chart line draws. Sparklines animate. Stats count from 0.

---

## Section 4: Social Proof

**Layout**: Full width, `padding: 120px 0`, centered column, max-width 680px

**Section label**: "WHAT TRAINEES SAY" — 10px, `--primary`, uppercase, letter-spacing `0.12em`, centered

**Three testimonials** separated by `1px rgba(0,0,0,0.06)` horizontal rules, 48px padding between each:

Each testimonial:
- Quote: 24px, weight 500, `--heading`, line-height 1.6. No quotation marks.
- Attribution (16px below): 28px circular avatar (amber gradient, white initials) + name and details in 13px, `--muted`

**Testimonials**:
1. Avatar "SC" — "I failed my first SCA attempt. After two weeks of practising on here I passed comfortably. The AI feedback pinpointed exactly what I was missing." — Dr. Sarah Chen, ST3 · London
2. Avatar "JM" — "It's the closest thing to a real consultation I've found. The patients actually push back when you're being vague." — Dr. James Mwangi, ST2 · Birmingham
3. Avatar "RP" — "The domain-level scoring changed how I prepare. I stopped guessing and started targeting my weak areas." — Dr. Riya Patel, ST3 · Manchester

**Stat line** (40px below last testimonial, centered):
- "**340+** trainees practising across **22** deaneries"
- 16px base, numbers in 20px semibold `--primary`

**Motion**: Each testimonial `whileInView={{ opacity: 1, y: 0 }}` from `{ opacity: 0, y: 16 }`, spring, staggered

---

## Section 5: Final CTA

**Layout**: Full width, `padding: 160px 0`, centered, max-width 560px

1. **Headline**: "Start your first consultation" — 40px, weight 700, `--heading`, centered
2. **Subline** (12px below): "Pick a case. Talk to your patient. Get scored. No account needed." — 16px, `--stone-light`, centered
3. **CTA button** (32px below):
   - `border-radius: 14px`, `background: linear-gradient(135deg, #B45309, #D97706)`, `color: white`, 14px semibold
   - `padding: 16px 48px`
   - `box-shadow: 0 8px 24px rgba(180,83,9,0.18)`
   - Text: "Try a free case →"
   - Hover: `y: -2` spring, shadow deepens
   - Links to `/try/`
4. **Secondary link** (16px below): "Already have an account? Sign in" — 13px, `--muted`, "Sign in" in amber underlined. Links to `/auth/sign-in`

**Motion**: Headline + subline fade in on scroll, button scales from 0.95 with spring bounce.

---

## Section 6: Footer

**Layout**: Full width, `border-top: 1px solid rgba(0,0,0,0.06)`, `padding: 48px 0`, warm cream bg continues

**Single row**, max-width 1200px, `justify-between`:

- **Left**: 
  - "Fourteen Fisherman" — 14px semibold
  - Below: "Built by GP trainees, for GP trainees. © 2025" — 12px, `--muted`
- **Right**: "Privacy · Terms · Contact" — 13px, `--stone-light`, 24px gaps between

No multi-column footer. Static, no motion.

---

## Responsive Behavior

**Desktop (lg, 1024px+)**: Full two-column layout for product journey. Sticky window frame.

**Tablet (md, 768–1023px)**: Product journey becomes stacked — text above, window below for each chapter. No sticky behavior. Reduce hero headline to ~48px.

**Mobile (<768px)**: 
- Nav collapses to wordmark + hamburger
- Hero headline ~40px, case card full-width with reduced padding
- Product journey fully stacked, each chapter independent scroll section
- Testimonial quotes drop to 20px
- Footer stacks vertically

---

## Technical Notes

### Dependencies
- `framer-motion` (already installed) — all animations
- `@supabase/supabase-js` (already installed) — auth check, case card data
- No new dependencies needed

### Component Structure
```
app/page.tsx                    — Main landing page (single file, or split below)
components/landing/
  Navbar.tsx                    — Floating pill nav
  Hero.tsx                      — Hero section + case card
  ProductJourney.tsx            — Scroll-driven 4-chapter section
  ProductWindow.tsx             — Shared window frame component
  ChapterBrief.tsx              — Chapter 1 window content
  ChapterConsultation.tsx       — Chapter 2 window content
  ChapterScore.tsx              — Chapter 3 window content
  ChapterProgress.tsx           — Chapter 4 window content
  WaveformBars.tsx              — Extracted from current page (reused)
  SocialProof.tsx               — Testimonials section
  FinalCTA.tsx                  — Bottom CTA section
  Footer.tsx                    — Minimal footer
```

### Scroll Implementation
- `useScroll()` with `target` ref on the journey container
- `useTransform()` maps scroll progress to chapter transitions
- `useMotionValueEvent()` to trigger chapter changes
- `AnimatePresence` with `mode="wait"` for window content cross-fades
- `position: sticky` on the window frame (CSS, not Framer Motion)
- Mobile: no sticky, each chapter is a standalone `whileInView` section

### Data
- Hero case card: hardcode a representative station (Mrs. Thompson headache case) or fetch one from Supabase
- Testimonials: hardcoded placeholder data (user will update later)
- Stats: hardcoded placeholder (340+ trainees, 22 deaneries)

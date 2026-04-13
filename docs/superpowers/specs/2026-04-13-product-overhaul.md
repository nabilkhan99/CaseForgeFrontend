# Fourteen Fisherman — Complete Product Overhaul Spec

**Date**: 2026-04-13
**Status**: Approved
**Scope**: Every user-facing screen, all critical bugs, unified design system

---

## Context

Fourteen Fisherman is a medical education SaaS for GP trainees preparing for the SCA exam. It has two products:

1. **Clinical Master** — Voice-based SCA consultation practice (the primary product)
2. **Portfolio Tool** — CCR/portfolio case review generator (existing product with active users)

The landing page was just redesigned with a warm, editorial aesthetic (amber palette, Plus Jakarta Sans, Framer Motion, cream backgrounds, no card grids). The rest of the product is dark mode with blue accents, heavy sidebars, card grids, and multiple broken flows. This spec covers redesigning every screen to match the landing page brand and fixing every critical bug.

### The Product Loop

```
Landing Page → Pick a Case → Read Brief → Voice Consultation → Feedback/Scoring → Dashboard (track progress) → Pick Another Case
```

### Two Entry Points

- **Authenticated users**: Landing → Sign in → Dashboard → Pick case → Brief → Consultation → Feedback
- **Guest users (try flow)**: Landing → Case card → Brief → Consultation → Auth gate → Feedback

### What Must Be Preserved

- All Supabase queries and data layer (tables: stations, domains, clinical_sessions, session_results, domain_progress, profiles)
- LiveKit integration for voice consultations (useLiveKitSession hook)
- Azure Functions API for portfolio tool (lib/api.ts → caseforge2025a.azurewebsites.net)
- Auth flow logic (middleware protects /dashboard and /clinical-master, /try is public)
- The `/try` flow concept (guest can try one case without signing up)
- The portfolio tool routes (`/cases`, `/cases/[id]`)

---

## Phase 1: Design System Foundation

### 1.1 Color Tokens

All screens use these tokens. No hardcoded hex values outside of this system.

| Token | Value | Usage |
|-------|-------|-------|
| `--surface` | `#FAFAF7` | Page background everywhere |
| `--surface-raised` | `#FFFCF8` | Cards, windows, elevated content |
| `--primary` | `#B45309` | Amber primary — CTAs, active states, accents |
| `--primary-light` | `#D97706` | Amber light — gradients, hover |
| `--primary-lighter` | `#F59E0B` | Amber lighter — subtle accents |
| `--heading` | `#1C1917` | Near-black headings |
| `--body` | `#44403C` | Body text (stone-700) |
| `--muted` | `#A8A29E` | Meta text, labels, placeholders |
| `--stone-500` | `#78716C` | Secondary text |
| `--border` | `rgba(0,0,0,0.06)` | Subtle borders |
| `--border-hover` | `rgba(0,0,0,0.10)` | Hover borders |
| `--success` | `#16A34A` | Pass, positive |
| `--danger` | `#DC2626` | Fail, errors, destructive |
| `--amber-gradient` | `linear-gradient(135deg, #B45309, #D97706)` | Primary gradient |
| `--warm-shadow` | `0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)` | Elevated container shadow |

**Removed**: All zinc colors (`#09090b`, `#0c0c0f`, `zinc-800`, `zinc-900`). All blue accents. All dark backgrounds.

### 1.2 Typography

Font: **Plus Jakarta Sans** everywhere. Remove the Inter import from try flow layout.

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page title (h1) | `clamp(32px, 4vw, 48px)` | 700 | `--heading` |
| Section heading (h2) | 24–28px | 700 | `--heading` |
| Card heading (h3) | 16–18px | 600 | `--heading` |
| Body | 14–15px | 400 | `--body` |
| Small/meta | 12–13px | 400–500 | `--muted` |
| Labels | 10–11px | 600 | `--muted` or `--primary`, uppercase, tracking 0.1em |
| Mono (timers, scores) | 12–14px | 600 | `--primary` or `--heading`, font-mono |

### 1.3 Component Patterns

**Container (the "product window"):**
- `border-radius: 20px`
- `background: var(--surface-raised)` (#FFFCF8)
- `border: 1px solid var(--border)`
- `box-shadow: var(--warm-shadow)`
- Used for: consultation windows, feedback panels, case cards, settings forms

**Primary button:**
- `background: var(--amber-gradient)`
- `color: white`, 14px semibold
- `border-radius: 12px`, `padding: 12px 24px`
- `box-shadow: 0 4px 12px rgba(180,83,9,0.2)`
- Hover: `y: -2` spring, shadow deepens
- Used for ALL primary CTAs across the product

**Secondary button:**
- `background: transparent`
- `border: 1px solid var(--border)`
- `color: var(--body)`
- `border-radius: 12px`
- Hover: `border-color: var(--border-hover)`, subtle bg

**Score badge:**
- Pass (>=70): `background: rgba(34,197,94,0.1)`, `color: #16A34A`
- Borderline (>=50): `background: rgba(217,119,6,0.1)`, `color: #D97706`
- Fail (<50): `background: rgba(220,38,38,0.1)`, `color: #DC2626`
- `border-radius: 8px`, `padding: 4px 10px`, 11px font-mono bold

**Domain tag:**
- `background: rgba(180,83,9,0.06)`, `color: #92400E`
- `border-radius: 8px`, `padding: 6px 12px`, 11px semibold

**Input field:**
- `background: white/70`, `border: 1px solid var(--border)`
- `border-radius: 12px`, `padding: 12px 16px`
- Focus: `ring-2 ring-primary/30`
- Uses existing `AuthInput` pattern as the standard

**Navigation (top bar, replaces sidebar):**
- Floating pill navbar (same pattern as landing page LandingNavbar)
- Within the app (post-login): tabs instead of sidebar
- Tab bar: `border-bottom: 1px solid var(--border)`, horizontal links
- Active tab: `color: var(--primary)`, `border-bottom: 2px solid var(--primary)`

**No card grids.** Features, stats, and cases are rendered as lists, tables, or flowing content. The only "card" is the product window container.

### 1.4 Animation Patterns

Framer Motion everywhere:
- Page transitions: `{ opacity: 0, y: 12 }` → `{ opacity: 1, y: 0 }`, spring stiffness 60
- `whileInView` for scroll reveals (landing page pattern)
- Score bars: `initial={{ width: 0 }}` → `animate={{ width: target }}`, spring with stagger
- Buttons: `whileHover={{ y: -2 }}`, `whileTap={{ scale: 0.98 }}`
- Lists: staggered children with 60ms delay

### 1.5 Icons

Replace Material Symbols with inline SVGs throughout. The landing page already uses inline SVGs — extend this pattern. This eliminates the external font load, FOUC risk, and inconsistent icon styling.

### 1.6 Files to Create/Modify

**Create:** `components/ui/` directory with shared components:
- `components/ui/Container.tsx` — the product window container
- `components/ui/PrimaryButton.tsx` — amber gradient button
- `components/ui/SecondaryButton.tsx` — outlined button  
- `components/ui/ScoreBadge.tsx` — pass/borderline/fail badge
- `components/ui/DomainTag.tsx` — domain label pill
- `components/ui/TabNav.tsx` — horizontal tab navigation bar
- `components/ui/AppNavbar.tsx` — authenticated app navbar (replaces sidebar)
- `components/ui/FormInput.tsx` — styled form input (based on AuthInput)
- `components/ui/PageHeader.tsx` — consistent page title + subtitle + breadcrumb

**Modify:** `app/globals.css` — remove all dark mode CSS (`.glass-card` zinc styles, dark scrollbar). Update CSS variables. Keep the noise texture overlay (it adds warmth).

**Modify:** `tailwind.config.ts` — update `surface` color to `#FAFAF7`, add `surface-raised: '#FFFCF8'`. Remove zinc references. Ensure all color tokens match the spec.

---

## Phase 2: Core Loop (Brief → Consultation → Feedback)

The screens users spend the most time in. These should look like the landing page chapter mockups came to life.

### 2.1 Station Selection → Remove as Standalone Page

Currently `/clinical-master` is a station selection page. This is redundant — users already pick stations from the dashboard library or the landing page case card. 

**Change:** `/clinical-master` becomes a redirect:
- If `?station=X` param present → redirect to `/clinical-master/station/X`
- If no param → redirect to `/dashboard/library`

### 2.2 Reading Phase (`/clinical-master/station/[stationId]`)

**Current:** Dark three-column layout (sidebar + document + notepad), dead buttons, timer does nothing.

**New design:** Single focused view matching Chapter 1 from the landing page.

**Layout:** Full screen, cream background (`--surface`). Centered content column (max-width 640px). No sidebar. No three-column layout.

**Top bar** (sticky, 56px):
- Left: "← Back to Library" link
- Center: Timer countdown (reading_duration_seconds) in mono, amber color
- Right: Station label ("Station 14") in 12px muted

**Main content** — inside a Container (product window):
- Patient identity row: avatar (amber gradient, initials), name, age/gender/occupation, duration pill
- Divider
- Presenting complaint (highlighted with amber left border, subtle amber bg)
- Your task
- Medical history (PMH, medications, allergies) — if available from `candidate_instructions`
- Domain tags
- Reading timer progress bar (amber, animating down)

**Bottom** — fixed:
- "Begin Consultation →" primary button (full width within content column)
- Disabled until timer is at least 50% done (can't skip reading too quickly), enabled fully when timer completes
- On click: creates session, navigates to session page

**Bug fixes:**
- Timer completion enables the CTA button prominently (visual state change, not just console.log)
- Remove "End Exam" dead button
- Remove StationSidebar (hardcoded 0/1 progress, never updates)
- Remove Notepad from reading phase (notes belong in the consultation, not the brief)
- Use `router.push()` instead of `window.location.href`

**Session creation:** When "Begin Consultation" is clicked:
1. Generate `crypto.randomUUID()` for session ID
2. Call a NEW API endpoint `POST /api/clinical-master/create-session` with `{ sessionId, stationId }` that creates the `clinical_sessions` record in Supabase with status 'reading'
3. On success, `router.push(/clinical-master/session/${sessionId}?stationId=${stationId})`

This fixes the critical bug where no session record exists when the LiveKit agent starts.

### 2.3 Live Consultation (`/clinical-master/session/[sessionId]`)

**Current:** Dark layout with transcript feed (product is audio-only), three-column with notepad.

**New design:** Full-screen focused voice interface matching Chapter 2 from the landing page.

**Layout:** Full viewport, cream background. Minimal chrome — the consultation IS the product.

**Top bar** (sticky, 48px):
- Left: patient name + presenting complaint (13px, muted)
- Center: countdown timer (large mono, amber). Pulses when under 2 minutes remaining. Turns red in last 30 seconds.
- Right: "LIVE" indicator (green dot + label)

**Center area** — full viewport minus top/bottom bars:
- Large patient avatar (80px, amber gradient, pulsing rings when patient is speaking)
- "Patient Speaking" / "Listening..." label below avatar
- Large waveform visualization (same as landing page Chapter 2 — BarWaveform or AudioVisualizer)
- No transcript feed (product is audio-only)

**Bottom bar** (fixed, 72px):
- Left: Notepad toggle button (opens slide-out panel, not a permanent column)
- Center: Mic button (large, amber gradient, glowing shadow when active)
- Right: "End Consultation" button (red outline, requires confirmation)

**Notepad** — slide-out drawer from right, not a permanent column:
- Only appears when notepad button is toggled
- Free-text area with localStorage persistence
- Save notes PER STATION (key: `notes-${stationId}`) — fix the current bug where all stations share one key

**Bug fixes:**
- Remove TranscriptFeed component from consultation view (audio-only product)
- Remove permanent Notepad column (make it a toggle drawer)
- Timer: no pause button (defeats exam simulation purpose). Warning colors when time low.
- Timer `onComplete`: automatically ends consultation (calls `endConsultation()`) — no manual action needed
- Fix `ConsultationTimer` double-fire of `onComplete` (add a `hasFired` ref guard)
- Navigate to `/clinical-master/feedback/${sessionId}` (NOT `/dashboard/feedback/`) to maintain visual continuity
- Fix orphaned audio elements: clean up on disconnect
- Remove `confirm()` dialog — replace with a styled modal component
- Handle missing `stationId` query param gracefully (show error, redirect to library)

### 2.4 Feedback (`/clinical-master/feedback/[sessionId]`)

**Current:** Dark mode, incomplete domain data, re-exported at `/dashboard/feedback/`.

**New design:** Warm cream, matching Chapter 3 from the landing page but as a full page.

**Layout:** Cream background, centered content column (max-width 720px), generous padding.

**Top bar** (same AppNavbar as rest of app):
- Breadcrumb: "Dashboard > Station 14 > Feedback"

**Content:**

**Score hero** (top, centered):
- Animated SVG ring gauge (same as landing page ChapterScore)
- Large score number (56px, amber gradient text)
- "out of 100 · Station 14 · Mrs. Thompson" subtitle
- Pass/Refer badge with spring bounce animation

**Domain breakdown** (below, three rows):
- Each domain: label, descriptor ("Clear & systematic"), score percentage, animated bar
- Bars have amber gradient fill, spring animation with stagger

**Feedback sections** (below, two columns on desktop, stacked on mobile):
- **Strengths** column: green left border, pulling from ALL three domains' strengths (not just data_gathering)
- **Improvements** column: amber left border, pulling from ALL three domains' improvements (not just clinical_management)

**Key learning points** (below):
- Numbered list, flowing text

**Bottom actions:**
- "Practice Another Case →" primary button → `/dashboard/library`
- "Back to Dashboard" secondary link → `/dashboard`
- "Review This Station Again" tertiary link → `/clinical-master/station/${stationId}`

**Bug fixes:**
- Pull strengths from ALL domains (data_gathering + clinical_management + interpersonal_skills), not just one
- Pull improvements from ALL domains, not just one
- Add auth check to `/api/generate-feedback` endpoint (verify user owns the session)
- Remove the re-export at `/dashboard/feedback/[sessionId]` — feedback always renders at `/clinical-master/feedback/[sessionId]`, navigation from dashboard history links there directly
- Fix feedback redirect: sessions navigating to feedback should go to `/clinical-master/feedback/` not `/dashboard/feedback/`

---

## Phase 3: Dashboard

### 3.1 Layout — Kill the Sidebar

**Current:** 260px dark sidebar on every page.

**New:** Remove `DashboardSidebar`. Replace with `AppNavbar` — a top bar consistent with the landing page nav.

**AppNavbar (authenticated):**
- Same floating pill design as `LandingNavbar`
- Left: "Fourteen Fisherman" wordmark
- Center: tab links — "Home" · "Library" · "History" · "Portfolio" · "Settings"
- Right: user avatar (amber gradient, initials) with dropdown (Settings, Sign Out)
- "Portfolio" tab links to `/cases` (the existing portfolio tool)

**Dashboard layout.tsx:** Remove the sidebar flex layout. Just render `<AppNavbar />` + `{children}` on cream background.

### 3.2 Dashboard Home (`/dashboard`)

**Current:** Dark mode, 3 StatCards, broken ResumeCard, PerformancePulse bars, BlueprintGrid card grid.

**New design:** Clean, warm, focused on ONE action.

**Layout:** Cream background, max-width 800px centered, generous padding.

**Welcome section** (top):
- "Good morning, {firstName}" — 28px, bold, heading color
- "You've completed {n} sessions · {streak}-day streak" — 14px, muted
- If exam date set: "SCA exam in {n} days" pill badge

**Quick start** (below):
- If there's a resumable session: Container showing patient name, station, "Continue →" primary button — ACTUALLY WIRED to navigate to the session
- If no resumable session: "Start a new session" primary button → `/dashboard/library`

**Recent sessions** (below, if any exist):
- Section label: "RECENT SESSIONS" (10px uppercase muted)
- Last 3 completed sessions as compact rows (NOT cards):
  - Each row: station title, domain tag, score badge, relative time
  - Click entire row → `/clinical-master/feedback/${sessionId}`
- "View all history →" link → `/dashboard/history`

**Domain progress** (below):
- Section label: "YOUR PROGRESS" (10px uppercase muted)
- Three domain bars (same design as landing page ChapterScore):
  - Label, score %, animated amber bar
  - Pass threshold line at 70%
- "View library →" link → `/dashboard/library`

**No StatCards. No BlueprintGrid. No card grids.** Just flowing content with section labels and thin dividers.

**Bug fixes:**
- Wire ResumeStationCard to actually navigate (or replace with the new resumable session component)
- Fix `timeRemaining` to show actual remaining time (not full station duration)
- Fix exam date: read from `user_metadata.exam_date` (where Settings saves it), OR sync Settings to write to `profiles` table
- Show real total count for sessions (add a count query, not just `sessions.length`)

### 3.3 Station Library (`/dashboard/library`)

**Current:** Dark card grid of domains.

**New design:** Clean list of domains.

**Layout:** Cream background, max-width 800px centered.

**Header:**
- "Station Library" — 28px bold
- "{n} stations across {n} domains" — 14px muted
- Search input (optional, filter by station name)

**Domain list** — vertical, no grid:
Each domain is a row:
- Left: domain name (16px semibold) + "{n} stations · {completed} completed" (12px muted)
- Right: average score badge + chevron
- Click → `/dashboard/library/${domainId}`
- Separated by thin borders
- Domains with 0 stations are hidden (not shown with opacity)

**Extract shared constants:** `domainIcons`, `domainColors` into a shared file (currently duplicated between library page and domain detail page).

### 3.4 Domain Detail (`/dashboard/library/[domainId]`)

**Current:** Dark, inline StationCard component, overflow issues.

**New design:** Clean station list.

**Layout:** Cream background, max-width 800px.

**Header:**
- Breadcrumb: "Library > {Domain Name}"
- Domain name (28px bold) + "{completed}/{total} stations" + average score badge

**Station list:**
Each station is a row:
- Left: station title (15px semibold) + patient name + difficulty tag
- Right: score badge (if attempted) or "Not started" muted text + "Start →" button
- Click row → expand to show attempt history (sessions with scores and dates)
- From expanded: "Try Again" → `/clinical-master/station/${stationId}`, "View Feedback" → `/clinical-master/feedback/${sessionId}`

**Fix:** Remove `overflow-hidden` from main element. Use normal scrolling.

### 3.5 Session History (`/dashboard/history`)

**Current:** Dark, SessionHistoryCards with cursor-pointer but only chevron links.

**New design:** Clean session table.

**Layout:** Cream background, max-width 900px.

**Header:**
- "Session History" — 28px bold
- Total sessions count (from a proper count query, not array length)

**Session list:**
Each session is a clickable row (entire row navigates):
- Station title, domain tag, score badge (colored), "Pass"/"Refer" label, relative date
- Click → `/clinical-master/feedback/${sessionId}`
- Thin borders between rows
- Staggered fade-in animation

**Pagination:** "Load more" button, same logic as current but with correct total count display.

### 3.6 Settings (`/dashboard/settings`)

**Current:** Dark cards, exam date sync bug.

**New design:** Warm cream, simple form.

**Layout:** Cream background, max-width 560px centered.

**Sections:**
- Profile: avatar (amber gradient), name input, email (read-only)
- Exam date: date picker with clear description
- Account: sign out button (red outline)

**Bug fix:** When saving, write exam_date to BOTH `user_metadata` AND `profiles` table. Or change dashboard queries to read from `user_metadata`.

---

## Phase 4: Try Flow

### 4.1 Critical Fix: Session Creation

**The #1 bug:** No `clinical_sessions` record is ever created in the try flow.

**Fix:** Create a new API endpoint `POST /api/try/create-session`:
- Accepts `{ sessionId, stationId }`
- Creates a `clinical_sessions` record with `user_id: null`, `station_id`, `status: 'reading'`
- Uses admin client (service role key) to bypass RLS
- Called from the station page when "Start Consultation" is clicked, BEFORE navigating to the session page

The existing `/api/try/claim-session` then works correctly — it finds the record with `user_id IS NULL` and assigns the authenticated user's ID.

### 4.2 Try Flow Layout

**Current:** Dark `#070A13`, Inter font, external Material Symbols load.

**New:** Warm cream, Plus Jakarta Sans (inherit from global layout), inline SVG icons.

**Remove** the entire `app/try/layout.tsx` custom layout. The try flow should inherit the root layout's font and styles. Add only a minimal "Exit" button in the top-left corner of try pages.

### 4.3 Case Picker (`/try`)

**Current:** Dark with domain-colored gradient cards.

**New design:** Warm cream, simple case list matching the landing page aesthetic.

**Layout:** Cream background, centered, max-width 600px.

**Header:**
- "Try a Free Case" — 28px bold
- "Pick a station and start a consultation. No account needed." — 14px muted

**Case list:** Each free case as a Container:
- Patient name, presenting complaint preview, domain tag, duration pill
- "Start →" primary button
- Click → `/try/station/${stationId}`

**Fix:** "Already have an account? Sign in" → change href to `/auth/sign-in` (currently goes to `/auth/sign-up`).

### 4.4 Try Station Brief (`/try/station/[stationId]`)

**Same design as Phase 2.2** (clinical-master station page) but:
- No auth required
- "Back" link goes to `/try` instead of `/dashboard/library`
- Session creation calls `/api/try/create-session` instead of `/api/clinical-master/create-session`
- Navigates to `/try/session/${sessionId}?stationId=${stationId}`

### 4.5 Try Session (`/try/session/[sessionId]`)

**Same design as Phase 2.3** (clinical-master session page) but:
- Token endpoint: `/api/try/livekit-token`
- On end: navigates to `/try/feedback/${sessionId}`
- No auth header/user context in the AppNavbar (show "Exit" button only)

### 4.6 Try Feedback Gate (`/try/feedback/[sessionId]`)

**Current:** Dark blurred preview + auth panel.

**New design:** Warm cream, cleaner layout.

**Layout:** Cream background, centered content.

**Top:** A real (not blurred) but partial feedback preview:
- Show the overall score ring gauge and pass/refer badge
- Domain bars visible but improvements/strengths hidden behind a soft gradient fade
- "Sign up to see your full feedback and track your progress"

**Bottom:** Auth form (sign up / sign in toggle):
- Reuse the existing `AuthCard` + `AuthInput` components (they already match the warm brand)
- On successful auth: call `/api/try/claim-session`, then redirect to `/clinical-master/feedback/${sessionId}`

**Bug fixes:**
- Ensure claim-session works now that session records are properly created (Phase 4.1)
- Fix email confirmation redirect: set `emailRedirectTo` to the callback route with a `next` param pointing to `/clinical-master/feedback/${sessionId}`
- Fix middleware: after claiming session, the redirect to `/clinical-master/feedback/` should work because the user is now authenticated

---

## Phase 5: Pricing, Auth, Navigation

### 5.1 Pricing (`/pricing`)

**Current:** Dark `#09090b`, blue accent, CTA buttons broken (stopPropagation).

**New design:** Warm cream, amber accent, functional CTAs.

**Layout:** Cream background, centered content.

**Three pricing tiers** — NOT as cards in a grid. Vertical stack with the recommended plan highlighted:
- Each tier: plan name, price, feature list, primary/secondary CTA button
- Recommended plan: slightly larger, amber left border accent, "Most Popular" badge
- CTAs are real `<Link>` components wrapping primary buttons (no stopPropagation)

**Bug fixes:**
- Remove `onClick={(e) => e.stopPropagation()}` from CTA buttons
- Make CTA buttons actual `<Link href="/auth/sign-up?plan=X">` wrapping primary buttons
- On sign-up page: READ the `plan` query param and store it (in user_metadata or a separate table) for later subscription provisioning

**Free cases CTA:** "Browse Free Cases →" links to `/try` (not `/cases`)

### 5.2 Auth Pages

Auth pages already use the warm brand (cream bg, amber accent, AuthLayout). Minimal changes needed:

**Sign In (`/auth/sign-in`):**
- Read and display `?error` query param if present (from auth callback errors)
- No visual changes needed

**Sign Up (`/auth/sign-up`):**
- Read `?plan` query param, store in state
- After successful sign-up, store plan in `user_metadata` alongside the user's name
- Fix password requirements: match reset-password (8 chars, uppercase, number) for consistency
- Fix "resend" button: actually call `supabase.auth.resend()` instead of just resetting form state

**Forgot Password (`/auth/forgot-password`):** No changes needed.

**Reset Password (`/auth/reset-password`):** No changes needed.

**Auth Callback (`/auth/callback/route.ts`):**
- Correctly handle `next` param for try flow redirects
- Ensure the `next` param takes priority over the default `/dashboard` redirect

### 5.3 Navigation — Connecting Everything

**Landing page nav** (already built, minor additions):
- Add "Portfolio" link → `/cases`
- "How it works" → `#journey` (existing)
- "Pricing" → `/pricing`
- "Try a free case" → `/try`

**App nav** (new AppNavbar, post-login):
- "Home" → `/dashboard`
- "Library" → `/dashboard/library`
- "History" → `/dashboard/history`
- "Portfolio" → `/cases`
- User avatar dropdown: Settings, Sign Out

**Portfolio tool (`/cases`, `/cases/[id]`):**
- Keep existing functionality
- Update visual style to match warm brand (cream bg, amber accents)
- Import `AppNavbar` at the top of these pages for consistent navigation
- The portfolio tool is accessed via nav links, not hidden behind a separate UI

### 5.4 Dead Code Cleanup

Remove:
- `components/landing/HeroSection.tsx` (replaced by LandingHero)
- `components/landing/FeaturesSection.tsx` (replaced by ProductJourney)
- `components/landing/CTASection.tsx` (replaced by FinalCTA)
- `components/landing/Footer.tsx` (replaced by LandingFooter)
- `components/landing/HeroChatSimulation.tsx` (removed)
- `components/landing/FreeCasesSection.tsx` (removed)
- `components/landing/StationsCarousel.tsx` (removed)
- `components/landing/FeedbackAnalysisSection.tsx` (removed)
- `components/landing/InteractiveDemoSection.tsx` (removed)
- `components/landing/PortfolioToolSection.tsx` (removed)
- `components/landing/TestimonialsSection.tsx` (removed)
- `hooks/useElevenLabsSession.ts` (dead code, never imported)
- `hooks/useRealtimeSession.ts` (dead code if not imported)
- WebSocket-related types from `lib/clinical-master/types.ts`
- Commented-out code blocks in `lib/api.ts`
- `glass-card` dark mode CSS from `globals.css`
- Dashboard sidebar component: `components/dashboard/DashboardSidebar.tsx`
- Old dashboard components if fully replaced: `StatCard`, `StartNewCard`, `ResumeStationCard`, `PerformancePulse`, `BlueprintGrid`, `DomainCard`

---

## File Impact Summary

### New Files

| File | Purpose |
|------|---------|
| `components/ui/Container.tsx` | Shared product window container |
| `components/ui/PrimaryButton.tsx` | Amber gradient CTA button |
| `components/ui/SecondaryButton.tsx` | Outlined button |
| `components/ui/ScoreBadge.tsx` | Pass/borderline/fail score pill |
| `components/ui/DomainTag.tsx` | Domain label pill |
| `components/ui/TabNav.tsx` | Horizontal tab navigation |
| `components/ui/AppNavbar.tsx` | Authenticated app top navbar |
| `components/ui/FormInput.tsx` | Styled form input |
| `components/ui/PageHeader.tsx` | Page title + breadcrumb |
| `components/ui/ConfirmModal.tsx` | Styled confirmation dialog (replaces browser confirm()) |
| `app/api/clinical-master/create-session/route.ts` | Create session record before consultation |
| `app/api/try/create-session/route.ts` | Create guest session record before consultation |
| `lib/constants/domains.ts` | Shared domain icons, colors, mappings (deduplicated) |

### Modified Files

| File | Changes |
|------|---------|
| `app/globals.css` | Remove dark mode CSS, update variables |
| `tailwind.config.ts` | Add surface-raised, update tokens |
| `app/dashboard/layout.tsx` | Remove sidebar, add AppNavbar, cream bg |
| `app/dashboard/page.tsx` | Complete redesign — warm, focused, flowing |
| `app/dashboard/library/page.tsx` | Domain list instead of grid |
| `app/dashboard/library/[domainId]/page.tsx` | Station list, fix overflow, shared constants |
| `app/dashboard/history/page.tsx` | Clickable rows, correct total count |
| `app/dashboard/settings/page.tsx` | Warm styling, fix exam date sync |
| `app/clinical-master/page.tsx` | Convert to redirect |
| `app/clinical-master/station/[stationId]/page.tsx` | Full redesign — single column, warm, session creation |
| `app/clinical-master/session/[sessionId]/page.tsx` | Full redesign — voice-only, warm, no transcript |
| `app/clinical-master/feedback/[sessionId]/page.tsx` | Full redesign — warm, all-domain feedback |
| `app/try/layout.tsx` | Remove entirely (use root layout) |
| `app/try/page.tsx` | Warm redesign, fix sign-in link |
| `app/try/station/[stationId]/page.tsx` | Warm redesign, session creation |
| `app/try/session/[sessionId]/page.tsx` | Warm redesign, voice-only |
| `app/try/feedback/[sessionId]/page.tsx` | Warm redesign, real partial feedback preview |
| `app/pricing/page.tsx` | Warm redesign, fix CTA buttons, capture plan |
| `app/auth/sign-up/page.tsx` | Read plan param, fix password requirements, fix resend |
| `app/auth/sign-in/page.tsx` | Display error param |
| `app/auth/callback/route.ts` | Handle next param for try flow |
| `app/api/generate-feedback/route.ts` | Add auth check, fix domain data extraction |
| `app/api/livekit-token/route.ts` | Clean up shadowed variable |
| `components/clinical-master/ConsultationTimer.tsx` | Fix double-fire, remove pause, add warning colors |
| `components/clinical-master/Notepad.tsx` | Per-station localStorage key, use router.push |
| `hooks/useLiveKitSession.ts` | Fix audio cleanup, remove console.logs |
| `app/page.tsx` | Add "Portfolio" to landing nav links |
| `components/landing/LandingNavbar.tsx` | Add "Portfolio" link |

### Deleted Files

| File | Reason |
|------|--------|
| `components/landing/HeroSection.tsx` | Replaced by LandingHero |
| `components/landing/FeaturesSection.tsx` | Replaced by ProductJourney |
| `components/landing/CTASection.tsx` | Replaced by FinalCTA |
| `components/landing/Footer.tsx` | Replaced by LandingFooter |
| `components/landing/HeroChatSimulation.tsx` | Removed |
| `components/landing/FreeCasesSection.tsx` | Removed |
| `components/landing/StationsCarousel.tsx` | Removed |
| `components/landing/FeedbackAnalysisSection.tsx` | Removed |
| `components/landing/InteractiveDemoSection.tsx` | Removed |
| `components/landing/PortfolioToolSection.tsx` | Removed |
| `components/landing/TestimonialsSection.tsx` | Removed |
| `components/dashboard/DashboardSidebar.tsx` | Replaced by AppNavbar |
| `components/dashboard/StatCard.tsx` | Removed (no card grids) |
| `components/dashboard/StartNewCard.tsx` | Replaced by inline quick start |
| `components/dashboard/ResumeStationCard.tsx` | Replaced by inline resume section |
| `components/dashboard/PerformancePulse.tsx` | Replaced by inline domain bars |
| `components/dashboard/BlueprintGrid.tsx` | Removed (no card grids) |
| `components/dashboard/DomainCard.tsx` | Removed |
| `hooks/useElevenLabsSession.ts` | Dead code |
| `hooks/useRealtimeSession.ts` | Dead code (verify first) |

---

## Implementation Priority

The phases should be built in order because each builds on the previous:

1. **Phase 1** (Design System) — everything depends on this
2. **Phase 2** (Core Loop) — the most important user experience
3. **Phase 3** (Dashboard) — the home base
4. **Phase 4** (Try Flow) — the conversion funnel
5. **Phase 5** (Pricing + Auth + Navigation + Cleanup) — polish and connections

Within each phase, build bottom-up: shared components first, then pages that use them.

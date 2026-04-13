# Phases 3-5: Dashboard, Try Flow, Pricing/Auth/Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT CONTEXT:** This covers Phases 3, 4, and 5 of a 5-phase product overhaul. Read the full spec at `docs/superpowers/specs/2026-04-13-product-overhaul.md`. Phases 1 (design system) and 2 (core loop) must be completed first — this plan uses the `components/ui/` components and warm patterns established there.
>
> **Each task has full code.** The sub-agent should read the current file before modifying it, in case Phases 1-2 changed anything. Use the spec as the source of truth for design decisions.

**Goal:** Redesign the dashboard (kill sidebar, kill card grids), fix the try flow (session creation, visual alignment), update pricing/auth/navigation, and clean up dead code.

**Architecture:** Dashboard pages rewritten as warm flowing content using Phase 1 UI components. Try flow pages mirror the clinical-master pages but without auth. Pricing converted to warm. Dead code removed.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion, Supabase

---

## Phase 3: Dashboard

### Task 1: Rewrite Dashboard Home

**Files:**
- Rewrite: `CaseForgeFrontend/app/dashboard/page.tsx`

The dashboard home should be warm cream, focused on one action (start/resume a session), with recent sessions and domain progress below. No card grids. No StatCards. Read the current file first, then replace entirely.

- [ ] **Step 1: Read current dashboard page**

Read `app/dashboard/page.tsx` to understand current Supabase queries and data flow. The key queries are in `lib/supabase/queries/dashboard.ts`: `getUserStats`, `getPerformanceMetrics`, `getBlueprintDomains`, `getLastStation`, `updateLoginStreak`.

- [ ] **Step 2: Rewrite the dashboard page**

Replace the entire file. Key changes:
- Remove all StatCard, StartNewCard, ResumeStationCard, PerformancePulse, BlueprintGrid imports
- Use `Container`, `PrimaryButton`, `ScoreBadge`, `DomainTag` from `components/ui/`
- Warm cream background (inherited from layout)
- Framer Motion animations on all sections
- Welcome message with user's first name
- Quick start section: resumable session OR "Start a new session" button
- Recent 3 sessions as compact clickable rows (not cards)
- Domain progress as 3 inline bars with pass threshold

The page should keep the same Supabase queries from `lib/supabase/queries/dashboard.ts` — just change the rendering.

Wire the resume card: when a resumable session exists, the "Continue" button navigates to `/clinical-master/session/${sessionId}?stationId=${stationId}`.

Fix `timeRemaining`: display it as the station's consultation duration (this is what we have — actual remaining time would require tracking per-session state).

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/dashboard/page.tsx && git commit -m "feat: rewrite dashboard home — warm, focused, no card grids"
```

---

### Task 2: Rewrite Station Library

**Files:**
- Rewrite: `CaseForgeFrontend/app/dashboard/library/page.tsx`

- [ ] **Step 1: Read current library page**

Read `app/dashboard/library/page.tsx` and `lib/supabase/queries/station-library.ts` to understand the data.

- [ ] **Step 2: Rewrite as warm domain list**

Replace the entire file. Key changes:
- Import `PageHeader`, `Container`, `ScoreBadge` from `components/ui/`
- Import domain color helpers from `lib/constants/domains.ts`
- Domain list as vertical rows with thin borders (not card grid)
- Each row: domain name, station count, completed count, average score badge, clickable → `/dashboard/library/${domainId}`
- Hide domains with 0 stations
- Search input optional (add if time permits, skip if not)

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/dashboard/library/page.tsx && git commit -m "feat: rewrite station library — warm domain list"
```

---

### Task 3: Rewrite Domain Detail

**Files:**
- Rewrite: `CaseForgeFrontend/app/dashboard/library/[domainId]/page.tsx`

- [ ] **Step 1: Read current domain detail page**

Read the file. Note the inline StationCard component and duplicated domain constants.

- [ ] **Step 2: Rewrite as warm station list**

Replace the entire file. Key changes:
- Import shared constants from `lib/constants/domains.ts`
- Import `PageHeader`, `Container`, `PrimaryButton`, `ScoreBadge` from `components/ui/`
- Breadcrumb: "Library > {Domain Name}"
- Station list as clickable rows
- Each row: station title, patient name, difficulty indicator, score badge or "Not started"
- Click to expand: show attempt history
- "Start" / "Try Again" buttons link to `/clinical-master/station/${stationId}`
- "View Feedback" links to `/clinical-master/feedback/${sessionId}`
- Fix: remove `overflow-hidden` from main element

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/dashboard/library/\\[domainId\\]/page.tsx && git commit -m "feat: rewrite domain detail — warm station list with expandable attempts"
```

---

### Task 4: Rewrite Session History

**Files:**
- Rewrite: `CaseForgeFrontend/app/dashboard/history/page.tsx`

- [ ] **Step 1: Read current history page**

Read the file. Note the SessionHistoryCard import and pagination logic.

- [ ] **Step 2: Rewrite as warm session table**

Replace the entire file. Key changes:
- Import `PageHeader`, `ScoreBadge`, `DomainTag` from `components/ui/`
- Clickable rows (entire row is a `<Link>` to `/clinical-master/feedback/${sessionId}`)
- Each row: station title, domain tag, score badge, pass/refer label, relative date
- Staggered fade-in animation
- Fix: show actual total count (add a count query alongside the paginated query)
- "Load more" button with proper total

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/dashboard/history/page.tsx && git commit -m "feat: rewrite session history — warm clickable rows, correct total count"
```

---

### Task 5: Rewrite Settings

**Files:**
- Rewrite: `CaseForgeFrontend/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Read current settings page**

Read the file. Note the exam date sync bug (saves to user_metadata, dashboard reads from profiles).

- [ ] **Step 2: Rewrite as warm form**

Replace the entire file. Key changes:
- Import `Container`, `PrimaryButton`, `SecondaryButton`, `PageHeader` from `components/ui/`
- Warm cream background (inherited), Container for form sections
- Profile: amber gradient avatar, name input, email read-only
- Exam date: date picker, clear description
- Account: sign out button (red outline via SecondaryButton variant="danger")
- Bug fix: when saving, write exam_date to BOTH user_metadata AND profiles table:
  ```typescript
  await supabase.auth.updateUser({ data: { full_name: name, exam_date: examDate } });
  await supabase.from('profiles').upsert({ id: userId, exam_date: examDate }, { onConflict: 'id' });
  ```

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/dashboard/settings/page.tsx && git commit -m "feat: rewrite settings — warm design, fix exam date sync to profiles table"
```

---

## Phase 4: Try Flow

### Task 6: Remove Try Flow Custom Layout

**Files:**
- Modify: `CaseForgeFrontend/app/try/layout.tsx`

- [ ] **Step 1: Replace the dark custom layout with a minimal warm one**

The current layout imports Inter font, loads Material Symbols externally, uses dark bg. Replace with:

```tsx
import Link from 'next/link';

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface font-sans relative">
      {/* Exit button */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 px-3 py-1.5 rounded-lg text-[13px] text-muted hover:text-heading bg-white/60 backdrop-blur-xl border border-black/[0.06] transition-colors"
      >
        ← Exit
      </Link>
      {children}
    </div>
  );
}
```

This inherits Plus Jakarta Sans from the root layout and uses warm cream background.

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add app/try/layout.tsx && git commit -m "feat: replace dark try layout with warm minimal layout"
```

---

### Task 7: Rewrite Try Case Picker

**Files:**
- Rewrite: `CaseForgeFrontend/app/try/page.tsx`

- [ ] **Step 1: Read current try page**

Read the file. Note the API call to `/api/try/free-cases` and the misleading "Sign in" link.

- [ ] **Step 2: Rewrite as warm case list**

Replace the entire file. Key changes:
- Import `Container`, `PrimaryButton`, `DomainTag` from `components/ui/`
- Warm cream background
- Header: "Try a Free Case" + subtitle
- Each case as a Container with patient name, complaint preview, domain tag, duration, "Start →" button
- Fix: "Already have an account? Sign in" → href="/auth/sign-in" (was /auth/sign-up)

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/try/page.tsx && git commit -m "feat: rewrite try case picker — warm design, fix sign-in link"
```

---

### Task 8: Rewrite Try Station Brief

**Files:**
- Rewrite: `CaseForgeFrontend/app/try/station/[stationId]/page.tsx`

- [ ] **Step 1: Rewrite the try station brief**

This should mirror the Phase 2 clinical-master station page but:
- No auth required
- "Back" link goes to `/try`
- Session creation calls `/api/try/create-session`
- Navigates to `/try/session/${sessionId}?stationId=${stationId}`

Read the Phase 2 rewritten `app/clinical-master/station/[stationId]/page.tsx` and adapt it for the try flow. The main differences:
- Replace `/api/clinical-master/create-session` with `/api/try/create-session`
- Replace "Back to Library" with "← Back" linking to `/try`
- Fetch station from `/api/try/free-cases` then filter, or use `/api/try/station-detail`

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add app/try/station/\\[stationId\\]/page.tsx && git commit -m "feat: rewrite try station brief — warm design, session creation"
```

---

### Task 9: Rewrite Try Session

**Files:**
- Rewrite: `CaseForgeFrontend/app/try/session/[sessionId]/page.tsx`

- [ ] **Step 1: Rewrite the try session page**

Mirror the Phase 2 clinical-master session page but:
- Token endpoint: `/api/try/livekit-token`
- On end: navigates to `/try/feedback/${sessionId}`
- No user auth fetch (guest flow)
- No AppNavbar — just the "Exit" button from layout

Read the Phase 2 rewritten `app/clinical-master/session/[sessionId]/page.tsx` and adapt.

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add app/try/session/\\[sessionId\\]/page.tsx && git commit -m "feat: rewrite try session — warm voice-only UI for guests"
```

---

### Task 10: Rewrite Try Feedback Gate

**Files:**
- Rewrite: `CaseForgeFrontend/app/try/feedback/[sessionId]/page.tsx`

- [ ] **Step 1: Read current try feedback page**

Read the file. Note the auth gate pattern (blurred preview + sign up/in form).

- [ ] **Step 2: Rewrite as warm auth gate with partial feedback**

Replace the entire file. Key changes:
- Warm cream background
- Show real partial feedback: overall score ring gauge + pass/refer badge (call `/api/generate-feedback` to get actual data)
- Domain bars visible, but strengths/improvements hidden behind a soft gradient fade
- "Sign up to see your full feedback" message
- Auth form reusing `AuthCard` + `AuthInput` components (they already match warm brand)
- On successful auth: call `/api/try/claim-session`, redirect to `/clinical-master/feedback/${sessionId}`
- Fix email redirect: ensure `emailRedirectTo` uses the auth callback with `next` param

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/try/feedback/\\[sessionId\\]/page.tsx && git commit -m "feat: rewrite try feedback gate — warm design, real partial preview"
```

---

## Phase 5: Pricing, Auth, Navigation, Cleanup

### Task 11: Rewrite Pricing Page

**Files:**
- Rewrite: `CaseForgeFrontend/app/pricing/page.tsx`

- [ ] **Step 1: Read current pricing page**

Read the file. Note the stopPropagation bug on CTAs and dark mode styling.

- [ ] **Step 2: Rewrite as warm pricing page**

Replace the entire file. Key changes:
- Warm cream background
- Import `LandingNavbar` and `LandingFooter` from landing components
- Three pricing tiers as clean sections (not dark cards)
- Recommended plan highlighted with amber left border + "Most Popular" badge
- CTAs as `<Link href="/auth/sign-up?plan=X">` wrapping `<PrimaryButton>` — NO stopPropagation
- Feature comparison list (not a complex table)
- FAQ accordion if time permits
- "Browse Free Cases" → `/try`

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/pricing/page.tsx && git commit -m "feat: rewrite pricing — warm design, fix CTA buttons"
```

---

### Task 12: Fix Sign-Up to Capture Plan Param

**Files:**
- Modify: `CaseForgeFrontend/app/auth/sign-up/page.tsx`

- [ ] **Step 1: Read current sign-up page**

Read the file. Note it never reads `?plan` param.

- [ ] **Step 2: Add plan capture and password requirement fix**

Key changes:
- Read `searchParams.get('plan')` and store in state
- After successful sign-up, store plan in user_metadata: `signUp({ email, password, options: { data: { full_name: name, selected_plan: plan } } })`
- Fix password minimum to 8 characters (currently 6) to match reset-password requirements
- Fix "resend" button: call `supabase.auth.resend({ type: 'signup', email })` instead of just resetting form state

- [ ] **Step 3: Commit**

```bash
cd CaseForgeFrontend && git add app/auth/sign-up/page.tsx && git commit -m "fix: capture plan param on sign-up, fix password requirements, fix resend"
```

---

### Task 13: Fix Auth Callback for Try Flow

**Files:**
- Modify: `CaseForgeFrontend/app/auth/callback/route.ts`

- [ ] **Step 1: Read current callback route**

Read the file.

- [ ] **Step 2: Ensure next param is properly handled**

The callback should prioritize the `next` query parameter for redirects. Verify the current logic handles `/clinical-master/feedback/${sessionId}` as a valid `next` destination.

- [ ] **Step 3: Commit if changes needed**

```bash
cd CaseForgeFrontend && git add app/auth/callback/route.ts && git commit -m "fix: ensure auth callback handles try flow redirect"
```

---

### Task 14: Add Portfolio Link to Landing Nav

**Files:**
- Modify: `CaseForgeFrontend/components/landing/LandingNavbar.tsx`

- [ ] **Step 1: Add Portfolio link to desktop nav**

In the desktop nav links section, add a "Portfolio" link after "Pricing":

```tsx
<Link href="/cases" className="text-[13px] text-body hover:text-heading transition-colors duration-150">
  Portfolio
</Link>
```

Also add it to the mobile menu.

- [ ] **Step 2: Commit**

```bash
cd CaseForgeFrontend && git add components/landing/LandingNavbar.tsx && git commit -m "feat: add Portfolio link to landing page nav"
```

---

### Task 15: Dead Code Cleanup

**Files:**
- Delete old landing components
- Delete old dashboard components
- Delete dead hooks
- Clean up types

- [ ] **Step 1: Delete replaced landing components**

```bash
cd CaseForgeFrontend && git rm \
  components/landing/HeroSection.tsx \
  components/landing/FeaturesSection.tsx \
  components/landing/CTASection.tsx \
  components/landing/Footer.tsx \
  components/landing/HeroChatSimulation.tsx \
  components/landing/FreeCasesSection.tsx \
  components/landing/StationsCarousel.tsx \
  components/landing/FeedbackAnalysisSection.tsx \
  components/landing/InteractiveDemoSection.tsx \
  components/landing/PortfolioToolSection.tsx \
  components/landing/TestimonialsSection.tsx \
  2>/dev/null; echo "done"
```

Note: Some files may not exist or may have been renamed. Use `git rm --ignore-unmatch` or check existence first.

- [ ] **Step 2: Delete old dashboard components (only if fully replaced)**

After Phase 3 is done and dashboard no longer imports these:

```bash
cd CaseForgeFrontend && git rm --ignore-unmatch \
  components/dashboard/DashboardSidebar.tsx \
  components/dashboard/StatCard.tsx \
  components/dashboard/StartNewCard.tsx \
  components/dashboard/ResumeStationCard.tsx \
  components/dashboard/PerformancePulse.tsx \
  components/dashboard/BlueprintGrid.tsx \
  components/dashboard/DomainCard.tsx
```

- [ ] **Step 3: Delete dead hooks**

```bash
cd CaseForgeFrontend && git rm --ignore-unmatch \
  hooks/useElevenLabsSession.ts \
  hooks/useRealtimeSession.ts
```

- [ ] **Step 4: Clean up WebSocket types from clinical-master types**

Read `lib/clinical-master/types.ts` and remove the `WebSocketMessage` interface and `ConsultationPhase` type (both are vestigial from the pre-LiveKit era). Keep `Station`, `TranscriptItem`, `DomainScore`, `ConsultationFeedback`.

- [ ] **Step 5: Clean up lib/api.ts**

Remove all commented-out code blocks from `lib/api.ts`. Keep only the active API methods. Remove `console.log` statements.

- [ ] **Step 6: Verify build after cleanup**

```bash
cd CaseForgeFrontend && npx next build 2>&1 | tail -10
```

If any imports fail (deleted component still imported somewhere), fix the import.

- [ ] **Step 7: Commit all cleanup**

```bash
cd CaseForgeFrontend && git add -A && git commit -m "chore: remove dead code — old landing/dashboard components, dead hooks, vestigial types"
```

---

### Task 16: Final Build Verification

- [ ] **Step 1: Full build**

```bash
cd CaseForgeFrontend && npx next build 2>&1 | tail -10
```

- [ ] **Step 2: Lint**

```bash
cd CaseForgeFrontend && npm run lint 2>&1 | tail -10
```

- [ ] **Step 3: Commit any final fixes**

```bash
cd CaseForgeFrontend && git add -A && git commit -m "fix: final build and lint fixes for product overhaul"
```

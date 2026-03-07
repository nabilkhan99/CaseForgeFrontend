# Fourteen Fisherman — Nabil's Action Items from Mar 4 Meeting

> [!IMPORTANT]
> Extracted from the full meeting transcript + cross-referenced with the actual codebase. Items marked 🔴 are **explicitly stated** in the meeting. Items marked 🟡 are **implied/inferred** from the discussion.

---

## 1. Landing Page Overhaul

### 1.1 🔴 Change the Hero Header & Subheading
**Current state:** `"Master the Simulated Consultation Assessment"` in [HeroSection.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/HeroSection.tsx#L16-L21)

**Change to:**
- **Header:** `"Are You Ready to Pass the SCA?"`
- **Subheading:** `"Test yourself in a realistic 12-minute mock station to see if you would pass"`

### 1.2 🔴 Reword the "Begin Your SCA Practice" CTA
**Current state:** [HeroSection.tsx L29](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/HeroSection.tsx#L29) says `"Begin Your SCA Practice"`

**Action:** Use AI to suggest better wording. This CTA now points to the **new pricing page** (not `/auth/sign-up`).

### 1.3 🔴 Update the "Try a Case Free" CTA
**Current state:** [HeroSection.tsx L37](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/HeroSection.tsx#L37) says `"Try a Case Free"` → links to `/try`

**Change to:** `"Free Mock"` — keep linking to `/try` (low-friction entry, no sign-up required before the station).

### 1.4 🔴 Remove the "Talk Naturally, They Respond Clinically" Section
**Current state:** [InteractiveDemoSection.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/InteractiveDemoSection.tsx) — the entire section with the "Talk naturally. They respond clinically." heading.

**Action:** Remove or completely rework this section. The "transcript analysis" bullet point must also be removed.

### 1.5 🔴 Remove "Transcript Analysis" from Feature Points
**Current state:** [FeedbackAnalysisSection.tsx L125-L132](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/FeedbackAnalysisSection.tsx#L125-L132) — "Transcript Analysis" listed as a feature.

**Action:** Remove this feature entirely.

### 1.6 🔴 Replace "Everything You Need to Pass" Section with Free Cases Section
**Current state:** [FeaturesSection.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/FeaturesSection.tsx) — `"Everything you need to pass."` header.

**Action:** Replace with a new section highlighting the **78 free practiceable cases** derived from RCGP curriculum. Messaging:
- RCGP provides case titles across 26 topics (3 per topic)
- We've fleshed them out into full cases with marking schemes
- Completely free to practice with a friend
- Button/CTA linking to the `/cases` page

> [!TIP]
> Wait for Ishaq to send his Reddit post prompt/content — use that context to brand this section correctly.

### 1.7 🔴 Fix the Stations Carousel Animation
**Current state:** [StationsCarousel.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/StationsCarousel.tsx) — conveyor belt is static/broken.

**Action:** Make it rotate/animate continuously (was working at one point, currently not).

### 1.8 🔴 Update the Bottom CTA Section
**Current state:** [CTASection.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/CTASection.tsx) — says `"No credit card required for trial cases."`

**Action:**
- Remove `"No credit card required for trial cases"` text
- Change button to `"Practice Free Now"` or `"Get Started for Free"`
- Make this a proper CTA (not just linking to sign-up)

### 1.9 🔴 Add Portfolio Tool Section at Bottom
**Action:** Add a section near the bottom of the landing page referencing the **original Fourteen Fisherman portfolio tool** with messaging like "tried and tested" / "viral portfolio tool".

### 1.10 🔴 Make the Interactive Demo Section More Dynamic
**Action:** Add jumpy animation or rotation to the features/interactive elements. Consider the accordion/dropdown style with dynamic visuals alongside text (like the example discussed).

---

## 2. Navigation Header Restructure

### 2.1 🔴 Change Navbar Links
**Current state:** [Navbar.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/landing/Navbar.tsx#L52-L76) — `Features | Pricing | Stations | Cases`

**Change to:** `Pricing | Cases | Portfolio Tool | Sign In`

| Link | Target |
|---|---|
| Pricing | New `/pricing` page |
| Cases | `/cases` (free 78 cases) |
| Portfolio Tool | Original 14 fisherman tool (external or section) |
| Sign In | `/auth/sign-in` |

---

## 3. New Pricing Page

### 3.1 🔴 Create `/pricing` Page
**Current state:** No pricing page exists (confirmed — search returned 0 results).

**Action:** Create a dedicated pricing page with **3 tiers** based on the Stitch designs from project `17968406891632705458` ("Medical Exam Simulator - Reading Time").

### 3.2 🔴 Pricing Structure (Final Agreed)

| Tier | Name | Price | Duration | Features |
|---|---|---|---|---|
| Left | Sprint (or similar) | **£69/month** | Month-to-month, cancel anytime | AI practice, 78 free cases |
| Middle ⭐ | (Most attractive) | **~£149** | 3-month fixed term | AI practice, 78 free cases + **full 250 case catalog** for practice with friends |
| Right | (Positioning only) | Higher price | 12 months | Same as middle, positioned to make middle look attractive |

**Key decisions:**
- ❌ No free trial tier
- ❌ No "exam pass guarantee" (removed — unnecessary hassle)
- ✅ Everyone gets 78 free cases regardless (via landing page)
- ✅ 3-month subscribers get full 250 case catalog exposed
- ✅ Left tier is recurring monthly; middle is one-time for 3 months

### 3.3 🔴 Connect Stripe for Payments
**Action:** Integrate Stripe for paid subscription handling on the pricing page CTAs.

---

## 4. Dashboard Updates

### 4.1 🔴 Change from 12 Domains to 26 Categories
**Current state:** [BlueprintGrid.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/dashboard/BlueprintGrid.tsx) — shows `"12 Domains"` badge, uses 12 domains.
Dashboard page [references 12 RCGP curriculum domains](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/app/dashboard/page.tsx#L189).

**Action:** Change to **26 RCGP categories** (subject areas like Cardiology, Respiratory, Neurology etc.) for consistency with the RCGP question bank that users are familiar with.

### 4.2 🔴 Fix Blueprint Grid Scrolling
**Current state:** Blueprint grid uses internal scroll (`overflow-y-auto`) with `overflow-hidden` on parent — causes a small scrollable box within the page.

**Action:** Remove the internal scroll container. Make the whole page scrollable instead, showing all 26 categories inline. Keep the bottom card slightly cut off so users know to scroll down.

### 4.3 🔴 Make Domain Cards Clickable
**Action:** Clicking any of the 26 category cards (e.g. Dermatology) should navigate the user directly into that category's station library section.

### 4.4 🟡 Fix Performance Pulse Data Display
**Current state:** [PerformancePulse.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/dashboard/PerformancePulse.tsx) shows 3 criteria scores.

**Confirmed behavior:** These are cumulative averages across all completed stations. The percentage and numbers need clarification — ensure they show stations completed count and average scores correctly.

---

## 5. Sign-In UI Redesign

### 5.1 🔴 Redesign Sign-In Page
**Current state:** [AuthLayout.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/components/auth/AuthLayout.tsx) + [sign-in/page.tsx](file:///Users/nabilkhan/Desktop/fourteenfisherman/CaseForgeFrontend/app/auth/sign-in/page.tsx) — described as "horrendous" and "1920s".

**Action:** Modernize with glowy effects, better styling, premium feel. Use AI to improve.

---

## 6. Station/Case UI Updates

### 6.1 🔴 Apply Stitch UI to Timer/Case Pages
**Reference:** Stitch project `17968406891632705458` — Ishaq sent a preferred UI screenshot.

**Action:**
- Center-align the case content in a contained box (not left-aligned)
- Toggles/tabs in the middle
- Timer should stretch as one long element down the full page height
- Replace left sidebar with the timer

### 6.2 🔴 Fix Positive/Negative Feedback UI
**Current state:** The positive/negative feedback display in the case flow looks rough.

**Action:** Refine based on Stitch design reference.

### 6.3 🟡 Improve Timer Continuity
**Action:** When the timer transitions between phases, it should be continuous rather than jarring/jumping.

---

## 7. Data Pipeline — Notion Parser

### 7.1 🔴 Build/Find Notion Parser for Case Data
**Action:** Find a way to parse Ishaq's Notion accordions/toggles and import the 78 case entries into the Supabase database programmatically (instead of manual copy-paste which risks AI data fabrication).

---

## 8. Station Library Updates

### 8.1 🔴 Use 26 Categories in Station Library
**Action:** Consistent with dashboard — use 26 RCGP subject areas (not 12 domains) in the station library page.

### 8.2 🔴 Expand Free Case Catalog to 250+
For paid subscribers (3-month tier), expose the full 250+ case catalog for practice with friends (non-AI, content-only).

---

## 9. Content/Copy Tasks

### 9.1 🔴 Test the Main Conversation Flow
**Ishaq's action but needs Nabil's review:** Go through the actual content of the dashboard and the main AI conversation flow. Send feedback.

### 9.2 🟡 Reddit Post Landing Page Alignment
**Waiting on:** Ishaq's Reddit post content/prompt. Use that to brand the free cases section on the landing page.

---

## Priority Order (Suggested)

| Priority | Task | Complexity |
|---|---|---|
| **P0** | Landing page hero/CTA changes (1.1–1.3) | Low |
| **P0** | Remove sections (1.4, 1.5) | Low |
| **P0** | Navbar restructure (2.1) | Low |
| **P1** | New pricing page (3.1–3.2) | Medium |
| **P1** | Free cases section on landing page (1.6) | Medium |
| **P1** | Dashboard 26 categories + scroll fix (4.1–4.3) | Medium |
| **P1** | Sign-in UI redesign (5.1) | Medium |
| **P2** | Stripe integration (3.3) | High |
| **P2** | Station UI from Stitch (6.1–6.3) | Medium |
| **P2** | Stations carousel animation (1.7) | Low |
| **P2** | Portfolio tool section (1.9) | Low |
| **P3** | Notion parser for case data (7.1) | Medium |
| **P3** | Station library 26 categories (8.1) | Low |
| **P3** | Bottom CTA update (1.8) | Low |

---

## Blockers & Dependencies

| Item | Blocked By |
|---|---|
| Free cases landing page section (1.6) | Ishaq's Reddit post content |
| Case data import (7.1) | Ishaq completing the 78 cases in Notion |
| Pricing page design (3.1) | Stitch designs already available in shared project |
| Station UI (6.1) | Stitch screenshot from Ishaq (already sent) |

---

## 🔴 Meeting Decisions to Remember

1. **26 categories** everywhere (dashboard + station library) — consistent with RCGP
2. **No free trial** — the free route is the 78 cases + try a mock CTA
3. **No exam pass guarantee** — removed
4. **No transcript analysis** feature on landing page
5. **78 free cases for everyone**, 250 case catalog for 3-month subscribers
6. **Month-on-month left tier at £69**, 3-month fixed middle tier at ~£149
7. **Color theme is fine** — keep as is, just rejig actual content
8. Keep the **dark/light toggle** concept for user preference

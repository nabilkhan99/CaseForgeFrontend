# Design System: Fourteen Fisherman

## 1. Visual Theme and Atmosphere

Fourteen Fisherman is a premium modern SaaS product for GP trainees preparing for the SCA. It should feel like a calm, high-trust practice workspace, not a hospital system and not a generic education template.

The atmosphere is warm, precise, and quietly editorial. Think Linear or Arc with more human warmth: restrained amber accents, stone surfaces, strong typography, thin rules, and spacious report layouts. The interface should make high-stakes clinical feedback feel readable and actionable without feeling harsh, cluttered, or over-medicalised.

Density target: 6 out of 10 for product screens. Feedback pages may reach 7 out of 10 because users need to inspect a lot of assessment detail, but the first viewport must stay simple.

Variance target: 4 out of 10. Use asymmetric emphasis inside panels, but keep report pages predictable and easy to scan.

Motion target: 4 out of 10. Motion should be crisp, low amplitude, and functional. Use subtle reveal, hover, and active-state transitions only.

## 2. Color Palette and Roles

- **Warm Canvas** (#FAFAF7) - Primary app background.
- **Raised Parchment** (#FFFCF8) - Main report panels and high-importance surfaces.
- **Soft Stone** (#F5F0EB) - Secondary bands, inactive tabs, and muted fills.
- **Card Cream** (#FBF7F1) - Warm card fill for grouped assessment modules.
- **Charcoal Heading** (#1C1917) - Primary headings and key report numbers.
- **Body Stone** (#44403C) - Main body text.
- **Muted Taupe** (#8A7E72) - Metadata, timestamps, helper copy, low-emphasis labels.
- **Faint Border** (rgba(31, 26, 20, 0.08)) - Default 1px structural border.
- **Hover Border** (rgba(31, 26, 20, 0.14)) - Hover and active structural border.
- **Primary Amber** (#B45309) - Primary brand accent, active states, focused score markers.
- **Deep Amber** (#C2410C) - Stronger emphasis for weighted warnings and key CTAs.
- **Soft Amber** (#F4A98A) - Low-emphasis amber fills and highlights.
- **Success Green** (#16A34A) - Pass states and positive assessment markers.
- **Danger Red** (#DC2626) - Fail states and critical assessment markers.
- **Legacy Medical Blue** (#0EA5E9) - Portfolio tool compatibility only. Do not use this in Clinical Master unless the existing portfolio UI requires it.

Use a mostly warm neutral page with amber as the only brand accent. Avoid purple, neon blue, dark clinical navy, generic medical gradients, and saturated rainbow status systems.

## 3. Typography Rules

- **Primary Sans:** Plus Jakarta Sans for body, navigation, controls, report text, and dense product UI.
- **Display Sans:** Geist may be used for sharper display headings where already configured.
- **Mono:** JetBrains Mono for timestamps, score denominators, transcript timecodes, and dense metadata.
- **Editorial Serif:** DM Serif Display may be used sparingly for large verdict words, pull quotes, or report titles. Do not use serif for dense controls or domain analysis body copy.

Hierarchy comes from weight, spacing, and color. Do not rely on oversized type inside dense panels.

Recommended scale:

- Page title: 40-56px desktop, 32-40px mobile.
- Section heading: 20-24px.
- Domain card title: 18-22px.
- Body: 15-16px, line-height 1.65.
- Metadata: 12-13px, uppercase only for tiny labels.
- Score numbers: use tabular numerals where possible.

Avoid negative letter spacing except for large display titles. Do not compress dense feedback text.

## 4. Layout Principles

- Use a max-width report canvas between 1120px and 1240px.
- Prefer full-width report sections with constrained inner content over floating marketing-style cards.
- Do not nest cards inside cards. If a panel needs internal separation, use dividers, tinted compartments, or columns.
- Keep cards at 12px to 16px radius, matching the existing app. Avoid pillowy oversized cards.
- Use CSS grid for report structure. Multi-column layouts collapse to one column below 768px.
- No horizontal overflow on mobile.
- Keep touch targets at least 44px.
- Every page should have one clear primary object. On the feedback page, the primary object is the user's scored consultation result.

## 5. Core Components

### Navigation

The app navigation should be quiet and compact: brand mark on the left, key product links in the center or right, and one restrained action button. Navigation should never compete with the report content.

### Buttons

Buttons are tactile and plain. Primary buttons use Primary Amber with white text. Secondary buttons use transparent or Raised Parchment fills with Faint Border. Active state translates down by 1px or scales to 0.98. No neon glow, no bouncing, no custom cursor.

### Tabs

Tabs should be text-first with a thin active underline or a subtle warm fill. Use tabs for switching between Overview, Data Gathering, Clinical Management, and Relating to Others. Tabs must remain sticky or easy to reach on long feedback reports.

### Cards and Panels

Use elevation only when it clarifies hierarchy. Report panels should use Raised Parchment or white with a faint border and `card-chrome` style shadow. Heavy feedback content should rely more on structure than shadow.

### Status Pills

Status pills are small, readable, and semantically colored:

- Pass: green text on pale green fill.
- Fail: red text on pale red fill.
- Borderline or mixed: amber text on pale amber fill.
- Weighted: neutral taupe text on Soft Stone fill.

### Quote Blocks

Quote blocks should be visually contained and scarce. Use them to prove a meaningful moment, not as repeated decoration. A quote block should include a timestamp only when available and should never appear under every missed item by default.

## 6. Feedback Page Redesign

The feedback page is an assessment report, not a certificate and not a chat transcript. It should answer four questions quickly:

1. What did I score?
2. Why did I get that score?
3. Which domain cost me most?
4. What should I practise next?

### Page Structure

1. **Report Header**
   - Breadcrumbs: Cases / specialty / Feedback.
   - Case title, for example "Woman discovering a breast lump on self-examination".
   - Session metadata: audio consultation, total duration, consultation date if available.

2. **Verdict and Score**
   - Left: large verdict, total score, and score bar.
   - Right: short examiner-style narrative explaining the outcome.
   - Always show the total denominator: `x.x / 10.5`.
   - Include a compact score key: Data Gathering `3`, Clinical Management `4.5 weighted`, Relating to Others `3`.

3. **Domain Score Strip**
   - Three domain rows or cards, not a decorative chart.
   - Each domain shows points awarded, max points, grade, and contribution to the final mark.
   - Clinical Management must show a `Weighted` badge.
   - Suggested denominators:
     - Data Gathering: out of 3.
     - Clinical Management: out of 4.5.
     - Relating to Others: out of 3.

4. **Tabbed Report Detail**
   - The default selected tab is `Overview`.
   - The other tabs are Data Gathering, Clinical Management, and Relating to Others.
   - Only one tab panel is visible at a time. Do not render all domains as one long continuous scroll.

5. **Overview Tab**
   - Contains a generic consultation overview, the final verdict summary, the highest-impact misses, and the `Focus Next` content.
   - `Focus Next` should not sit in the top header beside the verdict. It belongs in the overview tab so the header stays compact.
   - Focus Next has three action cards only.
   - Each card should be one practice target with a short reason.
   - The targets should be generated from the highest-impact missed criteria, not generic study advice.

6. **Domain Tabs**
   - Each domain lives in its own separate box.
   - Domain boxes are displayed under their own tab button, not stacked vertically by default.
   - Each domain box has a colored header, point score, status pill, and optional weighted badge.
   - Inside each domain, use three compartments:
     - What you did well.
     - What you missed.
     - How to improve.

7. **Evidence Drawer**
   - Evidence is collapsed by default when there is a lot of feedback.
   - Show at most one strongest quote per compartment in the default view.
   - Use "Not asked" or "No direct transcript quote" labels for omissions.
   - Never repeat the same patient quote under unrelated missed items.

### Heavy Feedback Rules

The real feedback payload may be much longer than a Stitch mockup. Design for volume from the start:

- Default to the top 3 items per domain section.
- Add `Show all` controls per domain, not one giant page-level expansion.
- Group missed items by severity: Critical, Significant, Minor.
- Keep improvement advice next to the missed item it addresses, but allow expanded detail below.
- Use dividers inside domain boxes instead of nested cards.
- Add a sticky domain jump nav on desktop once the user scrolls past the verdict.
- On mobile, use a compact segmented control for domains and collapse evidence below each item.

### Evidence Quality Rules

The UI must distinguish different evidence types:

- **Supporting quote** - the user or patient said this exact thing.
- **Patient cue** - the patient gave an opening or cue that should have been explored.
- **Not asked** - the clinician did not ask about this area, so there is no relevant quote.
- **No direct quote** - the marker inferred the issue from absence or from the consultation flow.

Do not display a transcript quote for an omission unless it is genuinely the cue that was missed. For example, do not attach "Tell me what's wrong with you then" to multiple unrelated missed breast-lump red flags.

## 7. Feedback Data Contract for UI

Stitch designs and frontend implementation should assume this shape even if the backend still needs to catch up:

- `overall_score`: number.
- `overall_max_score`: 10.5.
- `verdict_label`: clear pass, pass, borderline, fail, or clear fail.
- `verdict_summary`: 1-3 sentence human-readable explanation.
- `domains[]`:
  - `key`: data_gathering, clinical_management, relating_to_others.
  - `label`: display name.
  - `points_awarded`: number.
  - `max_points`: 3, 4.5, or 3.
  - `is_weighted`: boolean.
  - `status`: pass, borderline, fail, clear fail.
  - `did_well[]`: concise items with optional evidence.
  - `missed[]`: items with severity, rationale, and optional evidence.
  - `how_to_improve[]`: practice actions or model phrases.
  - `evidence[]`: transcript references, deduplicated by turn id or exact quote.

## 8. Motion and Interaction

- Use Framer Motion for mount, hover, and expansion transitions.
- Use spring-like easing and short durations.
- Animate opacity and transform only.
- Domain boxes reveal in a staggered sequence.
- Expanding evidence should feel like opening a report section, not like a chat animation.
- Respect reduced motion preferences.

## 9. Anti-Patterns

- No generic medical-blue clinical dashboard look for Clinical Master.
- No purple AI gradients or neon glows.
- No oversized hero treatment on the feedback page.
- No nested cards inside cards.
- No repeated quote blocks for missing history questions.
- No raw prompt wording such as "Anchored to:" in the UI.
- No vague section labels like "Feedback item 1".
- No score without denominator.
- No domain feedback without domain max points.
- No long walls of undifferentiated prose.
- No fake precision beyond one decimal place.
- No emojis.

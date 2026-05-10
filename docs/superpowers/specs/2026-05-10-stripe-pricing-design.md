# Stripe Pricing & Payments — Design Spec

## Overview

End-to-end payment implementation for Fourteen Fisherman. Three one-time plans with time-based access, Stripe Checkout for payment, Supabase for subscription state, and access gating throughout the app.

---

## Pricing Model

| Plan | Price | Duration | Access |
|------|-------|----------|--------|
| **The Sprint** | £79 one-off | 30 days | Unlimited AI consultations, full 250+ case catalog |
| **The Standard** | £149 one-off | 90 days | Unlimited AI consultations, full 250+ case catalog, priority feedback |
| **The Mastery** | £299 one-off | 180 days | Unlimited AI consultations, full 250+ case catalog, priority feedback, detailed analytics |

- All payments are one-time (not subscriptions)
- "Most Popular" badge on The Standard
- When time expires, user must purchase a new plan
- No credit system — unlimited consultations within the time window

## User States

| State | Can do | Gated from |
|-------|--------|------------|
| **Anonymous** | Browse site, 1 free consultation via `/try/` | Dashboard, starting consultations |
| **Signed up, no plan** | Dashboard, browse history/library/settings | Starting AI consultations |
| **Active plan** | Everything — unlimited consultations until `expires_at` | — |
| **Expired plan** | Same as "no plan" — dashboard access, paywall on consultations | Starting AI consultations |

---

## 1. Supabase Schema

### New table: `subscriptions`

```sql
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  plan text not null check (plan in ('sprint', 'standard', 'mastery')),
  amount_paid integer not null,
  currency text not null default 'gbp',
  status text not null default 'active' check (status in ('active', 'expired')),
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Index for fast lookups
create index idx_subscriptions_user_status on subscriptions(user_id, status);
create index idx_subscriptions_expires_at on subscriptions(expires_at);
```

### Alter `profiles` table

```sql
alter table public.profiles
  add column stripe_customer_id text;
```

### RLS Policies

```sql
-- Users can read their own subscriptions
create policy "Users can read own subscriptions"
  on subscriptions for select
  using (auth.uid() = user_id);

-- Only service role can insert/update (webhook handler)
-- No insert/update/delete policies for authenticated users
```

### Expiry handling

A Supabase cron job (pg_cron) runs daily to mark expired subscriptions:

```sql
update subscriptions
set status = 'expired'
where status = 'active' and expires_at < now();
```

Middleware also checks `expires_at` at request time, so cron is just for data consistency.

---

## 2. Stripe Setup

### Products & Prices

Create via Stripe MCP:
- **Product: "The Sprint"** — Price: £79.00 GBP, one-time
- **Product: "The Standard"** — Price: £149.00 GBP, one-time
- **Product: "The Mastery"** — Price: £299.00 GBP, one-time

### Environment Variables

```
STRIPE_SECRET_KEY              # sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET          # whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  # pk_live_... or pk_test_...
STRIPE_PRICE_SPRINT            # price_...
STRIPE_PRICE_STANDARD          # price_...
STRIPE_PRICE_MASTERY           # price_...
```

---

## 3. API Routes

### `POST /api/checkout`

Creates a Stripe Checkout Session.

**Request:**
```json
{ "plan": "sprint" | "standard" | "mastery" }
```

**Logic:**
1. Verify user is authenticated (Supabase JWT from cookies)
2. If not authenticated, return 401 with redirect to `/auth/sign-up?redirect=/pricing`
3. Map `plan` to Stripe Price ID from env vars
4. Look up or create Stripe Customer (using `stripe_customer_id` from `profiles`, or create from user email)
5. Create Checkout Session:
   - `mode: 'payment'`
   - `customer`: Stripe Customer ID
   - `line_items`: the selected price, qty 1
   - `metadata`: `{ plan, user_id, supabase_user_id }`
   - `success_url`: `/checkout/success?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url`: `/pricing`
6. Return `{ url: session.url }` — frontend redirects to Stripe

### `POST /api/webhooks/stripe`

Handles Stripe webhook events. No auth — verified by webhook signature.

**Events handled:**

`checkout.session.completed`:
1. Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
2. Extract `metadata.plan`, `metadata.supabase_user_id`, payment details
3. Calculate `expires_at` based on plan:
   - `sprint` → 30 days from now
   - `standard` → 90 days from now
   - `mastery` → 180 days from now
4. Upsert `stripe_customer_id` on `profiles` table
5. Insert row into `subscriptions` table
6. Return 200

**Idempotency:** Use `stripe_checkout_session_id` unique constraint — if webhook fires twice, second insert fails gracefully.

### `GET /api/subscription`

Returns current user's active subscription (if any). Used by frontend to display plan status.

**Response:**
```json
{
  "subscription": {
    "plan": "standard",
    "status": "active",
    "expires_at": "2026-08-10T00:00:00Z",
    "days_remaining": 87
  } | null
}
```

---

## 4. Free Trial Gating

### Stations
- Only 3 specific stations available at `/try/` (marked with `is_free_trial = true` in `stations` table)
- Reduce from current 78 to 3

### One free consultation limit
- After first `/try/` consultation completes, set cookie: `ff_free_trial_used=true`
  - `HttpOnly: false` (client needs to read it)
  - `SameSite: Lax`
  - `Max-Age: 31536000` (1 year)
- Set via the `/api/try/create-session` or feedback route after session completes
- `/try/` page checks this cookie — if set, show message: "You've used your free trial" with CTA to sign up
- Not bulletproof (cookies can be cleared) — acceptable trade-off

---

## 5. Middleware & Access Gating

### Route protection (`lib/supabase/middleware.ts`)

Extend existing middleware:

| Route | Auth required | Subscription required |
|-------|--------------|----------------------|
| `/` | No | No |
| `/try/*` | No | No (cookie-gated) |
| `/pricing` | No | No |
| `/auth/*` | No (redirect if logged in) | No |
| `/dashboard/*` | Yes | No |
| `/clinical-master/*` | Yes | **Yes** |
| `/admin/*` | Yes | No |

**Subscription check in middleware:**
1. If route requires subscription, query `subscriptions` where `user_id = auth.uid()` and `status = 'active'` and `expires_at > now()`
2. If no active subscription → redirect to `/pricing?upgrade=true`
3. Query is lightweight (indexed) and runs server-side

### Paywall component

Reusable `<Paywall />` component for client-side gating:
- Shown in dashboard library when user clicks "Start consultation" without active plan
- Card with message + CTA to `/pricing`
- Styled in the existing design system (amber, warm, Container component)

---

## 6. Pricing Page Redesign

Replace current `/app/pricing/page.tsx` with new design.

### Layout (in existing design system — warm amber/stone, typography-driven)

1. **Header section**
   - Eyebrow: small caps label
   - Headline: large bold text
   - Subtitle: muted description

2. **Three plan columns** — styled as subtle cards (not heavy boxes), Standard elevated/highlighted
   - Plan name + short tagline
   - Price in large display type + "/ one-off"
   - Duration: "30 days access" etc.
   - Feature list with check marks
   - CTA button — PrimaryButton for Standard, SecondaryButton for others

3. **Tier differentiators:**
   - Sprint: 30 days, unlimited consultations, full case catalog
   - Standard: 90 days, unlimited consultations, full case catalog, priority feedback
   - Mastery: 180 days, unlimited consultations, full case catalog, priority feedback, detailed analytics

4. **Free trial banner** — "Try 1 case free, no signup required" → `/try/`

5. **FAQ section** — updated questions for one-off payment model

### CTA behaviour
- Not logged in → redirect to `/auth/sign-up?redirect=/pricing`
- Logged in, no plan → `POST /api/checkout` → redirect to Stripe
- Logged in, active plan → "Current Plan" (disabled) or link to buy next tier

### Animations
- Framer Motion staggered entrance (existing pattern from current pricing page)
- Spring transitions on cards

---

## 7. Checkout Success Page

New route: `/app/checkout/success/page.tsx`

**Flow:**
1. Receives `?session_id=X` from Stripe redirect
2. Calls Stripe API to verify session is paid
3. Shows confirmation: plan name, duration, expiry date
4. CTA: "Go to Dashboard" → `/dashboard`

**Design:** Minimal success state — checkmark icon, plan details, warm styling consistent with auth pages (use AuthLayout/AuthCard pattern).

---

## 8. Dashboard Subscription UI

### Settings page (`/app/dashboard/settings/page.tsx`)

Add "Plan" section above existing Profile section:

**Active plan:**
- Plan name with badge
- "Expires in X days" with date
- Visual progress bar (time elapsed / total duration)
- "Extend or upgrade" link to `/pricing`

**No plan / expired:**
- "No active plan"
- "Purchase a plan to start AI consultations"
- PrimaryButton CTA to `/pricing`

### Dashboard home

- **No plan banner:** Subtle top banner — "You're on the free tier — upgrade to start practicing"
- **Expiring soon warning:** If plan expires within 7 days, amber banner — "Your plan expires in X days — renew to keep access"

---

## 9. Edge Cases

| Scenario | Handling |
|----------|----------|
| User buys a plan while existing plan is still active | New subscription created independently — `expires_at` calculated from purchase date, not from existing plan's expiry. Both rows exist; middleware uses the one with latest `expires_at`. |
| Webhook fires before user returns to success page | No problem — subscription is already active when they land on success page. |
| Webhook fails / delayed | Success page shows "Payment received — activating your plan..." and polls `/api/subscription` until it appears. Stripe retries webhooks automatically. |
| User disputes payment / refund | Handle manually via Stripe dashboard. Optionally add `charge.refunded` webhook handler later to auto-expire the subscription. |
| Cookie cleared, user tries another free trial | Acceptable — they get another free consultation. Not a revenue problem. |

---

## 10. Files to Create / Modify

### New files:
- `app/api/checkout/route.ts` — Checkout session creation
- `app/api/webhooks/stripe/route.ts` — Stripe webhook handler
- `app/api/subscription/route.ts` — Get current subscription
- `app/checkout/success/page.tsx` — Post-payment success page
- `components/ui/Paywall.tsx` — Reusable paywall component
- `lib/stripe.ts` — Stripe client initialisation + plan config

### Modified files:
- `app/pricing/page.tsx` — Full rewrite with new plans + checkout integration
- `app/dashboard/settings/page.tsx` — Add plan status section
- `app/dashboard/page.tsx` — Add plan banners
- `lib/supabase/middleware.ts` — Add subscription gating on `/clinical-master/*`
- `app/try/page.tsx` — Limit to 3 stations, check free trial cookie
- `app/try/feedback/[sessionId]/page.tsx` — Set free trial cookie, add signup CTA
- `package.json` — Add `stripe` dependency

### Supabase migrations:
- Create `subscriptions` table
- Alter `profiles` table (add `stripe_customer_id`, `free_trial_used`)
- RLS policies
- Cron job for expiry

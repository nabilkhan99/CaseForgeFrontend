# Referral Pathway — Implementation Plan (v2, post-review)

Branch: `feature/referral-pathway` (off `feature/preorder-launch`). Goal: complete refer-a-friend loop — link generation → attribution → purchase acknowledgement → reward lifecycle tracking → admin payout view.

## Product rules

- Every paid preorder buyer automatically becomes an advocate: a referral code is minted for them in the Stripe webhook (the **only** writer) and surfaced on `/thanks` (read-only) + by Brevo email.
- Reward tiered by the *referred* purchase: `complete` → £100 (10000p), `self_study` → £25 (2500p). Constants in one place.
- Referral qualifies 14 days after purchase (UK distance-selling window) if the preorder is still `paid`. Payout manual — admin marks `paid`.
- Guards: self-referral recorded as `void`; one non-void referral per referee email; one referral per preorder; full refund voids the referral.
- Attribution is **cookie-only** (v1). No Stripe custom-field fallback — cut in review as duplicate surface.

## Data model (SQL in `supabase/migrations/`, applied via Supabase MCP)

```sql
create table public.referral_codes (
  code text primary key,
  owner_email text not null unique,        -- lowercased; immutable snapshot by design
  owner_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null references public.referral_codes(code),
  referrer_email text not null,            -- immutable snapshot by design
  referee_email text not null,
  preorder_id uuid unique references public.preorders(id),  -- idempotency key: one referral per purchase
  plan text not null,
  amount integer not null,                 -- what referee paid, pence
  reward_amount integer not null,          -- pence
  status text not null default 'pending' check (status in ('pending','qualified','paid','void')),
  void_reason text,
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  paid_at timestamptz
);
-- anti-fraud guard only (idempotency lives on preorder_id); partial so void rows
-- (self-referral, refunds) don't permanently block a legitimate later referral
create unique index referrals_referee_active_key
  on public.referrals (lower(referee_email)) where status <> 'void';

alter table public.preorders add column referral_code text;
create index preorders_referral_code_idx on public.preorders (referral_code);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
-- no policies: service-role access only (anon = deny-all)
```

Lazy qualification (no cron): admin GET flips `pending → qualified` for rows past the window whose preorder is still `paid`.

## Code changes

1. **`lib/commerce/referrals.ts`** — pure, testable core: reward constants + `rewardFor(plan)`, `generateReferralCode(name?)` (name prefix + 4 chars, unambiguous alphabet), `normalizeCode`, `normalizeEmail`, `isSelfReferral`, `QUALIFICATION_WINDOW_DAYS = 14`, `isPastQualificationWindow(createdAt, now)`, `REFERRAL_COOKIE = 'ff_ref'`, `referralUrl(origin, code)`.
2. **`app/r/[code]/route.ts`** — GET: validate code (exists + active) with admin client; if valid set `ff_ref` cookie (httpOnly, `secure` only in production, sameSite lax, 30 days). **Always redirect to `/#pricing`** regardless of validity (no enumeration oracle — invalid just sets no cookie).
3. **`app/api/checkout/route.ts`** — read `ff_ref` cookie, re-validate code (active), add `referral_code` to session `metadata`. Invalid/absent degrades silently.
4. **`app/api/stripe/webhook/route.ts`** —
   - `checkout.session.completed`: insert preorder with `.select('id').single()`; **on 23505 do NOT early-return** — fetch existing preorder id by `stripe_session_id` and continue (fixes retry-drops-referral). Then, both idempotent:
     a. referral insert (code from metadata; validate; self-referral → status `void`, reason `self_referral`; catch 23505 (dup referee/preorder) and 23503 (dead code FK) as benign);
     b. mint buyer's own code: insert on `owner_email` with `onConflict ignore` semantics, retry once on code-PK collision; then Brevo email with their link (failure logged, never fails the webhook).
   - `charge.refunded`: only when **fully refunded** (`charge.refunded === true`); find preorder by `stripe_payment_intent_id`, set `status='refunded'`; void the linked referral (`void_reason='refunded'`; if it was already `paid`, still void but keep `paid_at` so clawback is visible in admin).
   - Ops note (PR + env docs): `charge.refunded` must be enabled on the Stripe webhook endpoint.
5. **`lib/email/referralEmail.ts`** — Brevo helper following waitlist route's pattern (sender `hello@fourteenfisherman.com`, HTML + text, tags).
6. **`app/thanks/page.tsx`** — **read-only**: look up buyer's code by email; if minted, render "Give your mates £X off — get £100" block with copyable `/r/CODE` link; if not yet minted (webhook race), show "your referral link is on its way by email". No writes from the page.
7. **Admin** — `app/api/admin/referrals/route.ts` (GET list w/ lazy qualification; POST `{id, action:'mark_paid'}`) + `app/admin/referrals/page.tsx` (dark admin theme table: referrer, referee, plan, reward, status, created/qualified/paid, void reason, mark-paid). **Guard (fail closed)**: `supabase.auth.getUser()` email (lowercased/trimmed) ∈ parsed `ADMIN_EMAILS` env; unset/empty env ⇒ deny all; check runs before any data access, in both route handler and page. Referrer + referee emails shown side-by-side (manual fraud eyeball before payout).
8. **Tests** — add `vitest` (devDep, `npm test`): unit tests for `referrals.ts` (reward tiers incl. unknown plan, code shape/charset, normalization, self-referral, qualification boundary, referral URL). Then `npm run lint`, `npm run build`, and a manual dev-server walkthrough (cookie set on `/r/[code]`, redirect behaviour valid + invalid, checkout metadata, thanks block, admin gate + table).

## Env additions

- `ADMIN_EMAILS` — comma-separated allowlist (Vercel + `.env.local`).

## Out of scope (noted in PR)

- Referee-side £50 discount (double-sided offer) — `allow_promotion_codes` already on; product decision pending.
- Automated payouts / fraud scoring; auth for the pre-existing unguarded `/api/admin/clinical-data`; Stripe custom-field attribution fallback.

## Pitfalls tracked

- Webhook idempotent at every step **and** no early-exit on duplicate preorder.
- Single writer for code minting (webhook); `/thanks` tolerates missing code.
- Cookie `secure` gated off in dev (localhost is http).
- Seat-counter logic untouched; referral writes additive.
- `app/page.tsx` is a client component — cookie only touched in route handlers / server components.

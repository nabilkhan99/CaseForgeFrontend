# Referral Pathway Hardening — Plan

**Branch:** `feature/referral-hardening` (off `feature/preorder-launch`) → PR back into `feature/preorder-launch`.
**Context:** The refer-a-friend loop (PR #7) is merged and its happy path verified on the preview deploy. An adversarial audit (Opus subagent, 2026-07-17) found a set of money-touching pitfalls and a near-total absence of automated tests around the webhook/checkout/admin logic. This branch fixes the highest-severity findings and locks the behaviour in with tests. No product-visible changes.

## Audit findings → disposition

Verified against production DB before planning: `preorders.stripe_session_id` UNIQUE **exists**, `preorders.id` is uuid, all three `referrals` indexes live. So the audit's #1 ([VERIFY-DB] idempotency) is **confirmed sound — no action**.

### Fix now (this branch)

| # | Finding | Fix |
|---|---|---|
| F1 | **£0-payment fraud vector** — `allow_promotion_codes` + reward keyed on plan only means a 100%-off promo earns £100 on a £0 purchase | Minimum qualifying spend, keyed by plan (50% of list price: complete ≥ £299.50, self_study ≥ £99.50). Below floor → referral recorded as `void` / `below_min_spend`. Constants + logic in the pure core |
| F2 | **Referral decision logic untestable** — buried in webhook route | Extract pure `decideReferral()` (self-referral, tiering, min-spend) into `lib/commerce/referrals.ts`; webhook consumes it. Unit-test exhaustively |
| F3 | **Lost advocate invite email** — crash between code-mint and email send → retry never emails | Add `referral_codes.invited_at timestamptz`; send when null regardless of who minted, stamp after success. At-least-once with dedup, idempotent across retries |
| F4 | **Checkout's lax admin client** — local factory falls back to anon key, silently failing against RLS deny-all tables | Use the strict `lib/supabase/admin.ts` client for all checkout DB access; delete the local factory |
| F5 | **Partial refunds never void** + void-update failure returns 200 (Stripe won't retry) | Void the referral on **any** refund of the referred purchase (partial included — conservative; protects payouts). Preorder flips to `refunded` only on full refund, as now. Void-update failure → 500 so Stripe retries (update is idempotent). Loud log when a refund can't be matched to a preorder (null PI) |
| F6 | **`normalizeCode` unconstrained** — `<SCRIPT>X` is a "canonical" code | Strip to `[A-Z0-9]`, cap 16 chars; empty result = no code. Safe for minted codes (subset) and hand-seeded codes like `TESTREF` |
| F7 | **`formatPounds` rounds pence away** (2550 → "£26") | Pence-accurate (whole pounds bare, else 2dp); export + test |
| F8 | **Untested pure guards** | Tests for `parseAdminEmails` (fail-closed), adversarial `normalizeCode`, plan-catalogue↔`REWARD_BY_PLAN` drift guard |
| F9 | **No vitest config** — `@/` alias unresolvable for route-adjacent tests | `vitest.config.ts`: node env, explicit `@/` alias |

### Deferred (documented, deliberate)

- **Coaching-day TOCTOU oversell** — needs a transactional RPC/DB-enforced cap; pre-launch volume makes collision odds negligible; the soft-hold narrows the window. Separate ticket at launch scale. Not referral logic.
- **Dual `checkout.session.completed` endpoints** — ops concern: live-mode Stripe must point preorder events at `/api/stripe/webhook`. Added to go-live memory/checklist, not code.
- **Second-email self-referral** — inherent to email-based identity; the min-spend floor (F1) removes the free-money version. Residual risk = self-referring a real full-price purchase, which costs more than it earns.
- **`missing_fields` dead-letter** — stays console-error → Vercel logs; alerting is an ops task.
- **mark_paid audit trail / CSRF token** — admin-only, SameSite-mitigated; revisit if more admins are added.

## Implementation shape

1. **Pure core** (`lib/commerce/referrals.ts`): add `MIN_QUALIFYING_SPEND_BY_PLAN`, `meetsMinimumSpend()`, `decideReferral(input): {status, voidReason?, rewardAmount}`; tighten `normalizeCode`.
2. **Webhook** (`app/api/stripe/webhook/route.ts`): consume `decideReferral`; invite-email keyed off `invited_at`; refund changes per F5.
3. **Checkout** (`app/api/checkout/route.ts`): strict admin client only.
4. **Email** (`lib/email/referralEmail.ts`): export + fix `formatPounds`.
5. **Migration** (`supabase/migrations/20260717_referral_hardening.sql`): `alter table referral_codes add column invited_at timestamptz;` backfill existing rows to `now()` (they were invited or surfaced via /thanks). Additive; apply to prod at merge.
6. **Tests**: extend `lib/commerce/referrals.test.ts` (decideReferral matrix, normalizeCode adversarial, drift guard); new `lib/admin/guard.test.ts`, `lib/email/referralEmail.test.ts`. Target: every branch of `decideReferral`.
7. **Config**: `vitest.config.ts`.

## Verification

- `npm test` green; `npm run build` green; `npm run lint` clean on touched files.
- Self-test: replay the decision matrix by hand against the code (self-referral, £0 promo, partial refund, retry-email).
- Existing behaviour unchanged for the normal path: full-price referred purchase → `pending`, correct tier, one invite email.

## Review notes (plan review pass)

- *Tweak 1:* Original draft voided the preorder on partial refund too — wrong; a partially-refunded buyer still holds a seat. Only the **referral** is conservatively voided. (Reflected above.)
- *Tweak 2:* Floor set at 50% of list rather than "amount ≥ reward" — ties the rule to commercial intent (a genuinely discounted-but-real purchase still rewards) and is easier to reason about than a reward-relative ratio.
- *Tweak 3:* Backfill `invited_at = now()` for existing codes so the new send-when-null logic can't spam historical advocates on their next purchase.

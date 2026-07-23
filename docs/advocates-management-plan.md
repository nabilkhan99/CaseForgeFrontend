# Advocates Management — Plan

**Goal:** Let admins create & manage referral codes for people who haven't bought (cofounder, influencers, affiliates) from the dashboard — the missing half of the referral system. Tracking/payouts already exist; this adds deliberate link *issuance*.

**Branch:** built directly on `feature/preorder-launch` (so it appears on the live preview the founders are using). Full tests + self-review before push.

## Schema (migration ALREADY APPLIED to prod)
`referral_codes` gains:
- `code_type text not null default 'customer'` — check in ('customer','affiliate'). Auto-minted purchase codes stay 'customer'; admin-issued codes are 'affiliate'.
- `reward_override_pence integer` (nullable, >= 0) — a per-code flat reward that supersedes the plan tier (for negotiated influencer deals like "£50 flat per signup"). Null = use standard £100/£25 tiers.

## Reward logic change (money path — test hard)
`decideReferral` gains an optional `rewardOverridePence`:
- reward = `rewardOverridePence ?? rewardFor(plan)`.
- **Minimum-spend guard still uses the plan floor** (override changes the payout, not the fraud gate — never pay on a refunded/£0 purchase).
- Self-referral precedence unchanged.
Webhook `recordReferral` selects `reward_override_pence` on the code row and threads it in.

## Admin API (`/api/admin/referrals`, still isAdmin() fail-closed)
- GET: advocate rows also expose `codeType` and `rewardOverridePence` (and a shareable `link`).
- POST actions (discriminated on `action`):
  - `mark_paid` — unchanged.
  - `create_code` — { ownerName, ownerEmail, code?, rewardOverridePence? }. Server: normalizeCode (or generate), validate email, enforce uniqueness (409 on clash), set code_type='affiliate', **invited_at=now()** (admin hands them the link directly — no auto invite email), active=true. Returns the new row.
  - `set_active` — { code, active:boolean } — activate/deactivate without deleting history.

## Pure helpers + tests (`lib/commerce/advocates.ts` + test)
- `validateNewCode({ ownerName, ownerEmail, code })` → { ok, code, error } — trims/normalizes, checks email shape, code charset (reuse normalizeCode), name non-empty. Pure, exhaustively tested.
- `decideReferral` override matrix in referrals.test.ts: override beats tier; override + below-floor → still void below_min_spend; override + self-referral → still self_referral void; null override → standard tier (regression).

## UI — "Advocates" section in ReferralsTable dashboard
- Sits above/with the advocate breakdown. Design-system consistent (amber/stone, mono codes, Framer Motion).
- **Create form:** name, email, optional custom code (uppercased live), optional reward override (£ input → pence), submit → optimistic add + copyable link. Inline error on 409/validation.
- **Code list:** each code shows type badge (Customer / Affiliate), active toggle (deactivate/reactivate), clicks, earned, copy-link button. Affiliate codes visually distinct.
- Empty-state friendly.

## Verify
- `npm test` green (existing 57 + new). `npm run build` green. eslint clean on touched files.
- Self-check: create a code via the new form on the preview, confirm it lands with code_type='affiliate' + invited_at set; deactivate it; confirm /r/THATCODE stops setting the cookie.

## Deliberately deferred
- % -of-sale rewards (only flat override now). Bulk import. Per-code custom min-spend. Affiliate self-serve login (they see the dashboard via admin only for now).

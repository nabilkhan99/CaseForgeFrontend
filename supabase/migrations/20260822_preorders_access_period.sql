-- Every plan is now a Stripe subscription (self_study and complete as
-- fixed-term subscriptions, self_study_monthly as a rolling one), so each
-- pre-order has a real Stripe billing period behind it rather than a date we
-- infer from `created_at`.
--
-- These two columns record it, written by the Stripe webhook from the
-- subscription item's `current_period_start` / `current_period_end`:
--   * fixed-term plans — `access_ends_at` is the end of the paid term, which
--     lib/commerce/entitlements.ts shifts forward for anyone who bought before
--     launch (they would otherwise lose the days between purchase and 1 Sept).
--   * the rolling plan  — `access_ends_at` is the NEXT renewal date, and is
--     display only; access there follows the subscription's status.
--
-- Nullable on purpose. Rows written before this migration (the hand-provisioned
-- pre-launch orders and every pre-migration purchase) have neither, and the
-- entitlement falls back to the calendar-month arithmetic they were sold under.

alter table public.preorders
  add column if not exists access_starts_at timestamptz,
  add column if not exists access_ends_at timestamptz;

comment on column public.preorders.access_starts_at is
  'Start of the Stripe billing period for this order (subscription item current_period_start). Null for pre-migration rows.';
comment on column public.preorders.access_ends_at is
  'End of the Stripe billing period (subscription item current_period_end). Fixed-term plans: end of the paid term, before the pre-launch shift. Rolling plan: next renewal date, display only. Null for pre-migration rows.';

-- The webhook looks rows up by subscription id on every renewal, plan switch
-- and cancellation, so that lookup is now the hot path rather than an
-- occasional one.
create index if not exists preorders_stripe_subscription_id_idx
  on public.preorders (stripe_subscription_id)
  where stripe_subscription_id is not null;

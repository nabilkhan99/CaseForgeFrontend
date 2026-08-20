-- Make purchase → account provisioning recoverable.
--
-- Provisioning used to hang off "did THIS webhook call insert the preorder row",
-- so a buyer whose set-password email failed (Brevo 5xx, rate limit) was
-- stranded: Stripe's retry took the duplicate-session path and provisioning
-- never ran again. These two stamps move the decision onto the row itself —
-- `set_password_sent_at is null` means "still owed an email", which a retry, a
-- later webhook, or a nightly sweep can heal.
--
-- Nullable and unindexed on purpose: they are ops state for a small table, not
-- a query surface.
alter table public.preorders add column if not exists provisioned_at timestamptz;
alter table public.preorders add column if not exists set_password_sent_at timestamptz;

comment on column public.preorders.provisioned_at is
  'When the auth user for this buyer was created (or found to already exist) by the Stripe webhook.';
comment on column public.preorders.set_password_sent_at is
  'When the set-password obligation was closed: the email was sent, or the buyer already had an account and was owed none. Null = the buyer still owes an email; provisioning retries on it.';

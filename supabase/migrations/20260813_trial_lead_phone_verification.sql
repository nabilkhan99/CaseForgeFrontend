-- SMS verification for the trial gate phone number, mirroring the email
-- verification columns. phone_verification_skipped_at records a fail-open
-- pass-through (SMS could not be sent — no credits / provider down) so the
-- report still unlocks and the lead alert can say "unverified".
alter table public.trial_leads
  add column if not exists phone_verification_code_hash text,
  add column if not exists phone_verification_expires_at timestamptz,
  add column if not exists phone_verification_attempts integer not null default 0,
  add column if not exists phone_verification_last_sent_at timestamptz,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists phone_verification_skipped_at timestamptz;

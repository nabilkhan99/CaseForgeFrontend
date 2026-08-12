-- Phone number captured on the trial gate questionnaire (identity step).
-- Stored normalized (digits with optional leading +).
alter table public.trial_leads
  add column if not exists phone text;

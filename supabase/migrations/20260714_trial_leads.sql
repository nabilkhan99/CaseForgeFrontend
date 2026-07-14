-- Leads captured by the free mock station funnel: the email entered between
-- finishing the trial consultation and seeing the feedback report.
-- One free session per email is enforced against this table at create-session.

create table public.trial_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  session_id uuid not null unique,
  station_id uuid,
  created_at timestamptz not null default now()
);

alter table public.trial_leads enable row level security;

create unique index trial_leads_email_idx on public.trial_leads (lower(email));

-- Lead call log: every contact attempt with a lead, the next action for each
-- lead, and the hand-kept facts the lead list cannot work out for itself.
--
-- A lead is someone who took a free case (trial_leads) or a 5-day trial
-- (trial_grants) and never bought. The founders ring them; /admin/leads shows
-- who is due, and each call is logged against the lead with AI-tidied notes.
--
-- KEYED BY LOWER-CASED EMAIL, NOT FOREIGN KEYS. Guests have no account, and the
-- gate flow deletes and rewrites trial_leads rows, so a cascading link would
-- silently delete call history. Email is what every lead source shares.
--
-- SERVICE ROLE ONLY. RLS on with no policies (deny-all for anon and
-- authenticated), plus an explicit revoke as a second lock: these tables hold
-- notes about named people. Read and written only through /api/admin/leads/*
-- behind isAdmin().
--
-- Applied to production via the Supabase MCP; kept here as the record.

create table if not exists public.lead_calls (
  id uuid primary key default gen_random_uuid(),
  lead_email text not null check (lead_email = lower(lead_email)),
  logged_by text not null check (logged_by = lower(logged_by)),
  created_at timestamptz not null default now(),
  -- 'prompt': notes typed or dictated, tidied by AI (or saved as written);
  -- 'quick': a one-tap outcome such as No answer.
  source text not null check (source in ('prompt', 'quick')),
  outcome text not null check (outcome in ('no_answer', 'voicemail', 'spoke', 'not_interested', 'wrong_number', 'other')),
  raw_notes text,
  -- [{label, text}]: free-form points, no fixed fields.
  points jsonb not null default '[]'::jsonb,
  -- {firstName, exam, competitors, intent}: what the call taught us.
  facts jsonb not null default '{}'::jsonb,
  -- The next action this call produced, kept with the call as history.
  next_label text,
  next_kind text check (next_kind in ('call', 'text', 'email', 'check_purchase', 'none')),
  next_due timestamptz,
  next_source text check (next_source in ('rules', 'call', 'manual')),
  -- The deployment that tidied the notes; null when nobody but the caller did.
  model text
);

create index if not exists lead_calls_email_created_idx on public.lead_calls (lead_email, created_at);

alter table public.lead_calls enable row level security;

comment on table public.lead_calls is
  'Append-only log of contact attempts with leads. Service role only; written by /api/admin/leads/calls.';

-- The current next action per lead: what the list sorts on. Rewritten by each
-- logged call (from the follow-up rules or the call''s own timing cue) and by
-- manual edits. Leads nobody has called have no row; their first action is
-- worked out when the list is read.
create table if not exists public.lead_followups (
  lead_email text primary key check (lead_email = lower(lead_email)),
  label text not null,
  kind text not null check (kind in ('call', 'text', 'email', 'check_purchase', 'none')),
  due_at timestamptz,
  source text not null check (source in ('rules', 'call', 'manual')),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_reason text,
  why text not null default '',
  -- Learned on a call, for leads who signed up with only an email address.
  display_name text,
  -- The exam timing as the lead told us on a call ("February 2027").
  exam_note text,
  exam_date date,
  exam_month text check (exam_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  updated_at timestamptz not null default now(),
  updated_by text not null
);

alter table public.lead_followups enable row level security;

comment on table public.lead_followups is
  'Current next action per lead, plus facts learned on calls. Service role only; written by /api/admin/leads/*.';

-- Hand-kept facts: test and team accounts to hide, a second sign-up to merge
-- into the first, a name for someone who gave none. Kept in the database, not
-- in code, because the repo is public and these name real people.
create table if not exists public.lead_overrides (
  email text primary key check (email = lower(email)),
  kind text not null check (kind in ('exclude', 'merge', 'name')),
  merge_into text check (merge_into = lower(merge_into)),
  display_name text,
  reason text,
  created_at timestamptz not null default now(),
  check (kind <> 'merge' or merge_into is not null),
  check (kind <> 'name' or display_name is not null)
);

alter table public.lead_overrides enable row level security;

comment on table public.lead_overrides is
  'Lead list exclusions, merges and names that the data cannot tell us. Service role only.';

revoke all on table public.lead_calls, public.lead_followups, public.lead_overrides from anon, authenticated;

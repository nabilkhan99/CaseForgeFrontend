-- Referral pathway: refer-a-friend codes + reward lifecycle.
-- Applied to production via Supabase MCP on 2026-07-12; kept here as the record
-- (this repo has no supabase CLI setup — schema lives out-of-band).

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
  preorder_id uuid unique references public.preorders(id),  -- idempotency: one referral per purchase
  plan text not null,
  amount integer not null,                 -- what the referee paid, pence
  reward_amount integer not null,          -- pence
  status text not null default 'pending' check (status in ('pending','qualified','paid','void')),
  void_reason text,
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  paid_at timestamptz
);

-- Anti-fraud guard only (idempotency lives on preorder_id); partial so void rows
-- (self-referral, refunds) don't permanently block a legitimate later referral.
create unique index referrals_referee_active_key
  on public.referrals (lower(referee_email)) where status <> 'void';

alter table public.preorders add column referral_code text;
create index preorders_referral_code_idx on public.preorders (referral_code);

-- Service-role access only: RLS on, no policies (anon/authenticated = deny-all).
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

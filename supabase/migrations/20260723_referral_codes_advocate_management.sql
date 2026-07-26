-- Advocates management: distinguish auto-minted customer codes from
-- deliberately-issued affiliate/influencer codes, and allow a per-code reward
-- override (e.g. a negotiated flat fee) that supersedes the plan tier.
alter table public.referral_codes
  add column if not exists code_type text not null default 'customer',
  add column if not exists reward_override_pence integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'referral_codes_code_type_check') then
    alter table public.referral_codes
      add constraint referral_codes_code_type_check check (code_type in ('customer', 'affiliate'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'referral_codes_reward_override_nonneg') then
    alter table public.referral_codes
      add constraint referral_codes_reward_override_nonneg check (reward_override_pence is null or reward_override_pence >= 0);
  end if;
end $$;

update public.referral_codes set code_type = 'customer' where code_type is null;

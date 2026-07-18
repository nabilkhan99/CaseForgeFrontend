-- Referral dashboard: per-code click tracking for /r/CODE links.
alter table public.referral_codes add column if not exists click_count integer not null default 0;
alter table public.referral_codes add column if not exists last_clicked_at timestamptz;

-- Atomic increment (no read-modify-write race). Service-role only: the /r
-- route runs server-side with the service key; browsers never call this.
create or replace function public.increment_referral_click(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update referral_codes
     set click_count = click_count + 1,
         last_clicked_at = now()
   where code = p_code
     and active;
$$;

revoke execute on function public.increment_referral_click(text) from public, anon, authenticated;
grant execute on function public.increment_referral_click(text) to service_role;

-- Coaching days replace intake months as the unit of scarcity.
-- One coaching day = one remote small-group class, absolute capacity 6.
-- Bookings close at midnight (Europe/London) the day before the class.

create table public.coaching_days (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  label text not null,
  capacity integer not null default 6 check (capacity >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.coaching_days enable row level security;

-- 10-minute soft hold: a place is reserved while the buyer is on Stripe's
-- hosted checkout. Holds expire on their own; the webhook clears the hold
-- when the session completes.
create table public.checkout_holds (
  id uuid primary key default gen_random_uuid(),
  coaching_day date not null references public.coaching_days(day) on delete cascade,
  stripe_session_id text unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.checkout_holds enable row level security;

create index checkout_holds_day_expiry_idx on public.checkout_holds (coaching_day, expires_at);

alter table public.preorders add column if not exists coaching_day date;
create index if not exists preorders_coaching_day_idx on public.preorders (coaching_day);

-- Availability view for the coaching-day picker.
-- True capacity is never revealed: displayed capacity and places_left are
-- capped at 6, so a future parallel class only starts counting down once
-- real remaining places drop below 6.
create view public.coaching_day_availability as
select
  d.day,
  d.label,
  least(d.capacity, 6)::integer as capacity,
  greatest(least(d.capacity - coalesce(p.paid, 0) - coalesce(h.holds, 0), 6), 0)::integer as places_left,
  (d.day::timestamp at time zone 'Europe/London') as cutoff_at,
  case
    when d.status = 'closed' then 'closed'
    when now() >= (d.day::timestamp at time zone 'Europe/London') then 'closed'
    when d.capacity - coalesce(p.paid, 0) - coalesce(h.holds, 0) <= 0 then 'sold_out'
    else 'open'
  end as status,
  ((now() at time zone 'Europe/London')::date > d.day) as past
from public.coaching_days d
left join lateral (
  select count(*)::integer as paid
  from public.preorders p
  where p.coaching_day = d.day and p.plan = 'complete' and p.status = 'paid'
) p on true
left join lateral (
  select count(*)::integer as holds
  from public.checkout_holds h
  where h.coaching_day = d.day and h.expires_at > now()
) h on true
order by d.day;

-- Launch coaching days (fortnightly, alternating Sat/Sun). Edit in Supabase
-- as real dates are confirmed.
insert into public.coaching_days (day, label) values
  ('2026-09-12', 'Saturday 12 September 2026'),
  ('2026-09-27', 'Sunday 27 September 2026'),
  ('2026-10-10', 'Saturday 10 October 2026'),
  ('2026-10-25', 'Sunday 25 October 2026'),
  ('2026-11-07', 'Saturday 7 November 2026'),
  ('2026-11-22', 'Sunday 22 November 2026');

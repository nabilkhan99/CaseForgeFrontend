-- One to one coaching sessions replace the small group coaching day.
--
-- Every configured coaching date (coaching_days) now splits into two slots,
-- morning 09:00 to 12:00 and afternoon 13:00 to 16:00 (Europe/London), and
-- each slot takes exactly ONE booking. A slot is occupied by a paid Complete
-- order or by a live checkout hold.
--
-- Legacy rows with a coaching_day but no coaching_slot (bookings made under
-- the old format, and holds created by the previous deploy while this one
-- rolls out) occupy the WHOLE date. That is the safe reading: it can make a
-- slot look taken that is not, but it can never sell one slot twice.
--
-- The old coaching_day_availability view is left in place for the previous
-- deploy and should be dropped once this release is live.

alter table public.preorders
  add column if not exists coaching_slot text
  check (coaching_slot in ('morning', 'afternoon'));

alter table public.checkout_holds
  add column if not exists coaching_slot text
  check (coaching_slot in ('morning', 'afternoon'));

create index if not exists checkout_holds_session_idx on public.checkout_holds (stripe_session_id);

-- Is this slot taken? The single definition used by the availability view and
-- by both booking functions, so what the picker shows and what a booking
-- enforces cannot drift.
create or replace function public.coaching_slot_occupied(p_day date, p_slot text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.preorders p
    where p.coaching_day = p_day
      and p.plan = 'complete'
      and p.status = 'paid'
      and (p.coaching_slot = p_slot or p.coaching_slot is null)
  )
  or exists (
    select 1 from public.checkout_holds h
    where h.coaching_day = p_day
      and h.expires_at > now()
      and (h.coaching_slot = p_slot or h.coaching_slot is null)
  );
$$;

create or replace view public.coaching_slot_availability
with (security_invoker = on) as
select
  d.day,
  s.slot,
  s.slot_order,
  (d.day::timestamp at time zone 'Europe/London') as cutoff_at,
  case
    when d.status = 'closed' then 'closed'
    when now() >= (d.day::timestamp at time zone 'Europe/London') then 'closed'
    when public.coaching_slot_occupied(d.day, s.slot) then 'booked'
    else 'open'
  end as status,
  ((now() at time zone 'Europe/London')::date > d.day) as past
from public.coaching_days d
cross join (values ('morning', 1), ('afternoon', 2)) as s(slot, slot_order)
order by d.day, s.slot_order;

revoke all on public.coaching_slot_availability from anon, authenticated;
grant select on public.coaching_slot_availability to service_role;

-- Atomically reserve a slot for a checkout. Locks the date row so two buyers
-- racing for the same slot are serialised: exactly one gets a hold id.
-- outcome: 'held' | 'taken' | 'closed' | 'invalid'
create or replace function public.claim_coaching_slot(
  p_day date,
  p_slot text,
  p_expires_at timestamptz
)
returns table (hold_id uuid, outcome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_id uuid;
begin
  if p_slot is null or p_slot not in ('morning', 'afternoon') then
    return query select null::uuid, 'invalid'::text;
    return;
  end if;

  select d.status into v_status
  from public.coaching_days d
  where d.day = p_day
  for update;

  if not found
    or v_status = 'closed'
    or now() >= (p_day::timestamp at time zone 'Europe/London') then
    return query select null::uuid, 'closed'::text;
    return;
  end if;

  if public.coaching_slot_occupied(p_day, p_slot) then
    return query select null::uuid, 'taken'::text;
    return;
  end if;

  insert into public.checkout_holds (coaching_day, coaching_slot, expires_at)
  values (p_day, p_slot, p_expires_at)
  returning id into v_id;

  return query select v_id, 'held'::text;
end;
$$;

-- Book a slot for a paid Complete order that has no session yet (a customer
-- who moved up to Complete outside checkout). Same lock and same occupancy
-- rule as a checkout claim. Only ever fills an empty booking.
-- outcome: 'booked' | 'taken' | 'closed' | 'already_booked' | 'not_found' | 'invalid'
create or replace function public.book_coaching_slot_for_order(
  p_order_id uuid,
  p_day date,
  p_slot text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_order public.preorders%rowtype;
begin
  if p_slot is null or p_slot not in ('morning', 'afternoon') then
    return 'invalid';
  end if;

  select * into v_order
  from public.preorders
  where id = p_order_id and plan = 'complete' and status = 'paid'
  for update;

  if not found then
    return 'not_found';
  end if;
  if v_order.coaching_day is not null then
    return 'already_booked';
  end if;

  select d.status into v_status
  from public.coaching_days d
  where d.day = p_day
  for update;

  if not found
    or v_status = 'closed'
    or now() >= (p_day::timestamp at time zone 'Europe/London') then
    return 'closed';
  end if;

  if public.coaching_slot_occupied(p_day, p_slot) then
    return 'taken';
  end if;

  update public.preorders
  set coaching_day = p_day, coaching_slot = p_slot
  where id = p_order_id and coaching_day is null;

  return 'booked';
end;
$$;

revoke all on function public.coaching_slot_occupied(date, text) from public, anon, authenticated;
revoke all on function public.claim_coaching_slot(date, text, timestamptz) from public, anon, authenticated;
revoke all on function public.book_coaching_slot_for_order(uuid, date, text) from public, anon, authenticated;
grant execute on function public.coaching_slot_occupied(date, text) to service_role;
grant execute on function public.claim_coaching_slot(date, text, timestamptz) to service_role;
grant execute on function public.book_coaching_slot_for_order(uuid, date, text) to service_role;

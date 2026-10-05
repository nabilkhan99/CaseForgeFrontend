-- Case versions: replacing cases without taking them away from people who did them.
--
-- 121 of the 200 cases are being rewritten (Ishaq's case bank update, Oct 2026).
-- The rule: anyone with a MARKED consultation on an old case keeps that old case,
-- in its slot, exactly as it was (attempts, scores, feedback, pass). Everyone else
-- gets the new case in its place. Public listings show only the new cases, and
-- the bank lands on exactly 200.
--
-- Nothing here changes what anyone sees today: every existing case becomes
-- 'live', which is what it already is. This migration only adds the vocabulary
-- the switch-on needs later.
--
-- 1. stations.lifecycle: draft | live | archived.
--    draft     a new case being written or reviewed. Admins only (service role).
--    live      in the catalogue for everyone.
--    archived  replaced. Shown only to its keepers, and readable by anyone who
--              has a consultation on it, so their history and feedback keep
--              their titles.
--    is_active stays, as "is in the catalogue": twenty-odd queries and the RLS
--    policies already filter on it. A check constraint keeps the two in step.
--
--    ⚠️ CHANGES HOW STATIONS ARE WRITTEN FROM NOW ON. The old one-column toggle
--    (`update stations set is_active = false where ...`, as in the 25 Aug
--    rollback script) now FAILS the constraint, by design. Always set both:
--      update stations set is_active = false, lifecycle = 'draft'    where ...;
--      update stations set is_active = true,  lifecycle = 'live'     where ...;
--    New rows default to a hidden draft (is_active false, lifecycle draft), so
--    nothing can go live by accident.
--
-- 2. stations.replaces_station_id: the old case a new case takes the place of.
--    One replacement per old case. A replacement cannot go live unapproved.
--    That the old case is archived before its replacement goes live is enforced
--    by the switch-on, not here (a check constraint cannot see another row).
--
-- 3. stations.approved_at / approved_by: Ishaq's sign-off from the review page.
--
-- 4. stations.archived_slug: the public address an archived case had, so the
--    case pages can forward it to the replacement (served by code in step 2).
--
-- 5. stations.seo_description: a one-line, hand-written description for the
--    public case page, written alongside each new case. Null falls back to the
--    current template.
--
-- 6. case_keepers: who keeps which old case. Written ONCE per batch at switch-on
--    by snapshot_case_keepers() and never recalculated. A guest who completed
--    an old case and only signs up after its switch-on is not a keeper and gets
--    the new case (Nabil, 5 Oct 2026); their old feedback still works.
--
-- 7. RLS: drafts become unreadable to signed-in users. The hand-made policy
--    "signed-in users can read staged stations" (qual: true) let any signed-in
--    user read every row, including unreleased ones; it is replaced by a policy
--    that opens only ARCHIVED cases, and only to people who have used them.
--
-- Never delete a station: clinical_sessions.station_id references it, and
-- feedback, marking and the Development page all read it by id.

-- Fail fast instead of queueing behind a long transaction: this briefly locks
-- stations and clinical_sessions (well under a second at today's sizes).
set lock_timeout = '5s';

-- 1. Lifecycle -------------------------------------------------------------

alter table public.stations
  add column if not exists lifecycle text not null default 'live'
  check (lifecycle in ('draft', 'live', 'archived'));

-- Anything already out of the catalogue is unreleased, not replaced. Scoped to
-- 'live' so a replay can never reset an archived case.
update public.stations
set lifecycle = 'draft'
where is_active is not true
  and lifecycle = 'live';

-- From here on a new row is a hidden draft unless it says otherwise.
alter table public.stations alter column lifecycle set default 'draft';
alter table public.stations alter column is_active set default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stations_lifecycle_matches_is_active') then
    alter table public.stations
      add constraint stations_lifecycle_matches_is_active
      check ((lifecycle = 'live') = (is_active is true));
  end if;
end
$$;

-- 2. What replaces what ----------------------------------------------------

alter table public.stations
  add column if not exists replaces_station_id uuid
  references public.stations (id) on delete restrict;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stations_not_replacing_itself') then
    alter table public.stations
      add constraint stations_not_replacing_itself
      check (replaces_station_id is distinct from id);
  end if;
end
$$;

create unique index if not exists stations_replaces_station_id_key
  on public.stations (replaces_station_id)
  where replaces_station_id is not null;

-- 3. Review ----------------------------------------------------------------

alter table public.stations
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stations_replacement_approved_before_live') then
    alter table public.stations
      add constraint stations_replacement_approved_before_live
      check (lifecycle <> 'live' or replaces_station_id is null or approved_at is not null);
  end if;
end
$$;

-- 4. Where an archived case used to live -----------------------------------

alter table public.stations
  add column if not exists archived_slug text;

create unique index if not exists stations_archived_slug_key
  on public.stations (archived_slug)
  where archived_slug is not null;

-- 5. Page description ------------------------------------------------------

alter table public.stations
  add column if not exists seo_description text;

-- 6. Keepers ---------------------------------------------------------------

create table if not exists public.case_keepers (
  user_id    uuid not null references auth.users (id) on delete cascade,
  station_id uuid not null references public.stations (id) on delete restrict,
  kept_at    timestamptz not null default now(),
  primary key (user_id, station_id)
);

create index if not exists case_keepers_station_id_idx on public.case_keepers (station_id);

alter table public.case_keepers enable row level security;

drop policy if exists "users read their own kept cases" on public.case_keepers;
create policy "users read their own kept cases"
  on public.case_keepers
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Written only by the switch-on, through the service role.
revoke insert, update, delete, truncate on public.case_keepers from anon, authenticated;
revoke select on public.case_keepers from anon;

-- The archived-case policy below and the per-person library both ask "has this
-- user got a consultation on this case?". Without this they scan the table.
create index if not exists idx_sessions_station_user
  on public.clinical_sessions (station_id, user_id);

-- 7. Who can read which cases -----------------------------------------------
--
-- Unchanged: anon reads live free-trial cases; authenticated reads live cases.

drop policy if exists "signed-in users can read staged stations" on public.stations;

drop policy if exists "signed-in users can read archived cases they have used" on public.stations;
create policy "signed-in users can read archived cases they have used"
  on public.stations
  for select
  to authenticated
  using (
    lifecycle = 'archived'
    and exists (
      select 1 from public.clinical_sessions cs
      where cs.station_id = stations.id
        and cs.user_id = (select auth.uid())
    )
  );

-- 8. The keeper rule ----------------------------------------------------------
--
-- A keeper is a signed-in user with at least one MARKED consultation on the
-- case: any session that has a session_results row, whatever its status. That
-- includes the two abandoned-but-marked sessions found on 5 Oct 2026 (one a
-- Pass), and excludes guests (user_id is null) and sessions never marked.
--
-- One definition, used by both functions, so the preview a person checks is the
-- list the switch-on writes. Both read every user's sessions, so each is locked
-- to the service role the moment it is created (Postgres grants EXECUTE to
-- PUBLIC by default, and PostgREST would otherwise expose them as RPCs).

create or replace function public.case_keeper_candidates(p_station_ids uuid[])
returns table (user_id uuid, station_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct cs.user_id, cs.station_id
  from public.clinical_sessions cs
  join public.session_results sr on sr.session_id = cs.id
  where cs.station_id = any (p_station_ids)
    and cs.user_id is not null
$$;
revoke execute on function public.case_keeper_candidates(uuid[]) from public, anon, authenticated;
grant execute on function public.case_keeper_candidates(uuid[]) to service_role;

-- Writes the keepers for a batch. Idempotent: running it twice adds nothing.
create or replace function public.snapshot_case_keepers(p_station_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.case_keepers (user_id, station_id)
  select c.user_id, c.station_id
  from public.case_keeper_candidates(p_station_ids) c
  on conflict do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end
$$;
revoke execute on function public.snapshot_case_keepers(uuid[]) from public, anon, authenticated;
grant execute on function public.snapshot_case_keepers(uuid[]) to service_role;

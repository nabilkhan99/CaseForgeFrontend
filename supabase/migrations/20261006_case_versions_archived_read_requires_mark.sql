-- Case versions: an archived case is readable only by people MARKED on it.
--
-- ALREADY APPLIED to production (6 Oct 2026, migration
-- case_versions_archived_read_requires_mark). Kept here so the repo matches
-- the database; do not re-apply by hand.
--
-- 20261005_case_versions.sql opened an archived case to any signed-in user
-- with a clinical_sessions row on it ("has a session"). That was wider than the
-- keeper rule it exists for: a keeper is someone with a MARKED consultation
-- (a session_results row), so an unmarked attempt, a brief opened and left,
-- or a call that never connected, let a non-keeper keep reading the old
-- case's full text (script, mark scheme) after its replacement went live.
--
-- Now: authenticated users read an ARCHIVED station only if one of their
-- sessions on it has a session_results row. Every keeper has one, so the
-- library's kept-case read and their old feedback are unaffected. Feedback
-- and marking read stations with the service role, so a non-keeper's old
-- report still loads.

drop policy if exists "signed-in users can read archived cases they have used" on public.stations;
drop policy if exists "signed-in users can read archived cases they have been marked on" on public.stations;
create policy "signed-in users can read archived cases they have been marked on" on public.stations for select to authenticated using (lifecycle = 'archived' and exists (select 1 from public.clinical_sessions cs join public.session_results sr on sr.session_id = cs.id where cs.station_id = stations.id and cs.user_id = (select auth.uid())));

-- Joining details for a booked one to one coaching session.
--
-- Every Complete receipt promises the joining link "will appear on your
-- dashboard", and until now there was nowhere to keep one: a booking was a date
-- and a slot on the order and nothing else. These columns sit on the same
-- `preorders` row as `coaching_day` / `coaching_slot`, because a session is one
-- to one — the order IS the booking, so there is no second table to keep in
-- step with it.
--
-- Written only by /api/admin/coaching (service role). Nothing in the
-- entitlement path selects these columns, so a deploy that lands before this
-- migration degrades to "no joining details yet" instead of breaking the gate.
--
--   coaching_meeting_url      the video call link the student and coach join
--   coaching_coach_name       how the coach is named to the student ("Dr Hassan Khan")
--   coaching_coach_email      the coach's account, lower-cased; the cohort that
--                             lets them see the student's progress is keyed on it
--   coaching_details_sent_at  when the confirmation email last went out

alter table public.preorders
  add column if not exists coaching_meeting_url text
    check (coaching_meeting_url is null or coaching_meeting_url ~ '^https://'),
  add column if not exists coaching_coach_name text,
  add column if not exists coaching_coach_email text
    check (coaching_coach_email is null or coaching_coach_email = lower(coaching_coach_email)),
  add column if not exists coaching_details_sent_at timestamptz;

comment on column public.preorders.coaching_meeting_url is
  'Video call link for the booked one to one coaching session. https only. Set by an admin.';
comment on column public.preorders.coaching_coach_email is
  'Coach account for the booked session, lower-cased. Matches cohorts.trainer_email for the coach''s Students tab.';

-- Trial gate questionnaire: AKT/SCA status, training dates, and the
-- not-in-training branch.
--
-- All nullable by design — the flow branches, so a given lead legitimately
-- fills only one side. An ST2 has training_start_* and the exam columns and no
-- not_in_training_role; a qualified GP has the role and nothing else.
--
-- sca_sit_date is left in place: it holds real answers from the earlier,
-- coarser "when are you planning to sit?" question. New rows write sca_status
-- / sca_sitting instead, so the old column simply stops filling.

alter table public.trial_leads
  add column if not exists training_start_month text,
  add column if not exists training_start_year text,
  add column if not exists akt_status text,
  add column if not exists akt_sitting text,
  add column if not exists sca_status text,
  add column if not exists sca_sitting text,
  add column if not exists not_in_training_role text,
  add column if not exists expected_start_month text,
  add column if not exists expected_start_year text;

comment on column public.trial_leads.akt_status is
  'One of the eight AKT states (not_started, preparing_first, booked_first, awaiting_first, preparing_resit, booked_resit, awaiting_resit, passed).';
comment on column public.trial_leads.akt_sitting is
  'Follow-up answer: the sitting they are aiming for or booked onto. Null when the status asks no follow-up.';
comment on column public.trial_leads.sca_status is
  'The eight SCA states, same enum as akt_status.';
comment on column public.trial_leads.sca_sitting is
  'Follow-up answer for the SCA. Null when the status asks no follow-up.';
comment on column public.trial_leads.not_in_training_role is
  'Set only when training_stage = not_in_training.';
comment on column public.trial_leads.sca_sit_date is
  'DEPRECATED — the coarse pre-questionnaire answer. Retained for historical leads; new rows use sca_status/sca_sitting.';

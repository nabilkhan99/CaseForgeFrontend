-- What the five-station trial has already emailed to whom.
--
-- Two emails exist (day 3 "two days and N stations left", day 5 "your five
-- stations have ended") and they are sent BY HAND: there is no scheduler in
-- production, so scripts/trial-emails/due.ts is run from a laptop, on demand,
-- against the live database. That is the whole reason this table is here — a
-- hand-run script has no memory, and the only thing standing between a missed
-- day and somebody receiving the same email three mornings running is a record
-- of what went out.
--
-- WHY NOT DERIVE IT. Every other count in this feature is derived rather than
-- stored (see 20260906_trial_grants.sql), and that is the right default. It
-- cannot work here: an email that has left the building is not visible in our
-- database at all. Brevo knows, and Brevo is a network call away, rate limited,
-- and not something a send loop should be asking mid-flight. So this is a real
-- ledger, and the unique index below — not the script's own filtering — is what
-- actually makes a double send impossible.
--
-- ADDITIVE AND UNAPPLIED. Nothing reads this table except the send script, so
-- deploying the code before the migration breaks nothing: the script fails
-- loudly on its first query, which is the correct behaviour for a tool that is
-- about to email real people.

CREATE TABLE IF NOT EXISTS public.trial_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- The same two strings as `TrialEmailKind` in lib/email/trialEmails.ts and the
  -- Brevo tags (`trial-day3` / `trial-day5`). A CHECK rather than an enum, for
  -- the reason trial_grants.source gives: widening a CHECK is one migration.
  kind text NOT NULL CHECK (kind IN ('day3', 'day5')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  -- Brevo's message id for the send. Nullable because a send can succeed with
  -- no id in the response body, and losing the id is not a reason to fail to
  -- record that a person was emailed. It is what a bounce or complaint
  -- investigation joins on.
  message_id text
);

-- THE GUARANTEE. One of each kind per account, enforced by the database rather
-- than by the script's "already sent" filter: the filter is a snapshot taken at
-- the top of a run, and two overlapping runs (or one run started twice) would
-- both pass it. The insert is written after a successful send, so a duplicate
-- attempt fails here and is reported rather than silently mailed.
CREATE UNIQUE INDEX IF NOT EXISTS trial_email_sends_user_kind_idx
  ON public.trial_email_sends (user_id, kind);

ALTER TABLE public.trial_email_sends ENABLE ROW LEVEL SECURITY;

-- No policies at all, which with RLS on is deny-all for anon and authenticated:
-- service-role only, exactly as trial_grants and cohorts are. Nothing in the
-- app reads this — it exists for one script and for answering "did we email
-- them?" afterwards.

COMMENT ON TABLE public.trial_email_sends IS
  'Ledger of the five-station trial''s day-3 and day-5 emails. Written by scripts/trial-emails/due.ts after a successful Brevo send; the unique (user_id, kind) index is what makes a double send impossible.';
COMMENT ON COLUMN public.trial_email_sends.message_id IS
  'Brevo transactional message id, when the response carried one. Null is not a failure.';

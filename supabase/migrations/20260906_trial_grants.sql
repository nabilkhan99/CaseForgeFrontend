-- The five-station free trial: a grant that is not a purchase.
--
-- Five marked consultations, five days from the FIRST one, no card, in a real
-- account. The row records the offer that was made; what has been spent against
-- it is never stored here — see "CONSUMPTION IS DERIVED" below.
--
-- WHY A TABLE OF ITS OWN, NOT A £0 `preorders` ROW. `preorders` means money.
-- A £0 row would corrupt every revenue query, would need a fake plan key that
-- `lib/commerce/entitlements.ts` (which rejects anything outside PLANS) and
-- `stripePriceIdFor` would then have to refuse, and — the reason that settles
-- it — would put the trial INSIDE the purchase precedence fold, where a bug
-- could let a spent trial outrank a paid plan. As a peer table it cannot: the
-- fold never sees it, and `decideAccess` consults the grant only when there is
-- no live purchase. Same argument, same shape, as `cohorts` in
-- 20260901_trainer_cohorts.sql.
--
-- CONSUMPTION IS DERIVED, NEVER A COUNTER. "How many of the five have they
-- used" is answered by counting distinct `clinical_sessions` for the user that
-- carry a `session_results` row with `weighted_score > 0` and that started on
-- or after `created_at` — the same "genuinely scored" rule
-- lib/supabase/queries/passTracking.ts already applies everywhere else. Three
-- things fall out for free:
--   * a session too short to mark (Azure's `unmarkable` guard) writes no
--     result row and therefore consumes nothing, with no compensating write;
--   * a lead's old anonymous free mock predates the grant and does not count,
--     which is the product decision;
--   * there is no counter to drift, double-decrement, or reconcile.
--
-- WHY `started_at` IS NULLABLE. The five days run from the first consultation,
-- not from the day the account was made — someone handed a link on Friday must
-- not lose the weekend. It is stamped exactly once, by the first successful
-- `create-session`, through a compare-and-set (`... where started_at is null`)
-- so two concurrent starts cannot extend the window between them.
-- `expires_at` is written in the same statement rather than computed on read:
-- the window a trainee was told about must not move if `window_days` is ever
-- edited underneath them.

CREATE TABLE IF NOT EXISTS public.trial_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One grant per account, enforced here rather than in application code:
  -- `grantTrial` is called from three different doors (sign-up, guest reveal,
  -- signed link) and a second insert must be a no-op, not a second five
  -- stations.
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Lower-cased on write and CHECKed, exactly as `cohorts.trainer_email` is and
  -- for the same reason: these rows are written by our own code, so the column
  -- can be required to hold the normal form and the lookup stays a plain
  -- equality an index can serve. (`preorders.email` cannot do this — those rows
  -- come from Stripe.)
  email text NOT NULL CHECK (email = lower(email)),
  allowance smallint NOT NULL DEFAULT 5 CHECK (allowance > 0),
  window_days smallint NOT NULL DEFAULT 5 CHECK (window_days > 0),
  -- Which door this grant came through. Deliberately not an enum type: the
  -- doors are a product decision that has already changed twice, and a CHECK is
  -- one migration to widen where an enum is two.
  source text NOT NULL CHECK (source IN ('signup', 'guest_reveal', 'link', 'cohort')),
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The window is stamped as a pair or not at all. Without this a half-written
  -- row reads as "started, never expires", which is a free unlimited trial.
  CONSTRAINT trial_grants_window_pair CHECK (
    (started_at IS NULL AND expires_at IS NULL)
    OR (started_at IS NOT NULL AND expires_at IS NOT NULL)
  )
);

ALTER TABLE public.trial_grants ENABLE ROW LEVEL SECURITY;

-- The mint scripts and the guest-reveal door look a grant up by address before
-- they know a user id.
CREATE INDEX IF NOT EXISTS trial_grants_email_idx ON public.trial_grants (email);

-- `create policy` has no `if not exists`, so drop first and keep this file
-- re-runnable.
DROP POLICY IF EXISTS "read own trial grant" ON public.trial_grants;
CREATE POLICY "read own trial grant" ON public.trial_grants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No insert/update/delete policy at all, which with RLS on is deny-all for
-- anon and authenticated: writes are service-role only. Exactly the posture
-- 20260901_trainer_cohorts.sql takes, and the one that matters most here —
-- a user who could UPDATE their own row could reset `started_at` and practise
-- for ever.

COMMENT ON TABLE public.trial_grants IS
  'Five-station free trial. A grant, not a purchase: never folded into the preorders precedence ladder, and consulted only when there is no live purchase.';
COMMENT ON COLUMN public.trial_grants.started_at IS
  'Stamped once by the first successful create-session, via compare-and-set on started_at IS NULL. Null means the trial has not begun and the clock is not running.';
COMMENT ON COLUMN public.trial_grants.expires_at IS
  'started_at + window_days, written at stamp time so a later edit to window_days cannot move a window a trainee was already told about.';
COMMENT ON COLUMN public.trial_grants.allowance IS
  'How many genuinely-marked consultations the grant is worth. Spend is derived from session_results, never stored.';

-- The recommended "Start here" cases, in the order they should be offered.
--
-- A column on `stations` rather than a list somewhere else: `is_free_trial`
-- already lives here and already marks the set, so the only thing missing was
-- an order. Null for the other ~195, which sorts them out of the list
-- naturally. Chosen as pairs (a near miss, then a case where the same "one
-- change" applies), so the order is the whole point of the column.
ALTER TABLE public.stations
  ADD COLUMN IF NOT EXISTS free_trial_order smallint;

COMMENT ON COLUMN public.stations.free_trial_order IS
  'Order of the recommended "Start here" cases on the library board. Null = not one of them; the set itself is is_free_trial.';

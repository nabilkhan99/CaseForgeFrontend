-- Trainer cohorts: a pilot seat that is not a purchase.
--
-- A GP educator ("trainer") is given a cohort; their students get real accounts
-- that reach `/clinical-master/*` without a `preorders` row, limited to exactly
-- the cases named in `station_ids`. The trainer is a member of their own cohort
-- (so they can sit the same cases) AND is matched to it by email, which is what
-- unlocks the Students tab.
--
-- WHY THE ALLOWLIST IS A COLUMN, NOT A JOIN TABLE. The pilot assigns five
-- cases out of two hundred and changes as one edit, by hand. A `cohort_stations`
-- table would buy referential integrity we are not using and cost every read a
-- join; an array read alongside the membership row is one round trip on the
-- hottest path in the product (the entitlement gate runs on every navigation
-- into a consultation). A station id that no longer exists simply matches
-- nothing, which is the same outcome a deleted join row would have.
--
-- EMAIL MATCHING. `trainer_email` is CONSTRAINED to lower case rather than
-- normalised at read time. The alternative — store anything, compare through
-- `lower()` — is how `preorders.email` works, and it is the right call there
-- because those rows come from Stripe and cannot be dictated. These rows are
-- seeded by hand, so the column can simply be required to hold the normal form,
-- and then the lookup is a plain equality on a plain b-tree index.
--
-- That matters: the guard's filter is a wildcard-free comparison, and Postgres
-- does NOT rewrite `ILIKE 'x'` or `lower(col) = 'x'`-style predicates into
-- something a plain index can serve. An index on `lower(trainer_email)` paired
-- with an `.ilike` filter looks careful and is never used. Constraint plus
-- equality is the shape where the index and the query actually agree.
-- lib/trainer/guard.ts lower-cases the signed-in address before comparing.
--
-- RLS. Members may read their own membership and the cohort row behind it, so
-- the browser can be told which five cases it may open. Nothing else is
-- exposed: there is no insert/update/delete policy at all, so writes are
-- service-role only (seeded by hand for the pilot), and the trainer's read of
-- their students' sessions goes through the guarded service-role route at
-- /api/trainer/overview rather than through RLS. RLS on with no write policy =
-- deny all writes for anon/authenticated, which is the intended posture and the
-- same one `lectures` takes.

CREATE TABLE IF NOT EXISTS public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trainer_email text NOT NULL CHECK (trainer_email = lower(trainer_email)),
  station_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cohort_members (
  cohort_id uuid NOT NULL REFERENCES public.cohorts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, user_id)
);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;

-- The membership lookup runs on every gated navigation, keyed by user. The
-- primary key leads with `cohort_id`, so it cannot serve this.
CREATE INDEX IF NOT EXISTS cohort_members_user_idx
  ON public.cohort_members (user_id);

-- The trainer guard resolves a signed-in email against the cohort it owns, as a
-- plain equality — which is what the CHECK above buys, and what this index can
-- actually serve.
CREATE INDEX IF NOT EXISTS cohorts_trainer_email_idx
  ON public.cohorts (trainer_email);

-- `create policy` has no `if not exists`, so drop first and keep this file
-- re-runnable.
DROP POLICY IF EXISTS "read own cohort membership" ON public.cohort_members;
CREATE POLICY "read own cohort membership" ON public.cohort_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Reads `cohort_members`, whose own policy above is `user_id = auth.uid()` —
-- no recursion, because that policy references nothing in turn.
DROP POLICY IF EXISTS "read own cohort" ON public.cohorts;
CREATE POLICY "read own cohort" ON public.cohorts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cohort_members m
      WHERE m.cohort_id = cohorts.id
        AND m.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.cohorts IS
  'Trainer pilot cohorts. Membership grants access to `station_ids` only, without a preorders purchase.';
COMMENT ON COLUMN public.cohorts.trainer_email IS
  'The educator who sees the Students tab. Must be stored lower-cased (CHECK); the guard compares by plain equality.';
COMMENT ON COLUMN public.cohorts.station_ids IS
  'The complete set of stations a member may open. Everything else in the bank is locked for a cohort-only user.';
COMMENT ON TABLE public.cohort_members IS
  'Who is in a cohort, trainer included. The trainer is excluded from their own cohort views in app code, not here.';

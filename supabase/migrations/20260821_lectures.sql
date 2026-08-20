-- Lectures: the Complete-tier video course.
--
-- One row per lecture. The video itself never lives in the database: it sits in
-- the private Storage bucket `lectures`, and `storage_path` is the only pointer
-- to it. Playback is always a short-lived signed URL minted server-side by
-- /api/lectures/[id]/play after the entitlement check, so a bucket that is
-- private in Supabase stays private in practice.
--
-- `storage_path` is NULL until an upload is confirmed. The admin upload is two
-- phase — mint a signed PUT, then verify the object actually landed before
-- stamping the path — because a row pointing at a missing object is a broken
-- lecture that looks fine in the list. The path is always rebuilt server-side
-- from the row id (`videos/<id>.<ext>`); a client-supplied path is never
-- trusted.
--
-- `is_published` defaults false so a lecture can be created, uploaded and
-- checked before any user can see it. Unpublished rows are invisible to
-- /api/lectures entirely.
--
-- NOTE: the Storage bucket `lectures` (PRIVATE, no public read policy) is
-- created out-of-band in the Supabase dashboard — buckets are not tracked in
-- this migrations directory, matching the `consultation-recordings` precedent.
-- No RLS policies are added here on purpose: every read and write goes through
-- the service-role API routes, which do the entitlement and admin checks
-- themselves. RLS on with zero policies = deny all for anon/authenticated,
-- which is the intended posture.

CREATE TABLE IF NOT EXISTS public.lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  storage_path text,
  duration_seconds int,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lectures ENABLE ROW LEVEL SECURITY;

-- The list endpoint reads published lectures in running order on every load.
CREATE INDEX IF NOT EXISTS lectures_published_order_idx
  ON public.lectures (is_published, sort_order);

COMMENT ON TABLE public.lectures IS
  'Complete-tier lecture videos. Files live in the private `lectures` Storage bucket; access is signed-URL only, gated on entitlement.hasLectures.';
COMMENT ON COLUMN public.lectures.storage_path IS
  'Object key in the private `lectures` bucket (videos/<id>.<ext>). NULL until an upload is confirmed to exist. Never set from a client-supplied value.';
COMMENT ON COLUMN public.lectures.is_published IS
  'False hides the lecture from /api/lectures entirely, so a row can be created and uploaded before anyone can see it.';

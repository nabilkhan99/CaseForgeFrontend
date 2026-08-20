-- Entitlements are computed from preorders matched by email (buying email =
-- account email). Let a signed-in user read their own purchase rows so the
-- middleware/user clients can gate access without the service role.
-- (Applied to prod 2026-08-20 via MCP; kept here so repo history matches.)

-- `preorders` is created outside this repo, so nothing in source proved RLS was
-- on for it — and the reader below has no WHERE of its own, so RLS *is* the
-- scoping. Verified enabled in prod on 2026-08-20; this makes the repo assert
-- it, and keeps a future rebuild-from-migrations honest. Idempotent.
alter table public.preorders enable row level security;

-- Deliberately NO email_verified condition. It was tried and reverted: the
-- claim is not a top-level JWT field (that read is always null, denying every
-- row for everyone), and webhook-provisioned buyers (admin.createUser) do not
-- receive it in user_metadata either — so any verified-claim predicate locks
-- out exactly the buyers this policy exists for. The squat risk it targeted is
-- already contained: a session for someone else's email cannot exist without
-- access to that inbox (sign-up is invite-gated, set-password goes to the
-- buying address, and no OTP sign-in path mints sessions).
-- `create policy` has no `if not exists`, and this policy is already applied to
-- prod (see header) — so without the drop, re-running this file raises 42710 and
-- the "Idempotent" claim above is false for the half that matters.
drop policy if exists "read own purchases by email" on public.preorders;
create policy "read own purchases by email" on public.preorders
  for select to authenticated
  using (lower(email) = lower(auth.jwt()->>'email'));

-- Entitlements are computed from preorders matched by email (buying email =
-- account email). Let a signed-in user read their own purchase rows so the
-- middleware/user clients can gate access without the service role.
-- (Applied to prod 2026-08-20 via MCP; kept here so repo history matches.)

-- `preorders` is created outside this repo, so nothing in source proved RLS was
-- on for it — and the reader below has no WHERE of its own, so RLS *is* the
-- scoping. Verified enabled in prod on 2026-08-20; this makes the repo assert
-- it, and keeps a future rebuild-from-migrations honest. Idempotent.
alter table public.preorders enable row level security;

-- The email claim is only trustworthy once Supabase has confirmed the address:
-- provisioning sets `email_confirm: true` for an address Stripe collected but
-- never proved ownership of, so an unverified-email session must not read a
-- namesake's purchases. `coalesce(..., false)` fails closed on old tokens
-- minted before the claim existed.
drop policy if exists "read own purchases by email" on public.preorders;
create policy "read own purchases by email" on public.preorders
  for select to authenticated
  using (
    lower(email) = lower(auth.jwt()->>'email')
    and coalesce((auth.jwt()->>'email_verified')::boolean, false)
  );

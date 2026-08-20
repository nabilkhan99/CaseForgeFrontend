-- Entitlements are computed from preorders matched by email (buying email =
-- account email). Let a signed-in user read their own purchase rows so the
-- middleware/user clients can gate access without the service role.
-- (Applied to prod 2026-08-20 via MCP; kept here so repo history matches.)
CREATE POLICY "read own purchases by email" ON public.preorders
  FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email'));

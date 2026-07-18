-- Referral hardening: track when an advocate's invite email was sent so the
-- webhook can send it at-least-once (send when null, stamp on success) across
-- retries and repeat purchases.
alter table public.referral_codes add column if not exists invited_at timestamptz;

-- Backfill existing codes as already invited: every current advocate was either
-- emailed by the previous mint-time send or saw their link on /thanks, so they
-- must not be re-emailed by the new send-when-null logic.
update public.referral_codes set invited_at = now() where invited_at is null;

-- Customer receipts: the numbered audit trail behind every payment.
--
-- Receipt numbers are `FF-26-nnnn`, sequential, incrementing by one, starting
-- at FF-26-4478 (numbers up to FF-26-4477 were issued by hand before launch).
-- The spec's requirement is the strong one: no gaps, no reuse, no renumbering
-- after issue. That rules out the obvious implementations:
--
--   * a Postgres SEQUENCE is non-transactional by design. `nextval` is not
--     rolled back, so every failed webhook delivery and every `on conflict do
--     nothing` would burn a number and leave a hole in the audit trail.
--   * `max(sequence_number) + 1` races two concurrent Stripe deliveries into
--     the same number.
--
-- So the counter is an ordinary row, and `issue_receipt` below takes a row lock
-- on it. See the function for how a retry gets its number back rather than a
-- new one.

create table if not exists public.receipt_counters (
  series text primary key,
  next_number integer not null
);

comment on table public.receipt_counters is
  'The next unissued receipt number per series. One row. Locked by issue_receipt().';

-- The launch offset. `do nothing` so re-running the migration cannot rewind a
-- counter that has already issued live numbers.
insert into public.receipt_counters (series, next_number)
values ('FF-26', 4478)
on conflict (series) do nothing;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),

  -- The number as it appears on the PDF and in the filename, e.g. FF-26-4478.
  receipt_number text not null unique,
  series text not null default 'FF-26',
  sequence_number integer not null,

  -- IDEMPOTENCY KEY, and the reason a Stripe retry is free: the Stripe object
  -- that caused this charge. The checkout session id for a purchase, the
  -- invoice id for a monthly renewal. Unique, so a redelivered event can only
  -- ever resolve to the receipt it already issued.
  stripe_event_key text not null unique,

  -- Who and what. Denormalised on purpose: a receipt is a record of what was
  -- true at the moment of payment, so a later name change or plan switch on
  -- the pre-order must not rewrite an issued document.
  preorder_id uuid references public.preorders (id) on delete set null,
  email text not null,
  customer_name text,
  plan text not null,
  amount_pence integer not null,
  currency text not null default 'gbp',

  -- 'Card' or 'Bank transfer', as printed.
  payment_method text not null default 'Card',

  -- The CHARGE date, which is not the coaching day date. Stored so a retry
  -- reprints the same date the customer was first sent.
  paid_at timestamptz not null,

  -- Rolling-plan billing period; null for the two one-off course plans.
  period_start timestamptz,
  period_end timestamptz,

  -- "Saturday 12 September 2026". Complete only.
  coaching_day_label text,

  -- 'purchase' (a checkout) or 'renewal' (a monthly subscription cycle).
  kind text not null default 'purchase',

  -- When this receipt was emailed, claimed compare-and-swap style BEFORE the
  -- send. The renewal path's equivalent of `preorders.set_password_sent_at`.
  --
  -- Allocation is idempotent, so a redelivered `invoice.paid` gets the same
  -- receipt row back — but "same row" and "already emailed" are different
  -- questions, and without this second one a routine Stripe redelivery would
  -- send the subscriber another copy of a receipt they already have. The
  -- purchase path needs no equivalent: its send is already gated by the
  -- set-password claim on `preorders`.
  emailed_at timestamptz,

  issued_at timestamptz not null default now()
);

comment on table public.receipts is
  'One row per issued customer receipt. The sequence is the audit trail: never renumber, never delete.';
comment on column public.receipts.stripe_event_key is
  'Checkout session id (purchase) or invoice id (renewal). Unique — this is what makes a Stripe webhook retry return the SAME receipt number instead of burning a new one.';
comment on column public.receipts.paid_at is
  'Date of payment as printed on the receipt. The charge date, NOT the coaching day date.';

-- Belt and braces on the audit trail: the number is unique on its own, and the
-- integer behind it is unique within its series.
create unique index if not exists receipts_series_sequence_idx
  on public.receipts (series, sequence_number);

-- "What has this customer been sent" — the support question this table answers.
create index if not exists receipts_email_idx on public.receipts (email);
create index if not exists receipts_preorder_id_idx on public.receipts (preorder_id);

-- Service role only. Nothing in the browser reads or writes receipts: the PDF
-- is generated in the Stripe webhook and delivered as an email attachment, so
-- there is no client-side surface to grant. RLS on with no policies is the
-- explicit form of that.
alter table public.receipts enable row level security;
alter table public.receipt_counters enable row level security;

-- Belt and braces beneath RLS: Supabase's default privileges grant these roles
-- table-level access underneath the policy wall, so a future migration that
-- accidentally turns RLS off would expose them. Revoking the grant means there
-- is no second way in.
revoke all on public.receipts from anon, authenticated;
revoke all on public.receipt_counters from anon, authenticated;

/**
 * Allocate a receipt number and record the receipt, exactly once per payment.
 *
 * Stripe retries webhook deliveries routinely, and two deliveries of the same
 * event can be in flight at once. Both cases have to end with ONE number:
 *
 *   1. Already issued for this Stripe object -> return the existing row. This
 *      is the common retry, and it costs one indexed read.
 *
 *   2. Not yet issued -> take the counter's row lock. A concurrent delivery
 *      blocks here until we commit or abort, so the increment cannot race.
 *
 *   3. If the insert still trips `receipts_stripe_event_key_key` — the other
 *      delivery got there first and committed while we waited — the inner
 *      BEGIN/EXCEPTION block rolls back to its implicit savepoint. That undoes
 *      OUR counter increment as well as our insert, so the number we took is
 *      handed straight back rather than left as a hole, and we return the
 *      winner's row. Both deliveries then report the same receipt number.
 *
 * The counter increment lives in the caller's transaction throughout, which is
 * the whole point: unlike `nextval`, an abort anywhere gives the number back.
 *
 * ⚠️ Assumes READ COMMITTED, which is Postgres's and Supabase's default and what
 * supabase-js gives every `rpc()` call. Step 3 depends on it twice: the blocked
 * UPDATE re-reads the committed counter rather than aborting, and the fallback
 * SELECT takes a fresh snapshot that can see the winner's row. Under REPEATABLE
 * READ or SERIALIZABLE the blocked UPDATE raises serialization_failure instead,
 * which is re-raised below for the caller to retry rather than silently
 * mishandled. Do not call this from a transaction at a higher isolation level.
 *
 * ⚠️ The counter's row lock is held until the CALLING transaction commits, so
 * every other payment queues behind it. supabase-js runs each `rpc()` as its own
 * autocommit statement, which keeps that window to a single round trip — render
 * the PDF and send the email AFTER this returns, never inside a transaction
 * that still holds the lock.
 */
create or replace function public.issue_receipt(
  p_stripe_event_key text,
  p_preorder_id uuid,
  p_email text,
  p_customer_name text,
  p_plan text,
  p_amount_pence integer,
  p_currency text,
  p_payment_method text,
  p_paid_at timestamptz,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_coaching_day_label text,
  p_kind text
) returns public.receipts
language plpgsql
as $$
declare
  v_series constant text := 'FF-26';
  v_row public.receipts;
  v_number integer;
begin
  if p_stripe_event_key is null or length(trim(p_stripe_event_key)) = 0 then
    raise exception 'issue_receipt requires a stripe_event_key';
  end if;

  -- (1) Already issued. The retry path.
  select * into v_row from public.receipts where stripe_event_key = p_stripe_event_key;
  if found then
    return v_row;
  end if;

  begin
    -- (2) Row lock. Concurrent deliveries serialise here.
    update public.receipt_counters
       set next_number = next_number + 1
     where series = v_series
    returning next_number - 1 into v_number;

    if v_number is null then
      raise exception 'receipt series % is not initialised in receipt_counters', v_series;
    end if;

    insert into public.receipts (
      receipt_number, series, sequence_number, stripe_event_key, preorder_id, email,
      customer_name, plan, amount_pence, currency, payment_method, paid_at,
      period_start, period_end, coaching_day_label, kind
    ) values (
      v_series || '-' || lpad(v_number::text, 4, '0'),
      v_series,
      v_number,
      p_stripe_event_key,
      p_preorder_id,
      p_email,
      p_customer_name,
      p_plan,
      p_amount_pence,
      coalesce(p_currency, 'gbp'),
      coalesce(p_payment_method, 'Card'),
      coalesce(p_paid_at, now()),
      p_period_start,
      p_period_end,
      p_coaching_day_label,
      coalesce(p_kind, 'purchase')
    )
    returning * into v_row;

  exception
    when serialization_failure then
      -- Only reachable if a caller ran us above READ COMMITTED. The savepoint
      -- rollback has already handed the number back; re-raise so the caller
      -- retries rather than receiving a half-truth.
      raise;
    when unique_violation then
      -- (3) A concurrent delivery won. Our increment is rolled back with this
      -- block, so the series keeps no gap. Their number stands for both of us.
      select * into v_row from public.receipts where stripe_event_key = p_stripe_event_key;
      if not found then
        -- A unique violation that is NOT the event key (a corrupted counter
        -- colliding on receipt_number) must not be swallowed.
        raise;
      end if;
  end;

  return v_row;
end;
$$;

comment on function public.issue_receipt(
  text, uuid, text, text, text, integer, text, text, timestamptz, timestamptz, timestamptz, text, text
) is
  'Idempotent receipt allocation keyed on the Stripe session/invoice id. A retry returns the SAME number; a lost race gives its number back rather than leaving a gap.';

-- Only the service role issues receipts. The grant is explicit rather than left
-- to Supabase's default privileges: if any earlier migration altered default
-- privileges for functions, an implicit grant would fail on the first live
-- payment and nothing would warn us until then.
revoke all on function public.issue_receipt(
  text, uuid, text, text, text, integer, text, text, timestamptz, timestamptz, timestamptz, text, text
) from public, anon, authenticated;

grant execute on function public.issue_receipt(
  text, uuid, text, text, text, integer, text, text, timestamptz, timestamptz, timestamptz, text, text
) to service_role;

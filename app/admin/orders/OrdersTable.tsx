'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getPlan } from '@/lib/commerce/plans';
import type { OrderStats, SessionDateBookings, SlotBooking } from '@/lib/commerce/orderStats';
import {
  COACHING_SLOTS,
  COACHING_SLOT_ORDER,
  formatCoachingDate,
  formatCoachingDateCompact,
  isCoachingSlotKey,
  slotTimeRange,
} from '@/lib/commerce/coachingSlots';

/** One purchase, as the admin orders API returns it. */
interface Order {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  coaching_day: string | null;
  coaching_slot: string | null;
  amount: number;
  currency: string;
  status: string;
  referral_code: string | null;
  created_at: string;
}

/** What an empty cell shows. Not a dash: no em or en dashes in this product's copy. */
const EMPTY_CELL = '·';

const EMPTY_STATS: OrderStats = {
  paidCount: 0,
  refundedCount: 0,
  grossRevenuePence: 0,
  refundedPence: 0,
  referredPaidCount: 0,
  referredPct: null,
  byPlan: [],
};

/**
 * Format pence as a pound string. Mirrors gbp() in the referrals table (whole
 * pounds bare, else 2dp) — kept local so each admin view stays self-contained.
 */
function gbp(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

/** Order timestamp, short form: "24 Jul, 14:32". */
function fmtOrderedAt(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

/** An order's coaching session, short form: "Sat 7 Nov, 09:00 to 12:00". */
function fmtOrderSession(order: Order): string {
  if (!order.coaching_day) return EMPTY_CELL;
  const date = formatCoachingDateCompact(order.coaching_day);
  return isCoachingSlotKey(order.coaching_slot)
    ? `${date}, ${slotTimeRange(order.coaching_slot)}`
    : date;
}

function fmtTimestamp(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface StatDef {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  dim?: boolean;
}

export default function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>(EMPTY_STATS);
  const [sessionBookings, setSessionBookings] = useState<SessionDateBookings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? 'Not authorized.' : 'Failed to load orders.');
        setOrders([]);
        setStats(EMPTY_STATS);
        setSessionBookings([]);
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
      setStats(data.stats ?? EMPTY_STATS);
      setSessionBookings(data.sessionBookings ?? []);
      setUpdatedAt(new Date());
    } catch {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statDefs: StatDef[] = [
    { label: 'Orders', value: stats.paidCount.toLocaleString('en-GB') },
    { label: 'Revenue', value: gbp(stats.grossRevenuePence), highlight: stats.grossRevenuePence > 0 },
    {
      label: 'Refunded',
      value: gbp(stats.refundedPence),
      sub: `${stats.refundedCount} order${stats.refundedCount === 1 ? '' : 's'}`,
      dim: true,
    },
    {
      label: 'Referred',
      value: stats.referredPaidCount.toLocaleString('en-GB'),
      sub: stats.referredPct === null ? EMPTY_CELL : `${stats.referredPct}% of orders`,
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        {/* ── Header ── */}
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Orders</h1>
            <p className="mt-2 text-sm text-muted">Every purchase, referred or not</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span>
              {updatedAt ? (
                <>
                  Updated <span className="font-mono">{fmtTimestamp(updatedAt)}</span>
                </>
              ) : (
                EMPTY_CELL
              )}
            </span>
            <Link
              href="/admin"
              className="text-primary hover:text-primary-light underline underline-offset-4"
            >
              ← Admin
            </Link>
            <Link
              href="/admin/referrals"
              className="text-primary hover:text-primary-light underline underline-offset-4"
            >
              Referrals →
            </Link>
            <button
              onClick={load}
              disabled={loading}
              className="text-primary hover:text-primary-light underline underline-offset-4 disabled:opacity-40"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-8 border-l-2 border-danger pl-4 py-2 text-sm text-danger">{error}</div>
        )}

        {/* ── Stats strip ── */}
        <section className="mt-12 border-t border-border">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {statDefs.map((s, i) => (
              <div
                key={s.label}
                className="border-b border-border px-1 py-6 sm:py-8 sm:[&:not(:nth-child(2n+1))]:border-l sm:[&:not(:nth-child(2n+1))]:border-border lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-border sm:pl-5 sm:[&:nth-child(2n+1)]:pl-1 lg:[&:nth-child(2n+1)]:pl-5 lg:[&:first-child]:pl-1"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {s.label}
                </p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 + i * 0.06, ease: 'easeOut' }}
                  className={`mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums ${
                    s.dim ? 'text-muted' : s.highlight ? 'text-primary' : 'text-heading'
                  }`}
                >
                  {s.value}
                </motion.p>
                {s.sub && <p className="mt-1 text-[11px] text-muted">{s.sub}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ── By plan ── */}
        <section className="mt-16">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">By plan</h2>

          {loading && stats.byPlan.length === 0 ? (
            <p className="mt-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : stats.byPlan.length === 0 ? (
            <p className="mt-8 text-sm text-muted">No plans sold yet.</p>
          ) : (
            <div className="mt-4">
              {stats.byPlan.map((p, i) => (
                <motion.div
                  key={p.planKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4), ease: 'easeOut' }}
                  className="flex items-baseline justify-between gap-4 px-1 py-4 border-b border-border"
                >
                  <span className="text-base text-heading">{p.planName}</span>
                  <span className="flex items-baseline gap-6 shrink-0">
                    <span className="font-mono text-sm text-muted tabular-nums">
                      {p.paidCount} order{p.paidCount === 1 ? '' : 's'}
                    </span>
                    <span className="font-mono text-base font-semibold text-heading tabular-nums">
                      {gbp(p.revenuePence)}
                    </span>
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── Coaching sessions ── */}
        <section className="mt-16">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Coaching sessions
          </h2>

          {loading && sessionBookings.length === 0 ? (
            <p className="mt-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : sessionBookings.length === 0 ? (
            <p className="mt-8 text-sm text-muted">No coaching dates scheduled.</p>
          ) : (
            <div className="mt-4">
              {sessionBookings.map((d, i) => (
                <motion.div
                  key={d.day}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: 'easeOut' }}
                  className={`grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr] gap-x-6 gap-y-2 px-1 py-4 border-b border-border items-center ${
                    d.past ? 'opacity-45' : ''
                  }`}
                >
                  <span className="text-sm text-heading truncate">{formatCoachingDate(d.day)}</span>
                  {COACHING_SLOT_ORDER.map((slot) => (
                    <SlotCell
                      key={slot}
                      name={COACHING_SLOTS[slot].name}
                      time={slotTimeRange(slot)}
                      booking={d.slots[slot]}
                    />
                  ))}
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── All orders ── */}
        <section className="mt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              All orders
            </h2>
            {orders.length > 0 && (
              <span className="text-xs text-muted">{orders.length} total</span>
            )}
          </div>

          {loading && orders.length === 0 ? (
            <p className="mt-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : orders.length === 0 ? (
            <p className="mt-8 text-sm text-muted">No orders yet.</p>
          ) : (
            <div className="mt-4">
              {/* column header */}
              <div className="hidden md:grid grid-cols-[0.9fr_1.2fr_1.7fr_0.9fr_0.8fr_1.3fr_0.8fr_0.9fr] gap-4 px-1 py-3 border-b border-border text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>Date</span>
                <span>Name</span>
                <span>Email</span>
                <span>Plan</span>
                <span className="text-right">Amount</span>
                <span>Coaching session</span>
                <span>Status</span>
                <span className="text-right">Code</span>
              </div>

              {orders.map((o, i) => {
                const settled = o.status === 'paid';
                return (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.4), ease: 'easeOut' }}
                    className={`grid grid-cols-2 md:grid-cols-[0.9fr_1.2fr_1.7fr_0.9fr_0.8fr_1.3fr_0.8fr_0.9fr] gap-x-4 gap-y-1 px-1 py-4 border-b border-border items-center ${
                      settled ? '' : 'opacity-60'
                    }`}
                  >
                    <div className="font-mono text-[11px] text-muted whitespace-nowrap">
                      {fmtOrderedAt(o.created_at)}
                    </div>
                    <div className="text-sm text-heading truncate text-right md:text-left">
                      {o.full_name || EMPTY_CELL}
                    </div>
                    <div className="text-[11px] font-mono text-muted truncate col-span-2 md:col-span-1">
                      {o.email}
                    </div>
                    <div className="text-sm text-body truncate">
                      <span className="md:hidden text-[10px] text-muted uppercase mr-2">Plan</span>
                      {getPlan(o.plan)?.name ?? o.plan}
                    </div>
                    <div
                      className={`text-right font-mono text-sm font-semibold tabular-nums ${
                        settled ? 'text-heading' : 'text-muted line-through'
                      }`}
                    >
                      {gbp(o.amount)}
                    </div>
                    <div className="text-[11px] text-muted truncate">{fmtOrderSession(o)}</div>
                    <div className="flex md:block justify-end">
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <div className="text-right font-mono text-[11px] text-muted truncate">
                      {o.referral_code || EMPTY_CELL}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * One slot of a coaching date: its time, its state, and who is booked into it.
 * Booked gets the amber accent. Two names in one slot is a double booking and
 * is flagged, because it needs a phone call.
 */
function SlotCell({ name, time, booking }: { name: string; time: string; booking: SlotBooking }) {
  const label =
    booking.state === 'booked'
      ? 'Booked'
      : booking.state === 'held'
        ? 'In checkout'
        : booking.state === 'closed'
          ? 'Closed'
          : 'Open';
  const tone =
    booking.state === 'booked'
      ? 'bg-primary/10 text-primary'
      : booking.state === 'held'
        ? 'bg-primary/5 text-primary'
        : booking.state === 'closed'
          ? 'bg-border/60 text-muted'
          : 'bg-success/10 text-success';
  const doubleBooked = booking.bookedBy.length > 1;
  return (
    <div className="flex items-center justify-between md:justify-start gap-3 min-w-0">
      <span className="text-[11px] text-muted whitespace-nowrap">
        {name} <span className="font-mono">{time}</span>
      </span>
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${
          doubleBooked ? 'bg-danger/10 text-danger' : tone
        }`}
      >
        {doubleBooked ? 'Double booked' : label}
      </span>
      {booking.bookedBy.length > 0 && (
        <span className="text-[11px] text-body truncate" title={booking.bookedBy.join(', ')}>
          {booking.bookedBy.join(', ')}
        </span>
      )}
    </div>
  );
}

/** Order status badge — paid reads normal, refunded/canceled recede. */
function OrderStatusBadge({ status }: { status: string }) {
  const isPaid = status === 'paid';
  const label = status === 'canceled' ? 'Canceled' : status === 'refunded' ? 'Refunded' : 'Paid';
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${
        isPaid ? 'bg-success/10 text-success' : 'bg-border/60 text-muted line-through'
      }`}
    >
      {label}
    </span>
  );
}

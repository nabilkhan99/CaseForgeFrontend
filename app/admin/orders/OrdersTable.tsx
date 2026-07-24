'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getPlan } from '@/lib/commerce/plans';
import type { OrderStats } from '@/lib/commerce/orderStats';

/** One purchase, as the admin orders API returns it. */
interface Order {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  coaching_day: string | null;
  amount: number;
  currency: string;
  status: string;
  referral_code: string | null;
  created_at: string;
}

/** One coaching day from the availability view. */
interface CoachingDay {
  day: string;
  label: string;
  capacity: number;
  places_left: number;
  status: 'open' | 'closed' | 'sold_out';
  past: boolean;
}

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
  const [coachingDays, setCoachingDays] = useState<CoachingDay[]>([]);
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
        setCoachingDays([]);
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
      setStats(data.stats ?? EMPTY_STATS);
      setCoachingDays(data.coachingDays ?? []);
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

  // Coaching-day labels are keyed by ISO date so an order can name its day.
  const dayLabels = new Map(coachingDays.map((d) => [d.day, d.label]));

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
      sub: stats.referredPct === null ? '—' : `${stats.referredPct}% of orders`,
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        {/* ── Header ── */}
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Orders</h1>
            <p className="mt-2 text-sm text-muted">Every purchase — referred or not</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span>
              {updatedAt ? (
                <>
                  Updated <span className="font-mono">{fmtTimestamp(updatedAt)}</span>
                </>
              ) : (
                '—'
              )}
            </span>
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

        {/* ── Coaching days ── */}
        <section className="mt-16">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Coaching days
          </h2>

          {loading && coachingDays.length === 0 ? (
            <p className="mt-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : coachingDays.length === 0 ? (
            <p className="mt-8 text-sm text-muted">No coaching days scheduled.</p>
          ) : (
            <div className="mt-4">
              {coachingDays.map((d, i) => (
                <motion.div
                  key={d.day}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: 'easeOut' }}
                  className={`flex items-center justify-between gap-4 px-1 py-4 border-b border-border ${
                    d.past ? 'opacity-45' : ''
                  }`}
                >
                  <span className="text-sm text-heading truncate">{d.label}</span>
                  <span className="flex items-center gap-5 shrink-0">
                    <span className="font-mono text-sm text-body tabular-nums">
                      {d.places_left}/{d.capacity}
                      <span className="ml-1.5 text-[11px] text-muted">left</span>
                    </span>
                    <DayStatusBadge status={d.status} />
                  </span>
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
                <span>Coaching day</span>
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
                      {o.full_name || '—'}
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
                    <div className="text-[11px] text-muted truncate">
                      {o.coaching_day ? (dayLabels.get(o.coaching_day) ?? o.coaching_day) : '—'}
                    </div>
                    <div className="flex md:block justify-end">
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <div className="text-right font-mono text-[11px] text-muted truncate">
                      {o.referral_code || '—'}
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

/** Availability badge for a coaching day — sold out gets the amber accent. */
function DayStatusBadge({ status }: { status: CoachingDay['status'] }) {
  const label = status === 'sold_out' ? 'Sold out' : status === 'closed' ? 'Closed' : 'Open';
  const tone =
    status === 'sold_out'
      ? 'bg-primary/10 text-primary'
      : status === 'closed'
        ? 'bg-border/60 text-muted'
        : 'bg-success/10 text-success';
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${tone}`}
    >
      {label}
    </span>
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

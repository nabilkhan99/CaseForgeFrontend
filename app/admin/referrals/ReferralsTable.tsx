'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { DashboardStats } from '@/lib/commerce/referralStats';

interface Referral {
  id: string;
  referral_code: string;
  referrer_email: string;
  referee_email: string;
  plan: string;
  amount: number;
  reward_amount: number;
  status: 'pending' | 'qualified' | 'paid' | 'void';
  void_reason: string | null;
  created_at: string;
  qualified_at: string | null;
  paid_at: string | null;
}

const EMPTY_STATS: DashboardStats = {
  totalClicks: 0,
  totalPurchases: 0,
  totalRevenuePence: 0,
  owedNowPence: 0,
  pendingPence: 0,
  paidPence: 0,
  advocates: [],
};

/**
 * Format pence as a pound string. Mirrors formatPounds in
 * lib/email/referralEmail.ts (whole pounds bare, else 2dp) — kept local rather
 * than imported because that module pulls in the server-only Brevo SDK.
 */
function gbp(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
  highlight?: boolean;
}

export default function ReferralsTable() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/referrals', { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? 'Not authorized.' : 'Failed to load referrals.');
        setReferrals([]);
        setStats(EMPTY_STATS);
        return;
      }
      const data = await res.json();
      setReferrals(data.referrals ?? []);
      setStats(data.stats ?? EMPTY_STATS);
      setUpdatedAt(new Date());
    } catch {
      setError('Failed to load referrals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markPaid(id: string) {
    setPayingId(id);
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'mark_paid' }),
      });
      if (res.ok) {
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to mark paid.');
      }
    } catch {
      setError('Failed to mark paid.');
    } finally {
      setPayingId(null);
    }
  }

  const owed = stats.owedNowPence;
  const statDefs: StatDef[] = [
    { label: 'Link clicks', value: stats.totalClicks.toLocaleString('en-GB') },
    { label: 'Referred purchases', value: stats.totalPurchases.toLocaleString('en-GB') },
    { label: 'Referred revenue', value: gbp(stats.totalRevenuePence) },
    { label: 'Owed now', value: gbp(owed), highlight: owed > 0 },
    { label: 'Pending', value: gbp(stats.pendingPence) },
    { label: 'Paid to date', value: gbp(stats.paidPence) },
  ];

  const payoutQueue = referrals.filter((r) => r.status === 'qualified');

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        {/* ── Header ── */}
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Referrals</h1>
            <p className="mt-2 text-sm text-muted">Advocate performance & payout queue</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {statDefs.map((s, i) => (
              <div
                key={s.label}
                className="border-b border-border px-1 py-6 sm:py-8 sm:[&:not(:nth-child(3n+1))]:border-l sm:[&:not(:nth-child(3n+1))]:border-border lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-border sm:pl-5 sm:[&:nth-child(3n+1)]:pl-1 lg:[&:nth-child(3n+1)]:pl-5 lg:[&:first-child]:pl-1"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {s.label}
                </p>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 + i * 0.06, ease: 'easeOut' }}
                  className={`mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums ${
                    s.highlight ? 'text-primary' : 'text-heading'
                  }`}
                >
                  {s.value}
                </motion.p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Advocates ── */}
        <section className="mt-16">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Advocates</h2>

          {loading && stats.advocates.length === 0 ? (
            <p className="mt-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : stats.advocates.length === 0 ? (
            <p className="mt-8 text-sm text-muted">
              No advocates yet — codes appear here the moment someone gets a share link.
            </p>
          ) : (
            <div className="mt-4">
              {/* column header */}
              <div className="hidden md:grid grid-cols-[1.4fr_1.6fr_repeat(4,0.7fr)_1.4fr] gap-4 px-1 py-3 border-b border-border text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>Code</span>
                <span>Owner</span>
                <span className="text-right">Clicks</span>
                <span className="text-right">Buys</span>
                <span className="text-right">Conv.</span>
                <span className="text-right">Earned</span>
                <span className="text-right">Breakdown</span>
              </div>

              {stats.advocates.map((a, i) => (
                <motion.div
                  key={a.code}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: 'easeOut' }}
                  className={`grid grid-cols-2 md:grid-cols-[1.4fr_1.6fr_repeat(4,0.7fr)_1.4fr] gap-x-4 gap-y-1 px-1 py-4 border-b border-border items-center ${
                    a.active ? '' : 'opacity-50'
                  }`}
                >
                  <div className="font-mono text-sm font-semibold text-heading">
                    {a.code}
                    {!a.active && (
                      <span className="ml-2 text-[9px] uppercase tracking-wider text-muted">inactive</span>
                    )}
                  </div>
                  <div className="text-sm text-right md:text-left">
                    <div className="text-body truncate">{a.ownerName ?? '—'}</div>
                    <div className="text-[11px] text-muted font-mono truncate">{a.ownerEmail}</div>
                  </div>
                  <div className="text-right font-mono text-sm text-body tabular-nums">
                    <span className="md:hidden text-[10px] text-muted uppercase mr-2">Clicks</span>
                    {a.clicks}
                  </div>
                  <div className="text-right font-mono text-sm text-body tabular-nums">
                    <span className="md:hidden text-[10px] text-muted uppercase mr-2">Buys</span>
                    {a.purchases}
                  </div>
                  <div className="text-right font-mono text-sm text-body tabular-nums">
                    <span className="md:hidden text-[10px] text-muted uppercase mr-2">Conv.</span>
                    {a.conversionPct === null ? '—' : `${a.conversionPct}%`}
                  </div>
                  <div className="text-right font-mono text-sm font-semibold text-heading tabular-nums">
                    <span className="md:hidden text-[10px] text-muted uppercase mr-2">Earned</span>
                    {gbp(a.earnedPence)}
                  </div>
                  <div className="col-span-2 md:col-span-1 flex md:justify-end gap-3 mt-1 md:mt-0 text-[11px] font-mono text-muted">
                    <Breakdown label="pend" value={a.pendingPence} tone="pending" />
                    <Breakdown label="qual" value={a.qualifiedPence} tone="qualified" />
                    <Breakdown label="paid" value={a.paidPence} tone="paid" />
                    <Breakdown label="void" value={a.voidPence} tone="void" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── Payout queue ── */}
        <section className="mt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Payout queue</h2>
            {payoutQueue.length > 0 && (
              <span className="text-xs text-muted">
                {payoutQueue.length} to pay · <span className="text-primary font-mono">{gbp(owed)}</span>
              </span>
            )}
          </div>

          {loading && referrals.length === 0 ? (
            <p className="mt-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : payoutQueue.length === 0 ? (
            <p className="mt-8 text-sm text-muted">Nothing to pay out right now. Qualified referrals land here.</p>
          ) : (
            <div className="mt-4">
              {payoutQueue.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4), ease: 'easeOut' }}
                  className="flex items-center justify-between gap-4 px-1 py-4 border-b border-border"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-heading font-mono truncate">{r.referrer_email}</div>
                    <div className="text-[11px] text-muted truncate">
                      code <span className="font-mono">{r.referral_code}</span> · referred{' '}
                      {r.referee_email} · qualified {fmtDate(r.qualified_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <span className="font-mono text-base font-semibold text-heading tabular-nums">
                      {gbp(r.reward_amount)}
                    </span>
                    <button
                      onClick={() => markPaid(r.id)}
                      disabled={payingId === r.id}
                      className="text-[11px] font-semibold uppercase tracking-wider px-3.5 py-2 rounded-lg bg-primary text-surface-raised hover:bg-primary-light disabled:opacity-50 transition-colors"
                    >
                      {payingId === r.id ? '…' : 'Mark paid'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  pending: 'text-amber-600',
  qualified: 'text-primary',
  paid: 'text-success',
  void: 'text-danger/70',
};

function Breakdown({ label, value, tone }: { label: string; value: number; tone: string }) {
  if (value === 0) return <span className="text-muted/40">{label} —</span>;
  return (
    <span className={TONE_CLASS[tone]}>
      {label} {gbp(value)}
    </span>
  );
}

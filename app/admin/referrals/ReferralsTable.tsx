'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { AdvocateStats, DashboardStats } from '@/lib/commerce/referralStats';

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

/** Advocate row as the admin API returns it — the pure stats plus a share link. */
type AdvocateRow = AdvocateStats & { link: string };

/** Dashboard payload with links attached to each advocate (see the GET route). */
interface DashboardData extends Omit<DashboardStats, 'advocates'> {
  advocates: AdvocateRow[];
}

/** Shape of the referral_codes row returned by the create_code action. */
interface CreatedCode {
  code: string;
  owner_email: string;
  owner_name: string | null;
  active: boolean;
  click_count: number;
  created_at: string;
  code_type: 'customer' | 'affiliate';
  reward_override_pence: number | null;
  link: string;
}

const EMPTY_STATS: DashboardData = {
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
  const [stats, setStats] = useState<DashboardData>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  // ── Create-advocate form state ──
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newOverride, setNewOverride] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

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

  async function createCode(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    const overrideRaw = newOverride.trim();
    const rewardOverridePence =
      overrideRaw === '' ? undefined : Math.round(Number(overrideRaw) * 100);

    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_code',
          ownerName: newName,
          ownerEmail: newEmail,
          code: newCode.trim() || undefined,
          rewardOverridePence,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create code.');
        return;
      }

      // Optimistically surface the new code, then re-fetch so the rollup is exact.
      const created = data.code as CreatedCode;
      setCreatedLink(created.link);
      setStats((prev) => ({ ...prev, advocates: [toAdvocateRow(created), ...prev.advocates] }));
      setNewName('');
      setNewEmail('');
      setNewCode('');
      setNewOverride('');
      await load();
    } catch {
      setCreateError('Failed to create code.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(code: string, active: boolean) {
    setTogglingCode(code);
    // Optimistic flip; a re-fetch below reconciles with the server.
    setStats((prev) => ({
      ...prev,
      advocates: prev.advocates.map((a) => (a.code === code ? { ...a, active } : a)),
    }));
    try {
      const res = await fetch('/api/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_active', code, active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to update code.');
      }
      await load();
    } catch {
      setError('Failed to update code.');
      await load();
    } finally {
      setTogglingCode(null);
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

        {/* ── Advocates (management: issue & toggle codes) ── */}
        <section className="mt-16">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Advocates</h2>
          <p className="mt-2 text-sm text-muted">
            Issue a share link for a cofounder, influencer or affiliate — no purchase needed.
          </p>

          {/* Create form */}
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            onSubmit={createCode}
            className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1.8fr_1.1fr_1fr_auto] gap-3 items-end"
          >
            <Field label="Name">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm text-body placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm text-body placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Code (optional)">
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="Auto"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 font-mono text-sm text-body placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <Field label="Reward £ (optional)">
              <input
                type="number"
                min="0"
                step="1"
                value={newOverride}
                onChange={(e) => setNewOverride(e.target.value)}
                placeholder="Tier"
                className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 font-mono text-sm text-body placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
            <button
              type="submit"
              disabled={creating}
              className="text-[11px] font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg bg-primary text-surface-raised hover:bg-primary-light disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {creating ? '…' : 'Create link'}
            </button>
          </motion.form>

          {createError && (
            <div className="mt-3 border-l-2 border-danger pl-4 py-1.5 text-sm text-danger">{createError}</div>
          )}

          {createdLink && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2.5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-success">Link ready</span>
              <code className="flex-1 min-w-0 truncate rounded-lg border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-body">
                {createdLink}
              </code>
              <CopyButton url={createdLink} />
            </motion.div>
          )}

          {/* Codes list */}
          {stats.advocates.length === 0 ? (
            <p className="mt-8 text-sm text-muted">No codes yet — create the first one above.</p>
          ) : (
            <div className="mt-8">
              <div className="hidden md:grid grid-cols-[1.3fr_1.7fr_0.9fr_0.7fr_0.8fr_auto] gap-4 px-1 py-3 border-b border-border text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>Code</span>
                <span>Owner</span>
                <span>Type</span>
                <span className="text-right">Clicks</span>
                <span className="text-right">Earned</span>
                <span className="text-right">Actions</span>
              </div>

              {stats.advocates.map((a, i) => (
                <motion.div
                  key={a.code}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: 'easeOut' }}
                  className={`grid grid-cols-2 md:grid-cols-[1.3fr_1.7fr_0.9fr_0.7fr_0.8fr_auto] gap-x-4 gap-y-1.5 px-1 py-4 border-b border-border items-center ${
                    a.active ? '' : 'opacity-50'
                  }`}
                >
                  <div className="font-mono text-sm font-semibold text-heading truncate">{a.code}</div>
                  <div className="text-sm text-right md:text-left">
                    <div className="text-body truncate">{a.ownerName ?? '—'}</div>
                    <div className="text-[11px] text-muted font-mono truncate">{a.ownerEmail}</div>
                  </div>
                  <div className="flex md:block justify-end">
                    <TypeBadge codeType={a.codeType} rewardOverridePence={a.rewardOverridePence} />
                  </div>
                  <div className="text-right font-mono text-sm text-body tabular-nums">
                    <span className="md:hidden text-[10px] text-muted uppercase mr-2">Clicks</span>
                    {a.clicks}
                  </div>
                  <div className="text-right font-mono text-sm font-semibold text-heading tabular-nums">
                    <span className="md:hidden text-[10px] text-muted uppercase mr-2">Earned</span>
                    {gbp(a.earnedPence)}
                  </div>
                  <div className="col-span-2 md:col-span-1 flex md:justify-end items-center gap-3 mt-1 md:mt-0">
                    <CopyButton url={a.link} compact />
                    <button
                      onClick={() => toggleActive(a.code, !a.active)}
                      disabled={togglingCode === a.code}
                      className="text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-heading underline underline-offset-4 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {togglingCode === a.code ? '…' : a.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── Advocate performance ── */}
        <section className="mt-16">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Advocate performance</h2>

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

/** Labelled wrapper for a create-form input. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Copy-to-clipboard button for a share link. */
function CopyButton({ url, compact }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      onClick={copy}
      className={`text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
        compact
          ? 'text-muted hover:text-primary underline underline-offset-4'
          : 'px-3.5 py-2 rounded-lg bg-primary text-surface-raised hover:bg-primary-light'
      }`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * Small badge distinguishing an auto-minted customer code from a deliberately
 * issued affiliate code, showing the flat override when one is set.
 */
function TypeBadge({
  codeType,
  rewardOverridePence,
}: {
  codeType: 'customer' | 'affiliate';
  rewardOverridePence: number | null;
}) {
  const isAffiliate = codeType === 'affiliate';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
          isAffiliate ? 'bg-primary/10 text-primary' : 'bg-border/60 text-muted'
        }`}
      >
        {isAffiliate ? 'Affiliate' : 'Customer'}
      </span>
      {typeof rewardOverridePence === 'number' && (
        <span className="text-[10px] font-mono text-muted">{gbp(rewardOverridePence)}/sale</span>
      )}
    </span>
  );
}

/** Map a freshly created code row into an advocate row for optimistic display. */
function toAdvocateRow(created: CreatedCode): AdvocateRow {
  return {
    code: created.code,
    ownerEmail: created.owner_email,
    ownerName: created.owner_name,
    active: created.active,
    codeType: created.code_type,
    rewardOverridePence: created.reward_override_pence,
    clicks: created.click_count,
    purchases: 0,
    conversionPct: null,
    revenuePence: 0,
    earnedPence: 0,
    pendingPence: 0,
    qualifiedPence: 0,
    paidPence: 0,
    voidPence: 0,
    link: created.link,
  };
}

'use client';

import { useCallback, useEffect, useState } from 'react';

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

function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusClasses(status: Referral['status']): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'qualified':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'pending':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'void':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

export default function ReferralsTable() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/referrals', { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? 'Not authorized.' : 'Failed to load referrals.');
        setReferrals([]);
        return;
      }
      const data = await res.json();
      setReferrals(data.referrals ?? []);
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

  const totals = referrals.reduce(
    (acc, r) => {
      if (r.status === 'qualified') acc.owed += r.reward_amount;
      if (r.status === 'paid') acc.paid += r.reward_amount;
      return acc;
    },
    { owed: 0, paid: 0 },
  );

  return (
    <div className="min-h-[100dvh] bg-[#0a0e1a] text-slate-200">
      <header className="border-b border-white/5 bg-[#0d1120]">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
              £
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Referrals — Admin</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Payout tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span>
              Owed (qualified): <span className="text-blue-400 font-mono">{gbp(totals.owed)}</span>
            </span>
            <span>
              Paid: <span className="text-emerald-400 font-mono">{gbp(totals.paid)}</span>
            </span>
            <button onClick={load} className="text-indigo-400 hover:text-indigo-300 underline">
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="animate-pulse text-slate-500 text-sm py-12 text-center">Loading referrals…</div>
        ) : referrals.length === 0 && !error ? (
          <div className="text-slate-500 text-sm py-12 text-center">No referrals yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">
                  <th className="text-left px-4 py-3">Referrer</th>
                  <th className="text-left px-4 py-3">Referee</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-right px-4 py-3">Reward</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Qualified</th>
                  <th className="text-left px-4 py-3">Paid</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      <div>{r.referrer_email}</div>
                      <div className="text-[10px] text-slate-600">code {r.referral_code}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.referee_email}</td>
                    <td className="px-4 py-3 text-slate-400">{r.plan}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">{gbp(r.reward_amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border w-fit inline-block ${statusClasses(r.status)}`}
                      >
                        {r.status}
                      </span>
                      {r.void_reason && (
                        <div className="text-[10px] text-red-400/70 mt-1">{r.void_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(r.qualified_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(r.paid_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'qualified' ? (
                        <button
                          onClick={() => markPaid(r.id)}
                          disabled={payingId === r.id}
                          className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50"
                        >
                          {payingId === r.id ? '…' : 'Mark paid'}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

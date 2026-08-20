'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import type { AdminUserProgress } from '@/app/api/admin/progress/route';

type SortKey = 'passed' | 'attempted' | 'lastActivity';

const SORTS: readonly { key: SortKey; label: string }[] = [
  { key: 'passed', label: 'Passed' },
  { key: 'attempted', label: 'Attempted' },
  { key: 'lastActivity', label: 'Recent' },
] as const;

/** Last-activity date, short form: "24 Jul". */
function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtTimestamp(date: Date): string {
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Per-user pass progress. Sorted by passes by default — the question this page
 * answers is who is actually getting through the bank, not who logged in last.
 * Rows expand in place to name the stations behind the two numbers.
 */
export default function ProgressTable() {
  const [progress, setProgress] = useState<AdminUserProgress[]>([]);
  const [totalStations, setTotalStations] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [sort, setSort] = useState<SortKey>('passed');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/progress', { cache: 'no-store' });
      if (!res.ok) {
        setError(res.status === 403 ? 'Not authorized.' : 'Failed to load progress.');
        setProgress([]);
        setTotalStations(0);
        return;
      }
      const data = await res.json();
      setProgress(data.progress ?? []);
      setTotalStations(data.totalStations ?? 0);
      setTruncated(Boolean(data.truncated));
      setUpdatedAt(new Date());
    } catch {
      setError('Failed to load progress.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    // Sorting is local: the whole (capped) set is already in memory, so a
    // re-sort should never cost a round trip.
    return [...progress].sort((a, b) => {
      if (sort === 'lastActivity') {
        return (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '');
      }
      if (sort === 'attempted') return b.attempted - a.attempted || b.passed - a.passed;
      return b.passed - a.passed || b.attempted - a.attempted;
    });
  }, [progress, sort]);

  const usersWithAPass = progress.filter((p) => p.passed > 0).length;
  const stationsPassed = progress.reduce((sum, p) => sum + p.passed, 0);

  const statDefs = [
    { label: 'Users practising', value: progress.length.toLocaleString('en-GB') },
    {
      label: 'Users with a pass',
      value: usersWithAPass.toLocaleString('en-GB'),
      highlight: usersWithAPass > 0,
    },
    { label: 'Stations passed', value: stationsPassed.toLocaleString('en-GB') },
    { label: 'Stations live', value: totalStations.toLocaleString('en-GB') },
  ];

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        {/* ── Header ── */}
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Progress</h1>
            <p className="mt-2 text-sm text-muted">
              Who is passing stations — best attempt counts
            </p>
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
              href="/admin"
              className="text-primary hover:text-primary-light underline underline-offset-4"
            >
              ← Admin
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
                    s.highlight ? 'text-primary' : 'text-heading'
                  }`}
                >
                  {s.value}
                </motion.p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Per user ── */}
        <section className="mt-16">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              By user
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted">Sort</span>
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={
                    sort === s.key
                      ? 'text-heading font-semibold underline underline-offset-4'
                      : 'text-muted hover:text-primary'
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {loading && rows.length === 0 ? (
            <p className="mt-8 text-sm text-muted animate-pulse">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="mt-8 text-sm text-muted">Nobody has completed a station yet.</p>
          ) : (
            <div className="mt-4">
              {/* column header */}
              <div className="hidden md:grid grid-cols-[1.2fr_1.8fr_0.7fr_0.8fr_0.8fr] gap-4 px-1 py-3 border-b border-border text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>Name</span>
                <span>Email</span>
                <span className="text-right">Passed</span>
                <span className="text-right">Attempted</span>
                <span className="text-right">Last seen</span>
              </div>

              {rows.map((u, i) => {
                const open = expanded === u.userId;
                return (
                  <motion.div
                    key={u.userId}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.4), ease: 'easeOut' }}
                    className="border-b border-border"
                  >
                    <button
                      onClick={() => setExpanded(open ? null : u.userId)}
                      className="w-full grid grid-cols-2 md:grid-cols-[1.2fr_1.8fr_0.7fr_0.8fr_0.8fr] gap-x-4 gap-y-1 px-1 py-4 items-center text-left hover:bg-surface-raised/60 transition-colors"
                    >
                      <span className="text-sm text-heading truncate">{u.fullName || '—'}</span>
                      <span className="text-[11px] font-mono text-muted truncate col-span-2 md:col-span-1">
                        {u.email || u.userId}
                      </span>
                      <span
                        className={`text-right font-mono text-sm font-semibold tabular-nums ${
                          u.passed > 0 ? 'text-success' : 'text-muted'
                        }`}
                      >
                        {u.passed}
                      </span>
                      <span className="text-right font-mono text-sm text-body tabular-nums">
                        {u.attempted}
                      </span>
                      <span className="text-right font-mono text-[11px] text-muted whitespace-nowrap">
                        {fmtDay(u.lastActivity)}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="grid gap-8 sm:grid-cols-2 px-1 pb-6 pt-1">
                            <StationList
                              title="Passed"
                              stations={u.passedStations}
                              empty="No passes yet."
                              tone="text-success"
                            />
                            <StationList
                              title="Attempted, not passed"
                              stations={u.unpassedStations}
                              empty="Nothing outstanding."
                              tone="text-muted"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}

              {truncated && (
                <p className="mt-4 text-xs text-muted">
                  Showing the {rows.length} most-progressed users.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** One half of an expanded row: the station titles behind a number. */
function StationList({
  title,
  stations,
  empty,
  tone,
}: {
  title: string;
  stations: string[];
  empty: string;
  tone: string;
}) {
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>
        {title} <span className="font-mono">({stations.length})</span>
      </p>
      {stations.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {stations.map((s) => (
            <li key={s} className="text-sm text-body">
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

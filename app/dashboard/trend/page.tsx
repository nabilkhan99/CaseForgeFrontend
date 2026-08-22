'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import { TrendReport, TrendTheme } from '@/lib/clinical-master/trendTypes';
import { formatRelativeDate } from '@/lib/utils';

const MAX_RETRIES = 20;
/** How long to wait for a rebuild before handing the old report back. */
const REFRESH_MAX_POLLS = 40;
const POLL_MS = 3000;

function ThemeBlock({ t, technique }: { t: TrendTheme; technique?: boolean }) {
  return (
    <div className="mb-5 pl-3 border-l-2 border-primary/30">
      <div className="flex items-baseline gap-2">
        <span className="text-[14px] font-semibold text-heading">{t.theme_label}</span>
        <span className="text-[11px] text-muted">
          {t.frequency} {t.frequency === 1 ? 'case' : 'cases'}
          {t.trajectory ? `, ${t.trajectory}` : ''}
        </span>
      </div>
      {t.mapped_statement && !technique && (
        <p className="text-[12px] text-stone-500 mt-1 leading-[1.6]">{t.mapped_statement}</p>
      )}
      {t.context_pattern && <p className="text-[13px] text-stone-600 mt-1 leading-[1.6]">{t.context_pattern}</p>}
      {t.development_suggestion && (
        <p className="text-[13px] text-stone-600 mt-2 leading-[1.6]">
          <span className="font-medium text-primary">Try this: </span>
          {t.development_suggestion.narrative}
        </p>
      )}
    </div>
  );
}

export default function TrendPage() {
  const [report, setReport] = useState<TrendReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  /** True while a rebuild triggered from this page is still running. */
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const retry = useRef(0);

  /**
   * Rebuild the report from the latest cases.
   *
   * The route has always accepted `{ refresh: true }`; the page only ever sent
   * `{}`, and `if (haveReport && !refresh) return ready` then served the FIRST
   * report an account ever generated for the rest of its life — so the one
   * screen meant to show improvement could never show any. A rebuild returns
   * 'generating', and the old row keeps being served until the new one lands,
   * so we wait for created_at to actually change before swapping it in.
   */
  const refresh = useCallback(async () => {
    if (refreshing) return;
    const previousCreatedAt = report?.created_at ?? null;
    setRefreshing(true);
    setRefreshNote(null);

    try {
      await fetch('/api/clinical-master/trend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: true }),
      });
    } catch {
      setRefreshing(false);
      setRefreshNote('Could not start a rebuild. Try again in a moment.');
      return;
    }

    for (let attempt = 0; attempt < REFRESH_MAX_POLLS; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      try {
        const res = await fetch('/api/clinical-master/trend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.status === 'ready' && data.report) {
          const fresh = data.report as TrendReport;
          if ((fresh.created_at ?? null) !== previousCreatedAt) {
            setReport(fresh);
            setRefreshing(false);
            setRefreshNote('Updated from your latest cases.');
            return;
          }
        }
      } catch {
        /* keep waiting — a dropped poll isn't a failed rebuild */
      }
    }

    setRefreshing(false);
    setRefreshNote('Still rebuilding. Check back in a minute.');
  }, [refreshing, report]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/clinical-master/trend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (cancelled) return;
        const data = await res.json();
        if (data.status === 'ready' && data.report) {
          setReport(data.report);
          setLoading(false);
          return;
        }
        if (data.status === 'insufficient_data') {
          setEmpty(true);
          setLoading(false);
          return;
        }
        retry.current += 1;
        if (retry.current >= MAX_RETRIES) {
          setEmpty(true);
          setLoading(false);
          return;
        }
        setTimeout(poll, 3000);
      } catch {
        if (cancelled) return;
        retry.current += 1;
        if (retry.current >= MAX_RETRIES) {
          setEmpty(true);
          setLoading(false);
          return;
        }
        setTimeout(poll, 3000);
      }
    };
    const t = setTimeout(poll, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60dvh] flex flex-col items-center justify-center gap-4">
        <motion.div
          className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-muted text-sm animate-pulse">Building your development picture...</p>
      </div>
    );
  }

  if (empty || !report) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="text-heading font-medium mb-2">Not enough cases yet.</p>
          <p className="text-muted text-sm mb-6">
            Complete a few consultations and your cross case trends will appear here.
          </p>
          <Link href="/dashboard/library" className="text-primary hover:underline text-sm font-medium">
            Practice a Case
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[760px] mx-auto px-6 py-12">
      <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">Development Trends</div>
      <h1 className="text-[22px] font-bold text-heading mb-1">
        Trajectory: {report.overall_trajectory}
      </h1>
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <p className="text-[12px] text-muted">
          {report.window ? `Across ${report.window.cases_included} cases` : 'Across your recent cases'}
          {report.created_at ? ` \u00B7 built ${formatRelativeDate(report.created_at).toLowerCase()}` : ''}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="min-h-[36px] rounded-full border border-black/[0.08] px-3.5 text-[12px] font-semibold text-primary transition hover:bg-primary/[0.06] disabled:cursor-default disabled:text-muted disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {refreshing ? 'Rebuilding\u2026' : 'Refresh from my latest cases'}
        </button>
      </div>
      {(refreshing || refreshNote) && (
        <p className="text-[12px] text-muted mb-4">
          {refreshing
            ? 'Rebuilding from every case you have completed. This takes a minute or two \u2014 you can leave this page open.'
            : refreshNote}
        </p>
      )}
      {report.confidence === 'low' && (
        <div className="mb-6 p-3 rounded-lg text-[12px] text-amber-700" style={{ background: 'rgba(217,119,6,0.08)' }}>
          Provisional: based on a small number of cases so far.
        </div>
      )}
      {report.overall_narrative && (
        <p className="text-[14px] text-stone-600 leading-[1.7] mb-8">{report.overall_narrative}</p>
      )}

      {report.recurring_themes.length > 0 && (
        <Container className="mb-8">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">Recurring themes</div>
          {report.recurring_themes
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((t, i) => (
              <ThemeBlock key={i} t={t} />
            ))}
        </Container>
      )}

      {report.style_patterns.length > 0 && (
        <Container className="mb-8">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">Consultation style</div>
          {report.style_patterns.map((t, i) => (
            <ThemeBlock key={i} t={t} technique />
          ))}
        </Container>
      )}

      {report.consistent_strengths.length > 0 && (
        <Container className="mb-8">
          <div className="text-[10px] font-semibold text-success uppercase tracking-[0.1em] mb-4">Keep doing</div>
          <ul className="flex flex-col gap-2">
            {report.consistent_strengths.map((s, i) => (
              <li key={i} className="text-[13px] text-stone-600 leading-[1.6]">
                {s.theme_label}
                <span className="text-muted"> ({s.evidence_count} cases)</span>
              </li>
            ))}
          </ul>
        </Container>
      )}

      {report.next_steps.length > 0 && (
        <Container className="mb-8">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">Prioritised next steps</div>
          <ol className="flex flex-col gap-2">
            {report.next_steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[13px] text-stone-600 leading-[1.6]">
                <span className="text-primary font-mono font-semibold flex-shrink-0">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
        </Container>
      )}

      {report.caution && <p className="text-[12px] text-muted italic leading-[1.6]">{report.caution}</p>}
    </div>
  );
}

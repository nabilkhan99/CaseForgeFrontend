'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import { TrendReport, TrendTheme } from '@/lib/clinical-master/trendTypes';

const MAX_RETRIES = 20;

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
  const retry = useRef(0);

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
      {report.window && (
        <p className="text-[12px] text-muted mb-4">Across {report.window.cases_included} cases</p>
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

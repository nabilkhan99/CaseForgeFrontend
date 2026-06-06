'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import {
  ConsultationFeedback,
  DomainFeedback,
  GRADE_LABELS,
  PASSING_VERDICTS,
  Verdict,
} from '@/lib/clinical-master/types';

const MAX_RETRIES = 30;

function fmtTs(ms?: number | null): string {
  if (ms == null) return '';
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function verdictColours(verdict: Verdict): { bg: string; fg: string } {
  const passing = PASSING_VERDICTS.includes(verdict);
  if (verdict === 'Pass') return { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' };
  if (verdict === 'Bare Pass') return { bg: 'rgba(132,204,22,0.14)', fg: '#65A30D' };
  if (verdict === 'Bare Fail') return { bg: 'rgba(217,119,6,0.14)', fg: '#B45309' };
  return passing ? { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' } : { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626' };
}

function gradeColours(grade: DomainFeedback['grade']): { bg: string; fg: string } {
  if (grade === 'CP') return { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' };
  if (grade === 'P') return { bg: 'rgba(132,204,22,0.14)', fg: '#65A30D' };
  if (grade === 'F') return { bg: 'rgba(217,119,6,0.14)', fg: '#B45309' };
  return { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626' };
}

function Quote({ quote, ts }: { quote?: string; ts?: number | null }) {
  if (!quote) return null;
  return (
    <span className="block mt-1 text-[12px] text-stone-500 italic">
      {ts != null && <span className="not-italic font-mono text-stone-400">[{fmtTs(ts)}] </span>}
      &ldquo;{quote}&rdquo;
    </span>
  );
}

function DomainCard({ d, index }: { d: DomainFeedback; index: number }) {
  const gc = gradeColours(d.grade);
  return (
    <motion.section
      className="mb-10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1 }}
    >
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-black/5">
        <h2 className="text-[16px] font-semibold text-heading">{d.display_name}</h2>
        <span
          className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
          style={{ background: gc.bg, color: gc.fg }}
        >
          {GRADE_LABELS[d.grade]}
        </span>
      </div>

      {d.anchored_statements.length > 0 && (
        <p className="text-[12px] text-stone-500 mb-4 leading-[1.6]">
          Anchored to: {d.anchored_statements.map((s) => s.title).join('; ')}
        </p>
      )}

      {d.what_you_did_well.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-success uppercase tracking-[0.08em] mb-2">What you did well</p>
          <ul className="flex flex-col gap-2">
            {d.what_you_did_well.map((w, i) => (
              <li key={i} className="text-[13px] text-stone-600 leading-[1.6] pl-3 border-l-2 border-green-500/30">
                {w.narrative}
                <Quote quote={w.evidence?.quote} ts={w.evidence?.timestamp_ms} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.what_you_missed.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-[0.08em] mb-2">What you missed</p>
          <ul className="flex flex-col gap-2">
            {d.what_you_missed.map((m, i) => (
              <li key={i} className="text-[13px] text-stone-600 leading-[1.6] pl-3 border-l-2 border-amber-500/30">
                {m.consequence_tier >= 2 && (
                  <span
                    className="inline-block mr-2 px-1.5 py-0.5 rounded text-[10px] font-semibold align-middle"
                    style={{
                      background: m.consequence_tier === 3 ? 'rgba(220,38,38,0.12)' : 'rgba(217,119,6,0.12)',
                      color: m.consequence_tier === 3 ? '#DC2626' : '#B45309',
                    }}
                  >
                    {m.consequence_tier === 3 ? 'dangerous' : 'significant'}
                  </span>
                )}
                {m.narrative}
                <Quote quote={m.evidence?.quote} ts={m.evidence?.timestamp_ms} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.cue_handling.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em] mb-2">Cue handling</p>
          <ul className="flex flex-col gap-2">
            {d.cue_handling.map((c, i) => (
              <li
                key={i}
                className="text-[13px] text-stone-600 leading-[1.6] pl-3 border-l-2"
                style={{ borderColor: c.status === 'explored' ? 'rgba(34,197,94,0.3)' : 'rgba(217,119,6,0.3)' }}
              >
                <span className="font-medium">{c.status === 'explored' ? 'Explored' : 'Missed'}:</span> {c.narrative}
                <Quote quote={c.evidence?.quote} ts={c.evidence?.timestamp_ms} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.grade_mover && (
        <div className="mb-4 p-3 rounded-lg bg-primary/[0.04]">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-[0.08em] mb-1">
            What would most move this up a grade
          </p>
          <p className="text-[13px] text-stone-600 leading-[1.6]">{d.grade_mover.narrative}</p>
        </div>
      )}

      {d.model_moment && (
        <div className="mb-4 p-3 rounded-lg bg-stone-500/[0.05]">
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em] mb-1">A model moment</p>
          <p className="text-[13px] text-stone-600 leading-[1.6] italic">{d.model_moment.narrative}</p>
        </div>
      )}

      {d.how_to_improve.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em] mb-2">How to improve</p>
          <ul className="flex flex-col gap-1.5">
            {d.how_to_improve.map((h, i) => (
              <li key={i} className="text-[13px] text-stone-600 leading-[1.6]">{h.narrative}</li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  );
}

function FeedbackContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const from = searchParams.get('from');

  const [feedback, setFeedback] = useState<ConsultationFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const retryCount = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/generate-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (cancelled) return;
        const data = await res.json();

        if (data.status === 'ready' && data.feedback) {
          setFeedback(data.feedback);
          setLoading(false);
          return;
        }
        if (data.status === 'generating' || res.status === 404) {
          retryCount.current += 1;
          if (retryCount.current >= MAX_RETRIES) {
            setTimedOut(true);
            setLoading(false);
            return;
          }
          setTimeout(poll, 3000);
          return;
        }
        setError(true);
        setLoading(false);
      } catch {
        if (cancelled) return;
        retryCount.current += 1;
        if (retryCount.current >= MAX_RETRIES) {
          setTimedOut(true);
          setLoading(false);
          return;
        }
        setTimeout(poll, 3000);
      }
    };

    const timer = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-surface flex flex-col items-center justify-center gap-4">
        <motion.div
          className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-muted text-sm animate-pulse">Marking your consultation...</p>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="text-heading font-medium mb-2">This is taking longer than expected.</p>
          <p className="text-muted text-sm mb-6">
            Your feedback may still be processing. You can check back from your dashboard.
          </p>
          <Link href="/dashboard" className="text-primary hover:underline text-sm font-medium">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Unable to load feedback. Please try again later.</p>
          <Link href="/dashboard" className="text-primary hover:underline text-sm">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  const { overall, confidence } = feedback;
  const vc = verdictColours(overall.verdict);
  const pct = Math.max(0, Math.min(1, overall.weighted_score / (overall.max_score || 10.5)));

  return (
    <div className="min-h-[100dvh] bg-surface font-sans">
      <div className="max-w-[760px] mx-auto px-6 py-12">
        {/* Hero */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">Session Complete</div>

          <div className="relative inline-flex items-center justify-center mb-4">
            <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
              <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="10" />
              <motion.circle
                cx="70" cy="70" r="58" fill="none" stroke="url(#scoreGrad)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 58}
                initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - pct) }}
                transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#B45309" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[34px] font-extrabold leading-none gradient-text">
                {overall.weighted_score.toFixed(1)}
              </span>
              <span className="text-[11px] text-muted">out of {overall.max_score.toFixed(1)}</span>
            </div>
          </div>

          <div className="text-[14px] text-muted mb-3">{feedback.station_title}</div>

          <motion.div
            className="inline-flex px-5 py-2 rounded-full text-[12px] font-semibold uppercase tracking-wide"
            style={{ background: vc.bg, color: vc.fg }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.7 }}
          >
            {overall.verdict}
          </motion.div>

          {overall.one_line_summary && (
            <p className="text-[14px] text-stone-600 leading-[1.7] mt-5 max-w-[560px] mx-auto">
              {overall.one_line_summary}
            </p>
          )}
        </motion.div>

        {overall.tier3_override_applied && (
          <div className="mb-6 p-3 rounded-lg text-center" style={{ background: 'rgba(220,38,38,0.08)' }}>
            <p className="text-[12px] font-medium" style={{ color: '#DC2626' }}>
              A safety critical issue in this consultation capped the result at Fail, regardless of the score.
            </p>
          </div>
        )}

        {confidence && confidence.transcript_quality !== 'high' && (
          <div className="mb-6 p-3 rounded-lg text-center" style={{ background: 'rgba(217,119,6,0.08)' }}>
            <p className="text-[12px] text-amber-700">
              Transcript confidence was {confidence.transcript_quality}. Some feedback is given with caution.
              {confidence.notes ? ` ${confidence.notes}` : ''}
            </p>
          </div>
        )}

        {/* Focus areas */}
        {feedback.focus_areas.length > 0 && (
          <Container className="mb-10">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">Where to focus next</div>
            <ol className="flex flex-col gap-3">
              {feedback.focus_areas
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((f, i) => (
                  <li key={i} className="flex gap-3 text-[13px] text-stone-600 leading-[1.6]">
                    <span className="text-primary font-mono font-semibold flex-shrink-0">{f.priority}.</span>
                    <span>
                      <span className="font-semibold text-heading">{f.label}.</span> {f.narrative}
                    </span>
                  </li>
                ))}
            </ol>
          </Container>
        )}

        {/* Domains */}
        {feedback.domains.map((d, i) => (
          <DomainCard key={d.domain} d={d} index={i} />
        ))}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center mt-4">
          <Link href={from ? `/dashboard/library/${from}` : '/dashboard/library'}>
            <PrimaryButton>Practice Another Case &rarr;</PrimaryButton>
          </Link>
          {feedback.station_id && (
            <Link
              href={`/clinical-master/station/${feedback.station_id}${from ? `?from=${from}` : ''}`}
              className="text-[13px] font-medium text-primary hover:underline transition-colors"
            >
              Retry This Case
            </Link>
          )}
          <Link href="/dashboard" className="text-[13px] text-muted hover:text-heading transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
          <div className="text-muted text-sm">Loading...</div>
        </div>
      }
    >
      <FeedbackContent />
    </Suspense>
  );
}

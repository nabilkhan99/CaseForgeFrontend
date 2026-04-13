'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import ScoreBadge from '@/components/ui/ScoreBadge';
import { ConsultationFeedback } from '@/lib/clinical-master/types';

export default function FeedbackPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [feedback, setFeedback] = useState<ConsultationFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generationTriggered = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const generateAndFetch = async () => {
      if (generationTriggered.current) return;
      generationTriggered.current = true;

      try {
        const response = await fetch('/api/generate-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        if (cancelled) return;

        if (response.status === 404) {
          generationTriggered.current = false;
          setTimeout(generateAndFetch, 3000);
          return;
        }

        if (!response.ok) {
          setError(true);
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data.status === 'ready' && data.feedback) {
          setFeedback(data.feedback);
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      } catch {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      }
    };

    const timer = setTimeout(generateAndFetch, 2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <motion.div
          className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-muted text-sm animate-pulse">Generating feedback...</p>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Unable to load feedback. Please try again later.</p>
          <Link href="/dashboard" className="text-primary hover:underline text-sm">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  const overallScore = feedback.overall_score ?? Math.round(
    (feedback.data_gathering.score + feedback.clinical_management.score + feedback.interpersonal_skills.score) / 3
  );
  const isPassing = overallScore >= 60;

  // Collect ALL strengths and improvements from ALL domains
  const allStrengths = [
    ...feedback.data_gathering.strengths,
    ...feedback.clinical_management.strengths,
    ...feedback.interpersonal_skills.strengths,
  ];
  const allImprovements = [
    ...feedback.data_gathering.improvements,
    ...feedback.clinical_management.improvements,
    ...feedback.interpersonal_skills.improvements,
  ];

  const domains = [
    { label: 'Data Gathering', score: feedback.data_gathering.score },
    { label: 'Clinical Management', score: feedback.clinical_management.score },
    { label: 'Interpersonal Skills', score: feedback.interpersonal_skills.score },
  ];

  return (
    <div className="min-h-screen bg-surface font-sans">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        {/* Score hero */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">
            Session Complete
          </div>

          {/* Ring gauge */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
              <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="10" />
              <motion.circle
                cx="70" cy="70" r="58" fill="none"
                stroke="url(#scoreGrad)" strokeWidth="10" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 58}
                initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - overallScore / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#B45309" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className="text-[40px] font-extrabold leading-none gradient-text"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                {overallScore}
              </motion.span>
              <span className="text-[11px] text-muted">out of 100</span>
            </div>
          </div>

          <div className="text-[14px] text-muted mb-3">{feedback.station_title || 'Station Feedback'}</div>

          <motion.div
            className="inline-flex px-5 py-2 rounded-full text-[12px] font-semibold uppercase"
            style={{
              background: isPassing ? 'rgba(34,197,94,0.1)' : 'rgba(220,38,38,0.1)',
              color: isPassing ? '#16A34A' : '#DC2626',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.8 }}
          >
            {isPassing ? '\u2713 Pass' : '\u2717 Refer'}
          </motion.div>
        </motion.div>

        {/* Domain breakdown */}
        <Container className="mb-8">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-5">
            Domain Scores
          </div>
          <div className="flex flex-col gap-4">
            {domains.map((d, i) => (
              <motion.div
                key={d.label}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.12 }}
              >
                <span className="text-[13px] text-stone-600 font-medium w-[160px] flex-shrink-0">{d.label}</span>
                <div className="flex-1 h-2.5 bg-black/[0.04] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${d.score}%` }}
                    transition={{ type: 'spring', stiffness: 40, damping: 18, delay: 1.0 + i * 0.15 }}
                  />
                </div>
                <ScoreBadge score={d.score} size="sm" />
              </motion.div>
            ))}
          </div>
        </Container>

        {/* Strengths and improvements — two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Strengths */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
                <span className="text-[10px] text-success">{'\u2713'}</span>
              </div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">Strengths</span>
            </div>
            <div className="flex flex-col gap-2">
              {allStrengths.slice(0, 5).map((s, i) => (
                <motion.p
                  key={i}
                  className="text-[13px] text-stone-600 leading-[1.6] pl-3"
                  style={{ borderLeft: '2px solid rgba(34,197,94,0.3)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3 + i * 0.08 }}
                >
                  {s}
                </motion.p>
              ))}
            </div>
          </div>

          {/* Improvements */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(217,119,6,0.1)' }}>
                <span className="text-[10px] text-amber-600">{'\u26A1'}</span>
              </div>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-[0.08em]">To Improve</span>
            </div>
            <div className="flex flex-col gap-2">
              {allImprovements.slice(0, 5).map((s, i) => (
                <motion.p
                  key={i}
                  className="text-[13px] text-stone-600 leading-[1.6] pl-3"
                  style={{ borderLeft: '2px solid rgba(217,119,6,0.3)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3 + i * 0.08 }}
                >
                  {s}
                </motion.p>
              ))}
            </div>
          </div>
        </div>

        {/* Key learning points */}
        {feedback.key_learning_points && feedback.key_learning_points.length > 0 && (
          <Container className="mb-8">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">
              Key Learning Points
            </div>
            <ol className="flex flex-col gap-2">
              {feedback.key_learning_points.map((point, i) => (
                <li key={i} className="flex gap-3 text-[13px] text-stone-600 leading-[1.6]">
                  <span className="text-primary font-mono font-semibold flex-shrink-0">{i + 1}.</span>
                  {point}
                </li>
              ))}
            </ol>
          </Container>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          <Link href="/dashboard/library">
            <PrimaryButton>Practice Another Case &rarr;</PrimaryButton>
          </Link>
          <Link href="/dashboard" className="text-[13px] text-muted hover:text-heading transition-colors">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import FeedbackCard from '@/components/clinical-master/FeedbackCard';
import { ConsultationFeedback } from '@/lib/clinical-master/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_CLINICAL_MASTER_URL || 'http://localhost:8000';

export default function FeedbackPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [feedback, setFeedback] = useState<ConsultationFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout;

    const fetchFeedback = async () => {
      try {
        const response = await fetch(
          `${BACKEND_URL}/feedback/${sessionId}`
        );

        if (cancelled) return;

        if (response.status === 404) {
          // Feedback not ready yet — keep polling
          timeoutId = setTimeout(fetchFeedback, 2000);
          return;
        }

        if (!response.ok) {
          console.error('Error fetching feedback:', response.statusText);
          setError(true);
          setLoading(false);
          return;
        }

        const data = await response.json();

        if (data.status === 'ready' && data.feedback) {
          setFeedback(data.feedback);
          setLoading(false);
        } else {
          // Poll every 2 seconds if not ready
          timeoutId = setTimeout(fetchFeedback, 2000);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error fetching feedback:', err);
        setError(true);
        setLoading(false);
      }
    };

    fetchFeedback();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex-1 bg-[#0F1324] flex items-center justify-center">
        <div className="relative">
          <div className="size-40 rounded-full border-4 border-slate-700/50 flex items-center justify-center">
            <div className="size-40 absolute border-4 border-indigo-500 rounded-full animate-spin border-t-transparent"></div>
            <div className="size-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/10">
              <span className="material-symbols-outlined text-white text-4xl">sailing</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="flex-1 bg-[#0F1324] flex items-center justify-center">
        <div className="text-center space-y-4">
          <span className="material-symbols-outlined text-4xl text-slate-500">error_outline</span>
          <p className="text-slate-400">Unable to load feedback. Please try again later.</p>
          <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-4">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const overallScore = feedback.overall_score ?? Math.round(
    (feedback.data_gathering.score +
      feedback.clinical_management.score +
      feedback.interpersonal_skills.score) / 3
  );
  const isPassing = overallScore >= 60;

  return (
    <main className="flex-1 min-w-0 bg-[#0F1324] overflow-y-auto selection:bg-indigo-500/30">
      <header className="px-8 py-5 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-indigo-900/10 via-transparent to-blue-900/10 pointer-events-none"></div>
        <div className="max-w-6xl mx-auto flex items-center justify-between relative z-10">
          <div className="space-y-2 max-w-lg">
            <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm">verified</span>
              Assessment Complete
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">{feedback.station_title || 'Station Feedback'}</h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="bg-gradient-to-br from-violet-600 to-blue-600 rounded-xl px-6 py-3 shadow-lg shadow-indigo-500/20 border border-white/10 flex flex-col items-center justify-center min-w-[140px] h-[86px]">
              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mb-0.5 opacity-80">
                Overall Score
              </p>
              <div className="flex items-baseline justify-center gap-0.5">
                <span className="text-3xl font-bold text-white">{overallScore}</span>
                <span className="text-sm text-indigo-200 font-medium">%</span>
              </div>
            </div>

            <div className={`px-6 py-3 rounded-xl font-bold text-lg tracking-widest text-center min-w-[140px] h-[86px] flex items-center justify-center ${isPassing
              ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-700/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
              : 'bg-gradient-to-br from-red-500/10 to-red-700/10 border border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
              }`}>
              {isPassing ? 'PASS' : 'REFER'}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-5 space-y-5">
        {/* Domain Analysis */}
        <section className="glass-card rounded-2xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Domain Analysis
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Performance across key competency areas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeedbackCard domain={feedback.data_gathering} />
            <FeedbackCard domain={feedback.clinical_management} />
            <FeedbackCard domain={feedback.interpersonal_skills} />
          </div>
        </section>

        {/* Case Successes and Remediation Points */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Case Successes */}
          <details className="glass-card rounded-2xl group transition-all duration-300 overflow-hidden" open>
            <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 ring-1 ring-emerald-500/20">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Case Successes
                </h3>
              </div>
              <span className="material-symbols-outlined text-slate-500 transition-transform duration-300 group-open:rotate-180">
                expand_more
              </span>
            </summary>

            <div className="p-4 pt-0 border-t border-white/5">
              <div className="space-y-3 pt-4">
                {feedback.data_gathering.strengths.slice(0, 3).map((strength, index) => (
                  <div key={index} className="p-3 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 hover:border-emerald-500/20 transition-all">
                    <p className="text-sm font-medium text-slate-200">{strength}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>

          {/* Remediation Points */}
          <details className="glass-card rounded-2xl group transition-all duration-300 overflow-hidden" open>
            <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 ring-1 ring-rose-500/20">
                  <span className="material-symbols-outlined text-lg">error</span>
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Remediation Points
                </h3>
              </div>
              <span className="material-symbols-outlined text-slate-500 transition-transform duration-300 group-open:rotate-180">
                expand_more
              </span>
            </summary>

            <div className="p-4 pt-0 border-t border-white/5">
              <div className="space-y-3 pt-4">
                {feedback.clinical_management.improvements.slice(0, 3).map((improvement, index) => (
                  <div key={index} className="p-3 rounded-xl bg-rose-500/[0.05] border border-rose-500/20 hover:border-rose-500/30 transition-all">
                    <p className="text-sm font-medium text-slate-200">{improvement}</p>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>

        {/* Key Learning Points */}
        <section className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            Key Learning Points
          </h3>
          <ul className="space-y-2">
            {feedback.key_learning_points.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="material-symbols-outlined text-indigo-400 text-sm mt-0.5">
                  arrow_right
                </span>
                <span className="text-sm text-slate-300">{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Action Buttons */}
        <footer className="flex items-center justify-center gap-4 py-8 mt-12 relative">
          <div className="absolute top-0 w-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          <Link href="/dashboard">
            <button className="px-8 py-4 rounded-xl border border-white/5 text-slate-400 font-bold hover:text-white hover:bg-white/5 hover:border-white/10 transition-all duration-300 text-xs uppercase tracking-widest backdrop-blur-sm">
              Return to Dashboard
            </button>
          </Link>
          <Link href="/clinical-master">
            <button className="group relative px-10 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold transition-all duration-300 text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5 overflow-hidden">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative flex items-center gap-2">
                Next Station
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </span>
            </button>
          </Link>
        </footer>
      </div>
    </main>
  );
}

// Mock feedback for demo purposes
function getMockFeedback(): ConsultationFeedback {
  return {
    data_gathering: {
      domain: 'Data Gathering',
      score: 85,
      strengths: [
        'Systematic SOCRATES exploration of chest pain',
        'Comprehensive cardiovascular risk factor assessment',
        'Appropriate exploration of red flag symptoms',
      ],
      improvements: [
        'Consider exploring occupational impact earlier',
        'More detailed family history of cardiovascular disease',
      ],
    },
    clinical_management: {
      domain: 'Clinical Management',
      score: 94,
      strengths: [
        'Correct triage and escalation pathway followed',
        'Appropriate safety-netting advice provided',
        'Clear explanation of next steps',
      ],
      improvements: [
        'Could have discussed aspirin administration',
      ],
    },
    interpersonal_skills: {
      domain: 'Interpersonal Skills',
      score: 89,
      strengths: [
        'Empathetic rapport building established early',
        'Active listening demonstrated throughout',
        'Clear, jargon-free explanations',
      ],
      improvements: [
        'More time for patient questions at the end',
      ],
    },
    overall_summary: 'Strong performance across all domains with excellent clinical management and good interpersonal skills.',
    key_learning_points: [
      'Always explore ICE (Ideas, Concerns, Expectations) early in the consultation',
      'Red flag symptoms require immediate action and clear safety-netting',
      'Building rapport early improves patient disclosure of sensitive information',
    ],
  };
}

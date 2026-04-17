'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createClient } from '@/lib/supabase/client';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import DomainTag from '@/components/ui/DomainTag';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';

interface StationData {
  id: string;
  title: string;
  patient_name: string;
  candidate_instructions: string;
  reading_duration_seconds: number;
  consultation_duration_seconds: number;
  domain_name: string;
}

function ReadingPhaseContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const stationId = params.stationId as string;
  const from = searchParams.get('from');

  const [station, setStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readingComplete, setReadingComplete] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchStation() {
      const supabase = createClient();
      const { data: s, error: fetchError } = await supabase
        .from('stations')
        .select('id, title, patient_name, candidate_instructions, domain_id, reading_duration_seconds, consultation_duration_seconds')
        .eq('id', stationId)
        .single();

      if (fetchError || !s) {
        setLoading(false);
        return;
      }

      const { data: domain } = await supabase
        .from('domains')
        .select('name')
        .eq('id', s.domain_id)
        .single();

      setStation({
        id: s.id,
        title: s.title,
        patient_name: s.patient_name,
        candidate_instructions: s.candidate_instructions || '',
        reading_duration_seconds: s.reading_duration_seconds || 180,
        consultation_duration_seconds: s.consultation_duration_seconds || 480,
        domain_name: domain?.name || 'General Practice',
      });
      setLoading(false);
    }

    if (stationId) fetchStation();
  }, [stationId]);

  const handleStartConsultation = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError(null);

    const sessionId = crypto.randomUUID();

    try {
      const res = await fetch('/api/clinical-master/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, stationId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create session');
      }

      const sessionUrl = from
        ? `/clinical-master/session/${sessionId}?stationId=${stationId}&from=${from}`
        : `/clinical-master/session/${sessionId}?stationId=${stationId}`;
      router.push(sessionUrl);
    } catch (err) {
      setStarting(false);
      setError(err instanceof Error ? err.message : 'Failed to start consultation');
    }
  }, [stationId, router, starting, from]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Station not found</p>
          <Link href={from ? `/dashboard/library/${from}` : '/dashboard/library'} className="text-primary hover:underline text-sm">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-black/[0.06] pt-[env(safe-area-inset-top)]">
        <div className="max-w-[640px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href={from ? `/dashboard/library/${from}` : '/dashboard/library'}
            className="text-[13px] text-muted hover:text-heading transition-colors flex items-center gap-1"
          >
            &larr; Back to Library
          </Link>
          <ConsultationTimer
            durationSeconds={station.reading_duration_seconds}
            label="Reading Time"
            autoStart={true}
            onComplete={() => {
              setReadingComplete(true);
              ctaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
          <span className="hidden sm:inline text-[12px] text-muted">{station.title}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[640px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <Container>
            {/* Patient identity */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-[18px] font-semibold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)', boxShadow: '0 4px 16px rgba(180,83,9,0.2)' }}
              >
                {station.patient_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="text-[16px] font-semibold text-heading mb-0.5">{station.patient_name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <DomainTag name={station.domain_name} size="sm" />
                  <span className="text-[11px] font-mono text-primary font-semibold px-2 py-0.5 rounded-md" style={{ background: 'rgba(180,83,9,0.08)' }}>
                    {Math.round(station.consultation_duration_seconds / 60)} min
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-black/[0.05] mb-5" />

            {/* Candidate instructions */}
            <div className="mb-6">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-3">
                Candidate Brief
              </div>
              <div
                className="px-4 py-3 rounded-xl text-[14px] text-heading leading-[1.8]"
                style={{ background: 'linear-gradient(135deg, rgba(180,83,9,0.03), rgba(245,158,11,0.03))', borderLeft: '3px solid #B45309' }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="text-[14px] text-body leading-relaxed mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-heading">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ul: ({ children }) => <ul className="space-y-1 my-2 pl-1">{children}</ul>,
                    ol: ({ children }) => <ol className="space-y-1 my-2 pl-1 list-decimal list-inside">{children}</ol>,
                    li: ({ children }) => (
                      <li className="text-[14px] text-body leading-relaxed flex items-start gap-2">
                        <span className="text-primary mt-1.5 text-[6px] shrink-0">&#9679;</span>
                        <span>{children}</span>
                      </li>
                    ),
                    h1: ({ children }) => <h3 className="text-[15px] font-bold text-heading mt-4 mb-2 first:mt-0">{children}</h3>,
                    h2: ({ children }) => <h3 className="text-[15px] font-bold text-heading mt-4 mb-2 first:mt-0">{children}</h3>,
                    h3: ({ children }) => <h4 className="text-[14px] font-bold text-heading mt-3 mb-1">{children}</h4>,
                  }}
                >
                  {station.candidate_instructions}
                </ReactMarkdown>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-danger leading-relaxed"
              >
                {error}
              </motion.div>
            )}

            {/* CTA */}
            <div ref={ctaRef}>
              <motion.div
                animate={readingComplete ? { boxShadow: ['0 0 0 0 rgba(180,83,9,0)', '0 0 0 8px rgba(180,83,9,0.15)', '0 0 0 0 rgba(180,83,9,0)'] } : {}}
                transition={readingComplete ? { duration: 2, repeat: Infinity } : {}}
                className="rounded-xl"
              >
                <PrimaryButton
                  fullWidth
                  size="lg"
                  disabled={starting}
                  onClick={handleStartConsultation}
                >
                  {starting ? 'Starting...' : 'Begin Consultation →'}
                </PrimaryButton>
              </motion.div>
            </div>
          </Container>
        </motion.div>
      </div>
    </div>
  );
}

export default function ReadingPhasePage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-surface flex items-center justify-center"><div className="text-muted text-sm">Loading...</div></div>}>
      <ReadingPhaseContent />
    </Suspense>
  );
}

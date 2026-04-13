'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
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

export default function TryReadingPhasePage() {
  const params = useParams();
  const router = useRouter();
  const stationId = params.stationId as string;

  const [station, setStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerDone, setTimerDone] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    async function fetchStation() {
      try {
        const res = await fetch('/api/try/free-cases');
        if (!res.ok) throw new Error('Failed to fetch cases');
        const data = await res.json();

        const found = (data.stations || []).find((s: { id: string }) => s.id === stationId);
        if (!found) {
          router.push('/try');
          return;
        }

        // Fetch full candidate instructions
        const detailRes = await fetch(`/api/try/station-detail?stationId=${stationId}`);
        const candidateInstructions = detailRes.ok
          ? (await detailRes.json()).candidate_instructions || ''
          : '';

        setStation({
          id: found.id,
          title: found.title,
          patient_name: found.patient_name,
          candidate_instructions: candidateInstructions,
          reading_duration_seconds: found.reading_duration_seconds || 180,
          consultation_duration_seconds: found.consultation_duration_seconds || 300,
          domain_name: found.domains?.name || 'General Practice',
        });
      } catch {
        router.push('/try');
      } finally {
        setLoading(false);
      }
    }

    if (stationId) fetchStation();
  }, [stationId, router]);

  const handleStartConsultation = useCallback(async () => {
    if (starting) return;
    setStarting(true);

    const sessionId = crypto.randomUUID();

    try {
      const res = await fetch('/api/try/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, stationId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create session');
      }

      router.push(`/try/session/${sessionId}?stationId=${stationId}`);
    } catch (err) {
      setStarting(false);
      alert(err instanceof Error ? err.message : 'Failed to start consultation');
    }
  }, [stationId, router, starting]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
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
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Station not found</p>
          <Link href="/try" className="text-primary hover:underline text-sm">
            Back to Cases
          </Link>
        </div>
      </div>
    );
  }

  const sections = station.candidate_instructions.split('\n').filter(line => line.trim());

  return (
    <div className="min-h-screen bg-surface font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-[640px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/try"
            className="text-[13px] text-muted hover:text-heading transition-colors flex items-center gap-1"
          >
            &larr; Back
          </Link>
          <ConsultationTimer
            durationSeconds={station.reading_duration_seconds}
            label="Reading Time"
            autoStart={true}
            onComplete={() => setTimerDone(true)}
          />
          <span className="text-[12px] text-muted">{station.title}</span>
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
                {sections.map((line, i) => {
                  const isHeader = line.includes(':') && /^[A-Z]/.test(line);
                  return (
                    <p key={i} className={isHeader ? 'font-semibold mt-3 first:mt-0' : 'mt-1'}>
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <PrimaryButton
              fullWidth
              size="lg"
              disabled={!timerDone && !starting}
              onClick={handleStartConsultation}
            >
              {starting ? 'Starting...' : timerDone ? 'Begin Consultation \u2192' : 'Reading time remaining...'}
            </PrimaryButton>

            {!timerDone && (
              <p className="text-[11px] text-muted text-center mt-3">
                Button activates when reading time completes
              </p>
            )}
          </Container>
        </motion.div>
      </div>
    </div>
  );
}

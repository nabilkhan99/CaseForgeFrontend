'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatBriefMarkdown } from '@/lib/clinical-master/formatBrief';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import DomainTag from '@/components/ui/DomainTag';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';
import AudioSetupNotice from '@/components/clinical-master/AudioSetupNotice';
import { markTrialSessionStarted } from '@/lib/trial/storage';
import { patientInitials } from '@/lib/trial/callBrief';

export interface GuestReadingScreenProps {
  stationId: string;
  title: string;
  patientName: string;
  candidateInstructions: string;
  domainName: string;
  readingDurationSeconds: number;
  consultationDurationSeconds: number;
  /**
   * The consultation this page belongs to, when it was opened from a call
   * already in progress. Null when the visitor came here first — a session is
   * created on "Begin".
   */
  sessionId: string | null;
}

/**
 * The exam-style reading page: the full brief and a three-minute clock.
 *
 * No longer the default path — `/try/talk` goes straight to the patient — but
 * deliberately kept, because sitting the station properly is what the exam
 * actually asks of people and the two-line brief on the call screen is not that.
 * The call screen links here, handing over its own session id, so reading the
 * brief mid-flow returns to the same consultation rather than spending another.
 */
export default function GuestReadingScreen({
  stationId,
  title,
  patientName,
  candidateInstructions,
  domainName,
  readingDurationSeconds,
  consultationDurationSeconds,
  sessionId,
}: GuestReadingScreenProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readingComplete, setReadingComplete] = useState(false);

  const handleStartConsultation = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError(null);

    // Reuse the consultation this page was opened from; only a visitor who came
    // here first needs a new one. create-session is idempotent either way, and
    // is called in both cases because it is what re-signs the guest cookie the
    // Azure mint requires.
    const id = sessionId ?? crypto.randomUUID();

    try {
      const res = await fetch('/api/try/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id, stationId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create session');
      }

      markTrialSessionStarted(id);
      router.push(`/try/session/${id}`);
    } catch (err) {
      setStarting(false);
      setError(err instanceof Error ? err.message : 'Failed to start consultation');
    }
  }, [stationId, sessionId, router, starting]);

  const backHref = sessionId ? `/try/session/${sessionId}` : '/';

  return (
    <div className="min-h-[100dvh] bg-surface font-sans">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl border-b border-black/[0.06] pt-[env(safe-area-inset-top)]">
        <div className="max-w-[640px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href={backHref}
            className="text-[13px] text-muted hover:text-heading transition-colors flex items-center gap-1"
          >
            &larr; Back
          </Link>
          <ConsultationTimer
            durationSeconds={readingDurationSeconds}
            label="Reading time"
            autoStart={true}
            // Deliberately no scrollIntoView: on a phone the brief is two to
            // four screens, so the reading window genuinely runs out mid-read
            // and yanking the page to the button loses the reader's place. The
            // CTA's pulse is the whole nudge; nothing else happens at zero.
            onComplete={() => setReadingComplete(true)}
          />
          <span className="hidden sm:inline text-[12px] text-muted">{title}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[640px] mx-auto px-6 py-8">
        {/* The clock is already running when this page paints, and nothing on
            screen said what happens when it hits zero. Say it once, plainly. */}
        <p className="mb-5 text-[13px] leading-[1.65] text-muted">
          {Math.round(readingDurationSeconds / 60)} minutes&rsquo; reading, as in the exam &mdash; nothing happens at zero, begin when you&rsquo;re ready.
        </p>
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
                {patientInitials(patientName)}
              </div>
              <div className="flex-1">
                <div className="text-[16px] font-semibold text-heading mb-0.5">{patientName}</div>
                <div className="flex items-center gap-2 mt-1">
                  <DomainTag name={domainName} size="sm" />
                  <span className="text-[11px] font-mono text-primary font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: 'rgba(180,83,9,0.08)' }}>
                    {Math.round(consultationDurationSeconds / 60)}-min consultation
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
                  {formatBriefMarkdown(candidateInstructions)}
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

            {/* Audio setup guidance */}
            <AudioSetupNotice />

            {/* CTA */}
            <div>
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

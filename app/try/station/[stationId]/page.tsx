import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadActiveStation } from '@/lib/trial/guestStation';
import GuestReadingScreen from './GuestReadingScreen';

/**
 * The optional exam-style reading page for a guest.
 *
 * A server component for the same two reasons the call screen is one: the
 * station is now any of the 200 active cases rather than the four flagged
 * `is_free_trial`, so the client fetch it used to make (`/api/try/free-cases`,
 * then `/api/try/station-detail` for the brief itself) could no longer find it;
 * and reading the row here means the brief is on the page when it paints rather
 * than two round trips later.
 *
 * `?session=` carries a consultation already in progress — the call screen's
 * "Read the full brief first" link — so the detour returns to that same
 * consultation instead of spending another of the three a browser gets a day.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ stationId: string }>;
  searchParams: Promise<{ session?: string }>;
}

export default async function TryReadingPhasePage({ params, searchParams }: PageProps) {
  const { stationId } = await params;
  const { session } = await searchParams;
  const station = await loadActiveStation(getSupabaseAdmin(), stationId);

  if (!station) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-[20px] font-semibold text-heading">Case not found</h1>
          <p className="mb-6 text-[14px] leading-relaxed text-muted">
            This case is not available. Any of the others takes one click.
          </p>
          <Link
            href="/try/talk"
            className="inline-flex min-h-[44px] items-center rounded-xl px-6 py-3 text-[14px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}
          >
            Talk to a patient
          </Link>
        </div>
      </div>
    );
  }

  return (
    <GuestReadingScreen
      stationId={station.id}
      title={station.title || 'SCA station'}
      patientName={station.patient_name || 'Patient'}
      candidateInstructions={station.candidate_instructions || ''}
      domainName={station.domain_name || 'General Practice'}
      readingDurationSeconds={station.reading_duration_seconds || 180}
      consultationDurationSeconds={station.consultation_duration_seconds || 720}
      sessionId={session?.trim() || null}
    />
  );
}

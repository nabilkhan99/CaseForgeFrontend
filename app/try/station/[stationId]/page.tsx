import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadFreeStation } from '@/lib/trial/guestStation';
import GuestReadingScreen from './GuestReadingScreen';

/**
 * The optional exam-style reading page for a guest.
 *
 * A server component: reading the row here means the brief is on the page when
 * it paints, rather than two client round trips later (`/api/try/free-cases`,
 * then `/api/try/station-detail`) as it used to be.
 *
 * Free cases only, like everything else a guest can reach (contract C2). This
 * page ends in a "Begin Consultation" button and `create-session` behind it
 * refuses anything outside the five — so a locked case has to be turned away
 * HERE, by a page that says the case is not available, rather than by a button
 * that fails after the brief has been read.
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
  const station = await loadFreeStation(getSupabaseAdmin(), stationId);

  if (!station) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-[20px] font-semibold text-heading">Case not found</h1>
          <p className="mb-6 text-[14px] leading-relaxed text-muted">
            This case is not one of the five free ones. Any of those takes one click.
          </p>
          <Link
            href="/free"
            className="inline-flex min-h-[44px] items-center rounded-xl px-6 py-3 text-[14px] font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #B45309, #D97706)' }}
          >
            Try 5 free cases
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

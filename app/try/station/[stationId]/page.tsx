import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadFreeStation } from '@/lib/trial/guestStation';
import GuestReadingScreen from './GuestReadingScreen';

/**
 * The exam-style reading page every guest consultation starts on.
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
 * `?session=` carries the consultation /try/talk has just opened, so Begin
 * starts that same consultation instead of spending another of the three a
 * browser gets a day.
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

  // The signed-in reading page's plain missing state, pointed at the cases.
  if (!station) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Station not found</p>
          <Link href="/free" className="text-primary hover:underline text-sm">
            Back to cases
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

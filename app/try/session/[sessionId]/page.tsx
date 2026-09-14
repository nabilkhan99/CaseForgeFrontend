import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadGuestConsultation } from '@/lib/trial/guestStation';
import { patientInitials } from '@/lib/trial/callBrief';
import GuestCallScreen from './GuestCallScreen';

/**
 * The live guest consultation.
 *
 * A server component so the station is resolved from the session row before the
 * page paints: `/try/talk` created that row against one of the five free cases
 * (contract C2), so the case is a database fact rather than a `?stationId=` a
 * visitor could edit, and the call screen can ask for the microphone on arrival
 * instead of after two client fetches.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function GuestLiveConsultationPage({ params }: PageProps) {
  const { sessionId } = await params;
  const station = await loadGuestConsultation(getSupabaseAdmin(), sessionId);

  // The signed-in session screen's plain missing state, pointed at the cases.
  if (!station) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Consultation not found</p>
          <Link href="/free" className="text-primary hover:underline text-sm">
            Back to cases
          </Link>
        </div>
      </div>
    );
  }

  return (
    <GuestCallScreen
      sessionId={sessionId}
      stationId={station.id}
      patientName={station.patient_name || 'Patient'}
      patientInitials={patientInitials(station.patient_name)}
      // Every station in the library is 720s; the fallback matters only for a
      // row with no duration, which is also the one case the token route and
      // this page would disagree on (it falls back to 480).
      durationSeconds={station.consultation_duration_seconds || 720}
    />
  );
}

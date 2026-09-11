import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadGuestConsultation } from '@/lib/trial/guestStation';
import { buildCallBrief, patientInitials } from '@/lib/trial/callBrief';
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

  if (!station) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-[20px] font-semibold text-heading">
            That consultation has gone
          </h1>
          <p className="mb-6 text-[14px] leading-relaxed text-muted">
            It may have finished, or been left too long. Any of the five free cases
            takes one click.
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
    <GuestCallScreen
      sessionId={sessionId}
      stationId={station.id}
      brief={buildCallBrief(station)}
      patientName={station.patient_name || 'Patient'}
      patientInitials={patientInitials(station.patient_name)}
      // Every station in the library is 720s; the fallback matters only for a
      // row with no duration, which is also the one case the token route and
      // this page would disagree on (it falls back to 480).
      durationSeconds={station.consultation_duration_seconds || 720}
      fullBriefHref={`/try/station/${station.id}?session=${sessionId}`}
    />
  );
}
